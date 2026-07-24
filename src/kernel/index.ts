import { EventEmitter } from 'eventemitter3'
import { access, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config } from '../config'
import { GatewayError } from '../errors'
import { logger } from '../logger'
import { db, initializeDatabase, memory, toolCalls } from '../database'
import { semanticMemory } from '../memory/semantic'
import { verifyModuleManifest, verifyModulePreImport, type ModulePreImportVerification } from '../security/module-signing'
import { scanForSecrets } from '../security/secret-scanner'
import { telemetry } from '../telemetry'
import { eq, and, like } from 'drizzle-orm'
import type { Module, ModuleContext, Tool } from './types'

export interface ToolMetadata {
  id: string
  description: string
  category: string
  cost: 'low' | 'medium' | 'high'
  moduleId?: string
  requiresConfirmation?: boolean
}

type ToolHandler = (params: any, ctx: { userId: string }) => Promise<any> | any

export interface KernelInvocation {
  action: string
  params: any
  ctx: { userId: string }
}

export interface KernelAfterInvocation extends KernelInvocation {
  result: any
  durationMs: number
}

export interface KernelErrorInvocation extends KernelInvocation {
  error: unknown
  durationMs: number
}

export type KernelBeforeInvokeHook = (
  invocation: KernelInvocation
) => Promise<void | Partial<KernelInvocation>> | void | Partial<KernelInvocation>
export type KernelAfterInvokeHook = (invocation: KernelAfterInvocation) => Promise<void> | void
export type KernelInvokeErrorHook = (invocation: KernelErrorInvocation) => Promise<void> | void
export type KernelHookName = 'beforeInvoke' | 'afterInvoke' | 'onInvokeError'

export interface KernelOptions {
  /** Override the module import root. Defaults to ./modules in dev and ./dist/modules after build. */
  modulesDir?: string
  /** Auto-load capability modules during start(). */
  autoLoadModules?: boolean
  /** Persist tool-call audit logs. Can be disabled in tests. */
  auditLogging?: boolean
  /** Maximum duration for a direct tool invocation before the kernel returns a timeout error. */
  toolTimeoutMs?: number
}

interface DiscoveredModule {
  id: string
  dependencies: string[]
  moduleRoot: string
  entrypoint: string
  instance: Module
  manifest: any
  verification: ModulePreImportVerification
}

const BUILT_IN_CAPABILITIES = new Set(['auth', 'database', 'kernel', 'memory'])
const WRITE_ACTIONS = new Set([
  'memory.set',
  'filesystem.write_file',
  'notes.create',
  'github.create_issue',
  'calendar.create_event',
])

const CONFIRMATION_REQUIRED_ACTIONS = new Set([
  'filesystem.write_file',
  'calendar.create_event',
  'github.create_issue',
])

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export class Kernel {
  private modules = new Map<string, Module>()
  private tools = new Map<string, ToolHandler>()
  private toolMetadata = new Map<string, ToolMetadata>()
  private events = new EventEmitter()
  private initialized = false
  private registryVersion = 0
  private auditLogQueue: Promise<void> = Promise.resolve()
  private moduleCaches = new Map<string, Map<string, any>>()
  private builtinHooksRegistered = false
  private beforeInvokeHooks: KernelBeforeInvokeHook[] = []
  private afterInvokeHooks: KernelAfterInvokeHook[] = []
  private invokeErrorHooks: KernelInvokeErrorHook[] = []
  private readonly options: Required<Pick<KernelOptions, 'autoLoadModules' | 'auditLogging' | 'toolTimeoutMs'>> & Pick<KernelOptions, 'modulesDir'>

  constructor(options: KernelOptions = {}) {
    this.options = {
      modulesDir: options.modulesDir,
      autoLoadModules: options.autoLoadModules ?? true,
      auditLogging: options.auditLogging ?? true,
      toolTimeoutMs: options.toolTimeoutMs ?? config.kernelToolTimeoutMs,
    }
  }

  async start() {
    if (this.initialized) return

    await initializeDatabase()
    this.registerBuiltinHooks()

    // Register built-in tools before loading external modules so modules can depend on them.
    this.registerBuiltinTools()

    if (this.options.autoLoadModules) {
      await this.loadModules()
    }

    this.initialized = true
    logger.info(
      {
        modules: this.getLoadedModules(),
        tools: this.getRegisteredTools().length,
      },
      'Kernel ready with database and capability-module support'
    )
  }

  /**
   * Dynamically discovers and loads capability modules from the modules directory.
   *
   * In development/test this imports TypeScript module entrypoints from ./modules.
   * After `npm run build`, it imports compiled JavaScript entrypoints from ./dist/modules.
   */
  async loadModules() {
    const discovered = await this.discoverModules()
    const pending = [...discovered]
    const availableCapabilities = new Set<string>([
      ...BUILT_IN_CAPABILITIES,
      ...this.modules.keys(),
    ])

    while (pending.length > 0) {
      let loadedInPass = 0

      for (let index = 0; index < pending.length; index += 1) {
        const moduleDef = pending[index]
        const missingDeps = moduleDef.dependencies.filter(dep => !availableCapabilities.has(dep))

        if (missingDeps.length > 0) {
          continue
        }

        pending.splice(index, 1)
        index -= 1

        const loaded = await this.initializeModule(moduleDef)
        if (loaded) {
          availableCapabilities.add(moduleDef.id)
          loadedInPass += 1
        }
      }

      if (loadedInPass === 0) {
        for (const moduleDef of pending) {
          const missingDeps = moduleDef.dependencies.filter(dep => !availableCapabilities.has(dep))
          logger.warn(
            { moduleId: moduleDef.id, missingDeps },
            'Skipping module because dependencies are unavailable'
          )
        }
        break
      }
    }
  }

  private async discoverModules(): Promise<DiscoveredModule[]> {
    const modulesRoot = await this.resolveModulesRoot()

    if (!(await pathExists(modulesRoot))) {
      logger.warn({ modulesRoot }, 'Modules directory not found; continuing with built-in tools only')
      return []
    }

    const moduleDirs = await readdir(modulesRoot, { withFileTypes: true })
    const discovered: DiscoveredModule[] = []

    for (const dirent of moduleDirs) {
      if (!dirent.isDirectory()) continue

      const moduleId = dirent.name
      const moduleRoot = resolve(modulesRoot, moduleId)
      const entrypoint = await this.findModuleEntrypoint(modulesRoot, moduleId)

      if (!entrypoint) {
        logger.warn({ moduleId, modulesRoot }, 'Skipping module without an index entrypoint')
        continue
      }

      try {
        const verification = await verifyModulePreImport({
          moduleRoot,
          moduleId,
          entrypoint,
          mode: config.moduleSignatureMode,
          publicKeys: config.moduleSignaturePublicKeys,
        })

        for (const warning of verification.warnings) {
          logger.warn({ moduleId, warning }, 'Capability module signature warning')
        }

        const imported = await import(pathToFileURL(entrypoint).href)
        const ModuleCtor = imported.default

        if (typeof ModuleCtor !== 'function') {
          logger.warn({ moduleId, entrypoint }, 'Skipping module without a default class export')
          continue
        }

        const instance = new ModuleCtor() as Module
        const manifest = instance.manifest?.()

        if (!manifest?.id) {
          logger.warn({ moduleId, entrypoint }, 'Skipping module without a manifest id')
          continue
        }

        const manifestVerification = verifyModuleManifest(manifest, verification, config.moduleSignatureMode)
        for (const warning of manifestVerification.warnings) {
          logger.warn({ moduleId, warning }, 'Capability module manifest signature warning')
        }

        discovered.push({
          id: manifest.id,
          dependencies: Array.isArray(manifest.dependencies) ? manifest.dependencies : [],
          moduleRoot,
          entrypoint,
          instance,
          manifest,
          verification,
        })
      } catch (error: any) {
        logger.error(
          { moduleId, entrypoint, error: error.message },
          'Failed to import capability module'
        )
      }
    }

    return discovered
  }

  private async resolveModulesRoot(): Promise<string> {
    if (this.options.modulesDir) {
      return resolve(this.options.modulesDir)
    }

    const sourceModules = resolve(process.cwd(), 'modules')
    const compiledModules = resolve(process.cwd(), 'dist/modules')

    // When running compiled code via `node dist/src/index.js`, import compiled module JS.
    if (import.meta.url.includes('/dist/src/') && (await pathExists(compiledModules))) {
      return compiledModules
    }

    return sourceModules
  }

  private async findModuleEntrypoint(modulesRoot: string, moduleId: string): Promise<string | null> {
    const preferCompiled = modulesRoot.replace(/\\/g, '/').includes('/dist/modules')
    const extensions = preferCompiled ? ['js', 'mjs', 'ts'] : ['ts', 'js', 'mjs']
    const candidates = extensions.flatMap(ext => [
      resolve(modulesRoot, moduleId, 'src', `index.${ext}`),
      resolve(modulesRoot, moduleId, `index.${ext}`),
    ])

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        return candidate
      }
    }

    return null
  }

  private async initializeModule(moduleDef: DiscoveredModule): Promise<boolean> {
    const { id, instance, manifest, entrypoint, verification } = moduleDef

    if (this.modules.has(id)) {
      logger.warn({ moduleId: id }, 'Skipping duplicate module id')
      return false
    }

    const moduleLogger = logger.child({ module: id })
    const cache = new Map<string, any>()
    this.moduleCaches.set(id, cache)

    const ctx: ModuleContext = {
      logger: moduleLogger,
      events: this.events,
      config: {
        env: process.env,
        settings: config,
        manifest,
      },
      cache,
      invoke: (action: string, params: any) => this.invoke(action, params, { userId: 'module-system' }),
    }

    try {
      await instance.initialize(ctx)
      this.modules.set(id, instance)

      const moduleTools = instance.tools()
      for (const tool of moduleTools) {
        this.registerModuleTool(id, tool)
      }

      logger.info(
        {
          moduleId: id,
          version: manifest.version,
          entrypoint,
          signatureStatus: verification.status,
          tools: moduleTools.length,
        },
        'Capability module loaded'
      )

      return true
    } catch (error: any) {
      this.moduleCaches.delete(id)
      logger.error({ moduleId: id, error: error.message }, 'Failed to initialize capability module')
      return false
    }
  }

  registerHook(name: 'beforeInvoke', hook: KernelBeforeInvokeHook): () => void
  registerHook(name: 'afterInvoke', hook: KernelAfterInvokeHook): () => void
  registerHook(name: 'onInvokeError', hook: KernelInvokeErrorHook): () => void
  registerHook(name: KernelHookName, hook: KernelBeforeInvokeHook | KernelAfterInvokeHook | KernelInvokeErrorHook) {
    const hooks = name === 'beforeInvoke'
      ? this.beforeInvokeHooks
      : name === 'afterInvoke'
        ? this.afterInvokeHooks
        : this.invokeErrorHooks

    hooks.push(hook as never)

    return () => {
      const index = hooks.indexOf(hook as never)
      if (index >= 0) hooks.splice(index, 1)
    }
  }

  private registerBuiltinHooks() {
    if (this.builtinHooksRegistered) return
    this.builtinHooksRegistered = true

    this.registerHook('beforeInvoke', ({ action, params }) => {
      if (!CONFIRMATION_REQUIRED_ACTIONS.has(action)) return
      if (this.hasExplicitConfirmation(params)) return

      throw new GatewayError('AUTHORIZATION_ERROR', `Action ${action} requires explicit confirmation`, {
        status: 403,
        details: {
          action,
          requiredParam: 'confirm: true',
        },
      })
    })

    this.registerHook('beforeInvoke', ({ action, params }) => {
      if (!WRITE_ACTIONS.has(action)) return

      const contentToScan = this.extractSecretScanContent(params)
      if (!contentToScan) return

      const secretCheck = scanForSecrets(contentToScan)
      if (!secretCheck.blocked) return

      throw new GatewayError('INVALID_INPUT', `Blocked: ${secretCheck.reason}`, {
        status: 400,
        details: {
          action,
          pattern: secretCheck.pattern,
        },
      })
    })
  }

  private hasExplicitConfirmation(params: any): boolean {
    return Boolean(params && typeof params === 'object' && params.confirm === true)
  }

  private extractSecretScanContent(params: any): string | null {
    if (!params || typeof params !== 'object') return null

    if (typeof params.content === 'string') return params.content
    if (typeof params.description === 'string') return params.description
    if (typeof params.value === 'string') return params.value
    if (params.value && typeof params.value === 'object') return `const value = ${this.safeStringify(params.value)}`

    return `const input = ${this.safeStringify(params)}`
  }

  private async runBeforeInvokeHooks(invocation: KernelInvocation): Promise<KernelInvocation> {
    let current = invocation

    for (const hook of this.beforeInvokeHooks) {
      const next = await hook(current)
      if (next) {
        current = {
          ...current,
          ...next,
          ctx: next.ctx || current.ctx,
        }
      }
    }

    return current
  }

  private async runAfterInvokeHooks(invocation: KernelAfterInvocation) {
    for (const hook of this.afterInvokeHooks) {
      try {
        await hook(invocation)
      } catch (error: any) {
        logger.warn({ action: invocation.action, error: error.message }, 'After-invoke hook failed')
      }
    }
  }

  private async runInvokeErrorHooks(invocation: KernelErrorInvocation) {
    for (const hook of this.invokeErrorHooks) {
      try {
        await hook(invocation)
      } catch (error: any) {
        logger.warn({ action: invocation.action, error: error.message }, 'Invoke-error hook failed')
      }
    }
  }

  private registerModuleTool(moduleId: string, tool: Tool) {
    const fullToolId = tool.id.includes('.') ? tool.id : `${moduleId}.${tool.id}`

    this.registerTool(
      fullToolId,
      async (params: any, ctx: { userId: string }) => {
        const validatedInput = this.validateToolInput(fullToolId, tool, params)
        return tool.execute(validatedInput, ctx)
      },
      {
        description: tool.description,
        category: moduleId,
        moduleId,
      }
    )
  }

  private registerTool(
    id: string,
    handler: ToolHandler,
    metadata: Partial<Omit<ToolMetadata, 'id'>> = {}
  ): boolean {
    if (this.tools.has(id)) {
      logger.warn({ toolId: id }, 'Skipping duplicate tool registration')
      return false
    }

    this.tools.set(id, handler)
    this.registryVersion += 1
    this.toolMetadata.set(id, {
      id,
      description: metadata.description || `Tool ${id}`,
      category: metadata.category || this.categoryForTool(id),
      cost: metadata.cost || 'low',
      moduleId: metadata.moduleId,
      requiresConfirmation: metadata.requiresConfirmation ?? CONFIRMATION_REQUIRED_ACTIONS.has(id),
    })

    return true
  }

  private validateToolInput(fullToolId: string, tool: Tool, params: any) {
    if (!tool.inputSchema || typeof tool.inputSchema.safeParse !== 'function') {
      return params
    }

    const parsed = tool.inputSchema.safeParse(params ?? {})
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue: any) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ')
      throw new GatewayError('INVALID_INPUT', `Invalid input for ${fullToolId}: ${details}`, {
        status: 400,
        details: parsed.error.issues,
      })
    }

    return parsed.data
  }

  private categoryForTool(id: string) {
    return id.includes('.') ? id.split('.')[0] : 'core'
  }

  private registerBuiltinTools() {
    // echo (test tool)
    this.registerTool(
      'echo',
      async (input: { message: string }) => ({
        success: true,
        message: `Echo: ${input.message}`,
      }),
      {
        description: 'Simple test tool that echoes back any message you send',
        category: 'core',
        cost: 'low',
      }
    )

    // memory.get
    this.registerTool(
      'memory.get',
      async (input: { key: string }, ctx: { userId: string }) => {
        const result = await db.query.memory.findFirst({
          where: and(
            eq(memory.userId, ctx.userId),
            eq(memory.key, input.key)
          ),
        })
        return {
          success: true,
          value: result ? JSON.parse(result.value) : null,
        }
      },
      {
        description: 'Retrieve a previously stored value from persistent memory',
        category: 'memory',
        cost: 'low',
      }
    )

    // memory.set
    this.registerTool(
      'memory.set',
      async (input: { key: string; value: any }, ctx: { userId: string }) => {
        const existing = await db.query.memory.findFirst({
          where: and(
            eq(memory.userId, ctx.userId),
            eq(memory.key, input.key)
          ),
        })

        if (existing) {
          await db.update(memory)
            .set({
              value: JSON.stringify(input.value),
              updatedAt: Date.now(),
            })
            .where(eq(memory.id, existing.id))
        } else {
          await db.insert(memory).values({
            userId: ctx.userId,
            key: input.key,
            value: JSON.stringify(input.value),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }

        this.events.emit('memory:updated', { key: input.key, userId: ctx.userId })
        void semanticMemory.add(ctx.userId, input.key, this.safeStringify(input.value)).catch((error: any) => {
          logger.warn({ key: input.key, error: error.message }, 'Semantic memory update failed')
        })
        return { success: true }
      },
      {
        description: 'Store a key-value pair in persistent memory for later retrieval',
        category: 'memory',
        cost: 'low',
      }
    )

    // memory.search (keyword + semantic hybrid)
    this.registerTool(
      'memory.search',
      async (input: { query: string }, ctx: { userId: string }) => {
        // Keyword search (L2)
        const keywordResults = await db.query.memory.findMany({
          where: and(
            eq(memory.userId, ctx.userId),
            like(memory.key, `%${input.query}%`)
          ),
          limit: 10,
        })

        // Semantic search (L3)
        const semanticResults = await semanticMemory.search(ctx.userId, input.query, 5)

        return {
          success: true,
          keyword_results: keywordResults.map((r: any) => ({
            key: r.key,
            value: JSON.parse(r.value),
            updatedAt: r.updatedAt,
            source: 'keyword',
          })),
          semantic_results: semanticResults.map((r: any) => ({
            key: r.key,
            content: r.content,
            score: r.score,
            source: 'semantic',
          })),
        }
      },
      {
        description: 'Search through stored memory using keyword and semantic matching',
        category: 'memory',
        cost: 'low',
      }
    )
  }

  async invoke(action: string, params: any, ctx: { userId: string }) {
    const start = performance.now()
    let invocation: KernelInvocation = { action, params, ctx }

    try {
      invocation = await this.runBeforeInvokeHooks(invocation)
      const handler = this.tools.get(invocation.action)
      if (!handler) {
        throw new GatewayError('CAPABILITY_NOT_FOUND', `Unknown action: ${invocation.action}`, {
          status: 404,
          details: { availableActions: Array.from(this.tools.keys()).sort() },
        })
      }

      const result = await this.withToolTimeout(
        telemetry.withSpan('kernel.invoke', {
          'kernel.action': invocation.action,
          'enduser.id': invocation.ctx.userId,
        }, () => handler(invocation.params, invocation.ctx)),
        invocation.action
      )
      const duration = Math.round(performance.now() - start)

      this.events.emit('tool:executed', {
        toolId: invocation.action,
        userId: invocation.ctx.userId,
        duration,
        success: true,
      })

      await this.runAfterInvokeHooks({ ...invocation, result, durationMs: duration })

      this.enqueueToolCall({
        userId: invocation.ctx.userId,
        toolId: invocation.action,
        action: invocation.action,
        input: invocation.params,
        output: result,
        durationMs: duration,
      })

      return result
    } catch (error: any) {
      const duration = Math.round(performance.now() - start)
      this.events.emit('tool:failed', {
        toolId: invocation.action,
        userId: invocation.ctx.userId,
        error: error.message,
      })

      await this.runInvokeErrorHooks({ ...invocation, error, durationMs: duration })

      this.enqueueToolCall({
        userId: invocation.ctx.userId,
        toolId: invocation.action,
        action: invocation.action,
        input: invocation.params,
        error: error.message,
        durationMs: duration,
      })

      if (error instanceof GatewayError) {
        throw error
      }

      throw new GatewayError('CAPABILITY_FAILED', `Capability ${invocation.action} failed: ${error.message}`, {
        status: 500,
        cause: error,
      })
    }
  }

  private async withToolTimeout<T>(promise: Promise<T>, action: string): Promise<T> {
    let timeout: NodeJS.Timeout | undefined

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new GatewayError('CAPABILITY_FAILED', `Capability ${action} timed out after ${this.options.toolTimeoutMs}ms`, {
              status: 504,
              details: {
                action,
                timeoutMs: this.options.toolTimeoutMs,
              },
            }))
          }, this.options.toolTimeoutMs)
        }),
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  private enqueueToolCall(entry: {
    userId: string
    toolId: string
    action: string
    input: any
    output?: any
    error?: string
    durationMs: number
  }) {
    if (!this.options.auditLogging) return

    this.auditLogQueue = this.auditLogQueue
      .then(() => this.recordToolCall(entry))
      .catch((error: any) => {
        logger.warn(
          { toolId: entry.toolId, error: error.message },
          'Audit log queue failed; continuing with subsequent entries'
        )
      })
  }

  private async recordToolCall(entry: {
    userId: string
    toolId: string
    action: string
    input: any
    output?: any
    error?: string
    durationMs: number
  }) {
    if (!this.options.auditLogging) return

    try {
      await db.insert(toolCalls).values({
        userId: entry.userId,
        toolId: entry.toolId,
        action: entry.action,
        input: this.safeStringify(entry.input),
        output: entry.output === undefined ? undefined : this.safeStringify(entry.output),
        error: entry.error,
        durationMs: entry.durationMs,
        createdAt: Date.now(),
      })
    } catch (error: any) {
      logger.warn(
        { toolId: entry.toolId, error: error.message },
        'Audit log write failed; preserving tool response'
      )
    }
  }

  private safeStringify(value: any) {
    try {
      return JSON.stringify(value)
    } catch {
      return JSON.stringify({ error: 'unserializable_value' })
    }
  }

  getRegisteredTools() {
    return Array.from(this.tools.keys()).sort()
  }

  getRegisteredToolMetadata() {
    return Array.from(this.toolMetadata.values()).sort((a, b) => a.id.localeCompare(b.id))
  }

  getRegistryVersion() {
    return this.registryVersion
  }

  getLoadedModules() {
    return Array.from(this.modules.keys()).sort()
  }

  hasModule(moduleId: string) {
    return this.modules.has(moduleId)
  }

  on(event: string, handler: (...args: any[]) => void) {
    this.events.on(event, handler)
  }

  emit(event: string, data: any) {
    this.events.emit(event, data)
  }

  async flushAuditLogs() {
    await this.auditLogQueue
  }

  async shutdown() {
    const loadedModules = Array.from(this.modules.entries()).reverse()

    for (const [moduleId, moduleInstance] of loadedModules) {
      try {
        await moduleInstance.shutdown?.()
      } catch (error: any) {
        logger.warn({ moduleId, error: error.message }, 'Module shutdown failed')
      }
    }

    await this.flushAuditLogs()

    this.modules.clear()
    this.moduleCaches.clear()
    this.tools.clear()
    this.toolMetadata.clear()
    this.registryVersion += 1
    this.initialized = false
  }
}

export const kernel = new Kernel()