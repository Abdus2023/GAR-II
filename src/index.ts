import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { mcpRouter } from './mcp/server'
import { authRouter } from './auth/router'
import { healthRouter } from './routes/health'
import { metricsRouter } from './routes/metrics'
import { apiRouter } from './routes/api'
import { dashboardRouter } from './routes/dashboard'
import { discoveryRouter } from './routes/discovery'
import { correlationId } from './middleware/correlation-id'
import { telemetryMiddleware } from './middleware/telemetry'
import { rateLimit } from './middleware/rate-limit'
import { kernel } from './kernel'
import { skillRuntime } from './skills/runtime'
import { toolSearch } from './search/tool-search'
import { semanticMemory } from './memory/semantic'
import { config } from './config'
import { logger } from './logger'

export function createApp() {
  const app = new Hono()

  // CORS - restrict to Claude domains
  app.use('*', cors({
    origin: ['https://claude.ai', 'https://*.anthropic.com'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'MCP-Session-Id'],
    exposeHeaders: ['MCP-Session-Id'],
  }))

  app.use('*', correlationId)
  app.use('*', telemetryMiddleware)

  if (config.nodeEnv !== 'test') {
    app.use('*', honoLogger())
  }

  // Rate limiting
  app.use('*', rateLimit)

  // Routes
  app.route('/mcp', mcpRouter)
  app.route('/auth', authRouter)
  app.route('/health', healthRouter)
  app.route('/metrics', metricsRouter)
  app.route('/api', apiRouter)
  app.route('/dashboard', dashboardRouter)
  app.route('/', discoveryRouter)

  return app
}

export const app = createApp()

let bootstrapPromise: Promise<void> | null = null

export async function bootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await kernel.start()
      await skillRuntime.loadFromDirectory('./.claude/skills')
      await semanticMemory.initialize()

      // Register the live kernel tool registry for semantic search.
      // This intentionally derives from loaded modules instead of a stale hardcoded list,
      // so missing capabilities are not advertised.
      const registeredTools = kernel.getRegisteredToolMetadata()
      toolSearch.registerTools(registeredTools)

      logger.info({
        modules: kernel.getLoadedModules(),
        skills: skillRuntime.listSkills().length,
        searchableTools: registeredTools.length,
      }, 'Claude Hub Gateway ready (dynamic capabilities enabled)')
    })().catch((err: any) => {
      bootstrapPromise = null
      logger.error({ err }, 'Initialization failed')
      throw err
    })
  }

  return bootstrapPromise
}

export default {
  port: config.port,
  async fetch(request: Request, env?: unknown, executionCtx?: unknown) {
    await bootstrap()
    return app.fetch(request, env as never, executionCtx as never)
  },
}
