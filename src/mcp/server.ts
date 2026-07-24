import { Hono } from 'hono'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { kernel } from '../kernel'
import { validateAuth } from '../auth/middleware'
import { logger } from '../logger'
import { contextBudget } from '../context/budget'
import { skillRuntime } from '../skills/runtime'
import { scanForSecrets } from '../security/secret-scanner'
import { toolSearch } from '../search/tool-search'
import { planner, executor } from '../planner'
import { agentRuntime } from '../agents'
import { workflowEngine } from '../workflow'

export const mcpRouter = new Hono()

const mcpServer = new McpServer({
  name: 'claude-hub',
  version: '0.1.0',
})

// The single "workspace" tool that Claude sees
mcpServer.tool(
  'workspace',
  'Unified workspace access. Supported: memory.*, github.*, filesystem.*, notes.*, search.*. Use _search_tools(query) to discover relevant tools.',
  {
    action: z.string().describe('The action or module to use'),
    params: z.record(z.any()).optional().describe('Action parameters'),
  },
  async ({ action, params = {} }, extra) => {
    const userId = 'default' // Simplified for Phase 1

    logger.info({ action, userId }, 'Tool invoked')

    // Reset budget for this request
    contextBudget.reset()

    // Check budget warnings
    const warnings = contextBudget.checkWarnings()
    if (warnings.length > 0) {
      logger.warn({ warnings, userId }, 'Context budget warnings')
    }

    try {
      let result: any
      // Built-in help
      if (action === 'help' || action === 'list' || action === 'actions') {
        const tools = kernel.getRegisteredTools()
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              available_actions: tools,
              usage: 'Use workspace({ action: "..." , params: { ... } })',
              tip: 'Use _search_tools to discover tools by description',
            }, null, 2),
          }],
        }
      }

      // Planner (Phase 4)
      if (action === 'plan') {
        const graph = await planner.createPlan(params.goal || params.query || 'No goal provided')
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              plan: graph,
              message: 'Plan created. Use workspace({ action: "execute_plan", params: { plan: <graph> } }) to run it.',
            }, null, 2),
          }],
        }
      }

      // Execute Plan (Phase 4)
      if (action === 'execute_plan') {
        const plan = params.plan
        if (!plan) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: 'Missing plan in params' }),
            }],
            isError: true,
          }
        }

        const result = await executor.execute(plan, { userId })
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        }
      }

      // Run Agent (Phase 4)
      if (action === 'run_agent') {
        const { agent, task } = params
        const result = await agentRuntime.runAgent(agent, task, { userId })
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        }
      }

      // Run Workflow (Phase 4)
      if (action === 'run_workflow') {
        const { workflow, inputs = {} } = params
        const result = await workflowEngine.run(workflow, inputs, { userId })
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        }
      }

      // Security: Scan for secrets in write operations
      const writeActions = ['memory.set', 'files.write', 'github.create_issue']
      if (writeActions.includes(action) && params.content) {
        const secretCheck = scanForSecrets(params.content)
        if (secretCheck.blocked) {
          logger.warn({ action, userId, pattern: secretCheck.pattern }, 'Secret detected in write operation')
          return {
            content: [{
              type: 'text',
              text: `Blocked: ${secretCheck.reason}`,
            }],
            isError: true,
          }
        }
      }

      // Support module routing (github, filesystem, notes, search)
      const knownModules = ['github', 'filesystem', 'notes', 'search']
      if (params.action && knownModules.includes(action)) {
        const moduleAction = `${action}.${params.action}`
        const moduleParams = { ...params }
        delete moduleParams.action
        result = await kernel.invoke(moduleAction, moduleParams, { userId })
      } 
      // Direct action
      else {
        result = await kernel.invoke(action, params, { userId })
      }

      // Record tool result usage
      const resultTokens = JSON.stringify(result).length / 4
      contextBudget.addToolResult(resultTokens)

      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        }],
      }
    } catch (error: any) {
      logger.error({ action, error: error.message }, 'Tool execution failed')
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      }
    }
  }
)

// Tool Search meta-tool (Phase 2 — dynamic discovery)
mcpServer.tool(
  '_search_tools',
  'Search for available tools by description. Use this when you need to discover new capabilities before calling them.',
  {
    query: z.string().describe('What you want to do (e.g. "review a pull request" or "search github")'),
    limit: z.number().default(5).describe('Maximum number of tools to return'),
  },
  async ({ query, limit = 5 }) => {
    const results = toolSearch.search(query, limit)

    const enrichedResults = results.map(tool => {
      // Generate a helpful example call
      let example = ''
      const [module, actionName] = tool.id.split('.')

      if (module === 'github' || module === 'filesystem' || module === 'notes' || module === 'search') {
        example = `workspace({ action: "${module}", params: { action: "${actionName}", ... } })`
      } else if (module === 'memory') {
        example = `workspace({ action: "${tool.id}", params: { key: "...", value: "..." } })`
      } else {
        example = `workspace({ action: "${tool.id}", params: { ... } })`
      }

      return {
        action: tool.id,
        description: tool.description,
        category: tool.category,
        cost: tool.cost,
        example,
      }
    })

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query,
          results: enrichedResults,
          message: enrichedResults.length > 0 
            ? `Found ${enrichedResults.length} relevant tools. Copy the "example" field to use them.`
            : 'No matching tools found. Try a broader query.',
        }, null, 2),
      }],
    }
  }
)

// Schema + Budget + Tool Search resource (respects context budget)
mcpServer.resource(
  'workspace-schema',
  'workspace://schema',
  async () => {
    const allTools = kernel.getRegisteredTools()
    const maxTools = contextBudget.getMaxToolsForContext(allTools.length)
    
    // Select top tools (currently simple slice, can be improved with relevance)
    const selectedToolNames = allTools.slice(0, maxTools)

    return {
      contents: [{
        uri: 'workspace://schema',
        mimeType: 'application/json',
        text: JSON.stringify({
          available_actions: selectedToolNames,
          total_available: allTools.length,
          showing: selectedToolNames.length,
          note: selectedToolNames.length < allTools.length 
            ? 'Context budget active — not all tools shown. Use _search_tools(query) to discover relevant tools.'
            : 'All tools shown within context budget.',
          modules: kernel.getLoadedModules(),
          context_budget: contextBudget.getStatus(),
          skills: skillRuntime.listSkills(),
          tool_search_enabled: true,
          recommendation: 'For best results, use _search_tools before calling workspace with complex actions.',
        }, null, 2),
      }],
    }
  }
)

// Skills as MCP Resources
mcpServer.resource(
  'list-skills',
  'skills://list',
  async () => ({
    contents: [{
      uri: 'skills://list',
      mimeType: 'application/json',
      text: JSON.stringify(skillRuntime.listSkills(), null, 2),
    }],
  })
)

mcpServer.resource(
  'skill-content',
  new ResourceTemplate('skills://{name}', { list: undefined }),
  async (uri, { name }) => {
    const content = skillRuntime.getSkillContent(name as string)
    if (!content) throw new Error(`Skill not found: ${name}`)
    
    return {
      contents: [{
        uri: `skills://${name}`,
        mimeType: 'text/markdown',
        text: content,
      }],
    }
  }
)

mcpRouter.all('/', validateAuth, async (c) => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  })

  await mcpServer.connect(transport)

  return transport.handleRequest(c.req.raw)
})