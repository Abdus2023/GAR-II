/**
 * Plugin SDK — Core Interface
 *
 * This package defines the stable contract that third-party capability plugins
 * can implement without importing internal gateway source files.
 */

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author?: string
  homepage?: string
  repository?: string
  permissions?: string[]
  tags?: string[]
}

export interface ToolDefinition<Input = unknown, Output = unknown> {
  id: string
  description: string
  inputSchema?: unknown
  execute(input: Input, context: PluginExecutionContext): Promise<Output> | Output
}

export interface PluginExecutionContext {
  userId: string
  signal?: AbortSignal
}

export interface PluginContext {
  logger: {
    trace?: (payload: unknown, message?: string) => void
    debug?: (payload: unknown, message?: string) => void
    info: (payload: unknown, message?: string) => void
    warn: (payload: unknown, message?: string) => void
    error: (payload: unknown, message?: string) => void
  }
  invoke: <T = unknown>(action: string, params?: unknown) => Promise<T>
  config: Record<string, unknown>
  cache?: Map<string, unknown>
}

export interface PluginResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
  read?(): Promise<string | Uint8Array> | string | Uint8Array
}

export interface PluginPrompt {
  id: string
  name: string
  description?: string
  render(input?: Record<string, unknown>): Promise<string> | string
}

export interface Plugin {
  manifest(): PluginManifest
  initialize(ctx: PluginContext): Promise<void> | void
  tools?(): ToolDefinition[]
  resources?(): PluginResource[]
  prompts?(): PluginPrompt[]
  shutdown?(): Promise<void> | void
}

export abstract class BasePlugin implements Plugin {
  protected context?: PluginContext

  abstract manifest(): PluginManifest

  async initialize(ctx: PluginContext): Promise<void> {
    this.context = ctx
  }

  tools(): ToolDefinition[] {
    return []
  }

  resources(): PluginResource[] {
    return []
  }

  prompts(): PluginPrompt[] {
    return []
  }

  async shutdown(): Promise<void> {}
}

export class PluginRegistry {
  private plugins = new Map<string, Plugin>()

  register(plugin: Plugin): void {
    const manifest = plugin.manifest()

    if (!manifest.id) {
      throw new Error('Plugin manifest must include an id')
    }

    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin already registered: ${manifest.id}`)
    }

    this.plugins.set(manifest.id, plugin)
  }

  get(id: string): Plugin | undefined {
    return this.plugins.get(id)
  }

  list(): PluginManifest[] {
    return Array.from(this.plugins.values()).map(plugin => plugin.manifest())
  }

  tools(): ToolDefinition[] {
    return Array.from(this.plugins.values()).flatMap(plugin => plugin.tools?.() || [])
  }

  clear(): void {
    this.plugins.clear()
  }
}

export function definePlugin(plugin: Plugin): Plugin {
  return plugin
}

export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry()
}

export interface PluginSDK {
  register(plugin: Plugin): void
  get(id: string): Plugin | undefined
  list(): PluginManifest[]
  tools(): ToolDefinition[]
}
