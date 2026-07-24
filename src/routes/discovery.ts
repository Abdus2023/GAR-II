import { Hono } from 'hono'
import { config } from '../config'
import { kernel } from '../kernel'

export const discoveryRouter = new Hono()

// MCP Server Card (SEP-1649)
discoveryRouter.get('/.well-known/mcp/server-card.json', (c) => {
  const baseUrl = config.mcpServerUrl

  return c.json({
    id: 'claude-hub',
    name: 'Claude Hub Gateway',
    description: 'Personal AI operating system — unified workspace connector',
    version: '0.1.0',
    specVersion: '2026-07-28',
    endpoint: `${baseUrl}/mcp`,
    transport: 'streamable-http',
    auth: {
      type: 'oauth2',
      authorizationUrl: `${baseUrl}/auth/authorize`,
      tokenUrl: `${baseUrl}/auth/token`,
      registrationUrl: `${baseUrl}/auth/register`,
      scopes: ['workspace'],
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
    modules: kernel.getLoadedModules(),
    updatedAt: new Date().toISOString(),
  })
})

discoveryRouter.get('/.well-known/oauth-protected-resource', (c) => {
  const baseUrl = config.mcpServerUrl
  return c.json({
    resource: baseUrl,
    authorization_servers: [baseUrl],
  })
})