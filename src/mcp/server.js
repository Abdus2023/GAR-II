import { Hono } from 'hono';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { kernel } from '../kernel';
import { validateAuth } from '../auth/middleware';
import { logger } from '../logger';
import { contextBudget } from '../context/budget';
import { skillRuntime } from '../skills/runtime';
import { scanForSecrets } from '../security/secret-scanner';
export const mcpRouter = new Hono();
const mcpServer = new McpServer({
    name: 'claude-hub',
    version: '0.1.0',
});
// The single "workspace" tool that Claude sees
mcpServer.tool('workspace', 'Unified workspace access. Actions: echo, search, memory, files, github, workflow, notes, admin', {
    action: z.string().describe('The action to perform'),
    params: z.record(z.any()).optional().describe('Action parameters'),
}, async ({ action, params = {} }, extra) => {
    const userId = 'default'; // Simplified for Phase 1
    logger.info({ action, userId }, 'Tool invoked');
    // Reset budget for this request
    contextBudget.reset();
    // Check budget warnings
    const warnings = contextBudget.checkWarnings();
    if (warnings.length > 0) {
        logger.warn({ warnings, userId }, 'Context budget warnings');
    }
    try {
        // Security: Scan for secrets in write operations
        const writeActions = ['memory.set', 'files.write', 'github.create_issue'];
        if (writeActions.includes(action) && params.content) {
            const secretCheck = scanForSecrets(params.content);
            if (secretCheck.blocked) {
                logger.warn({ action, userId, pattern: secretCheck.pattern }, 'Secret detected in write operation');
                return {
                    content: [{
                            type: 'text',
                            text: `Blocked: ${secretCheck.reason}`,
                        }],
                    isError: true,
                };
            }
        }
        const result = await kernel.invoke(action, params, { userId });
        // Record tool result usage
        const resultTokens = JSON.stringify(result).length / 4;
        contextBudget.addToolResult(resultTokens);
        return {
            content: [{
                    type: 'text',
                    text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                }],
        };
    }
    catch (error) {
        logger.error({ action, error: error.message }, 'Tool execution failed');
        return {
            content: [{
                    type: 'text',
                    text: `Error: ${error.message}`,
                }],
            isError: true,
        };
    }
});
// Schema + Budget resource
mcpServer.resource('workspace-schema', 'workspace://schema', async () => ({
    contents: [{
            uri: 'workspace://schema',
            mimeType: 'application/json',
            text: JSON.stringify({
                available_actions: kernel.getRegisteredTools(),
                modules: kernel.getLoadedModules(),
                context_budget: contextBudget.getStatus(),
                skills: skillRuntime.listSkills(),
            }, null, 2),
        }],
}));
// Skills as MCP Resources
mcpServer.resource('list-skills', 'skills://list', async () => ({
    contents: [{
            uri: 'skills://list',
            mimeType: 'application/json',
            text: JSON.stringify(skillRuntime.listSkills(), null, 2),
        }],
}));
mcpServer.resource('skill-content', new ResourceTemplate('skills://{name}', { list: undefined }), async (uri, { name }) => {
    const content = skillRuntime.getSkillContent(name);
    if (!content)
        throw new Error(`Skill not found: ${name}`);
    return {
        contents: [{
                uri: `skills://${name}`,
                mimeType: 'text/markdown',
                text: content,
            }],
    };
});
mcpRouter.all('/', validateAuth, async (c) => {
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
    });
    await mcpServer.connect(transport);
    const response = await transport.handle(c.req.raw);
    return new Response(response.body, {
        status: response.status,
        headers: response.headers,
    });
});
