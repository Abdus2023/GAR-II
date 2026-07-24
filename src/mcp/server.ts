import { Hono } from 'hono'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { serializeGatewayError } from '../errors'
import { kernel } from '../kernel'
import { validateAuth } from '../auth/middleware'
import { logger } from '../logger'
import { getCurrentUserId, runWithRequestContext } from '../request-context'
import { contextBudget } from '../context/budget'
import { skillRuntime } from '../skills/runtime'
import { toolSearch } from '../search/tool-search'
import { planner, executor } from '../planner'
import { agentRuntime } from '../agents'
import { workflowEngine } from '../workflow'
import { config } from '../config'
import { McpSessionStore } from './session-store'

export const mcpRouter = new Hono()

interface McpSession {
  server: McpServer
  transport: WebStandardStreamableHTTPServerTransport
}

const mcpSessions = new McpSessionStore<McpSession>({
  ttlMs: config.mcpSessionTtlMs,
  maxSessions: config.mcpMaxSessions,
  onEvict: (_sessionId, session) => session.transport.close(),
})

interface WorkspaceSchemaCache {
  registryVersion: number
  showing: number
  text: string
}

let workspaceSchemaCache: WorkspaceSchemaCache | null = null

function getWorkspaceSchemaText() {
  const registryVersion = kernel.getRegistryVersion()

  if (workspaceSchemaCache?.registryVersion === registryVersion) {
    contextBudget.setToolSchemaCost(workspaceSchemaCache.showing)
    return workspaceSchemaCache.text
  }

  const allTools = kernel.getRegisteredTools()
  const maxTools = contextBudget.getMaxToolsForContext(allTools.length)
  const selectedToolNames = allTools.slice(0, maxTools)
  contextBudget.setToolSchemaCost(selectedToolNames.length)

  const text = JSON.stringify({
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
    registry_version: registryVersion,
    recommendation: 'For best results, use _search_tools before calling workspace with complex actions.',
  }, null, 2)

  workspaceSchemaCache = {
    registryVersion,
    showing: selectedToolNames.length,
    text,
  }

  return text
}

function createMcpServer() {
  const server = new McpServer({
    name: 'claude-hub',
    version: '0.1.0',
  })

// The single "workspace" tool that Claude sees
server.tool(
  'workspace',
  'Unified workspace access. Actions are dynamically loaded from the kernel. Use help/list or _search_tools(query) to discover relevant tools.',
  {
    action: z.string().describe('The action or module to use'),
    params: z.record(z.any()).optional().describe('Action parameters'),
  },
  async ({ action, params = {} }, extra) => {
    const userId = getCurrentUserId()

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

      const nestedModuleAction = typeof params.action === 'string' && kernel.hasModule(action)
        ? `${action}.${params.action}`
        : null
      // Support dynamic module routing: workspace({ action: 'notes', params: { action: 'list' } })
      // maps to kernel action notes.list. Direct actions such as notes.list still work too.
      if (nestedModuleAction) {
        const moduleParams = { ...params }
        delete moduleParams.action
        result = await kernel.invoke(nestedModuleAction, moduleParams, { userId })
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
      const serializedError = serializeGatewayError(error)
      logger.error({ action, error: serializedError }, 'Tool execution failed')
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: serializedError,
          }, null, 2),
        }],
        isError: true,
      }
    }
  }
)

// Tool Search meta-tool (Phase 2 — dynamic discovery)
server.tool(
  '_search_tools',
  'Search for available tools by description. Use this when you need to discover new capabilities before calling them.',
  {
    query: z.string().describe('What you want to do (e.g. "read a file" or "search notes")'),
    limit: z.number().default(5).describe('Maximum number of tools to return'),
  },
  async ({ query, limit = 5 }) => {
    const results = toolSearch.search(query, limit)

    const enrichedResults = results.map(tool => {
      // Generate a helpful example call
      let example = ''
      const [module, actionName] = tool.id.split('.')

      if (actionName && kernel.hasModule(module)) {
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
server.resource(
  'workspace-schema',
  'workspace://schema',
  async () => ({
    contents: [{
      uri: 'workspace://schema',
      mimeType: 'application/json',
      text: getWorkspaceSchemaText(),
    }],
  })
)

// Skills as MCP Resources
server.resource(
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

server.resource(
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

  return server
}

mcpRouter.all('/', validateAuth, async (c) => {
  mcpSessions.cleanupExpired()
  const sessionId = c.req.header('mcp-session-id')
  let session = sessionId ? mcpSessions.get(sessionId) : undefined

  if (sessionId && !session) {
    return c.json({ error: 'Unknown MCP session' }, 404)
  }

  if (!session) {
    const server = createMcpServer()
    let createdSession!: McpSession
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: initializedSessionId => {
        mcpSessions.set(initializedSessionId, createdSession)
      },
      onsessionclosed: closedSessionId => {
        mcpSessions.delete(closedSessionId)
      },
    })
    createdSession = { server, transport }
    session = createdSession
    await server.connect(transport)
  }

  const userId = c.get('userId' as never) as string | undefined
  const correlationId = c.get('correlationId' as never) as string | undefined

  return runWithRequestContext(
    {
      userId: userId || 'anonymous',
      correlationId,
    },
    () => session.transport.handleRequest(c.req.raw)
  )
})
