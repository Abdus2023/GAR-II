/**
 * Plugin SDK — Core Interface
 * 
 * This is the contract that all plugins must implement.
 */

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author?: string
  permissions?: string[]
}

export interface PluginContext {
  logger: any
  invoke: (action: string, params?: any) => Promise<any>
  config: Record<string, any>
}

export interface Plugin {
  manifest(): PluginManifest
  initialize(ctx: PluginContext): Promise<void>
  tools?(): any[]
  resources?(): any[]
  prompts?(): any[]
  shutdown?(): Promise<void>
}

export abstract class BasePlugin implements Plugin {
  abstract manifest(): PluginManifest
  async initialize(ctx: PluginContext): Promise<void> {}
  tools?(): any[] { return [] }
  resources?(): any[] { return [] }
  prompts?(): any[] { return [] }
  async shutdown?(): Promise<void> {}
}

export interface PluginSDK {
  register(plugin: Plugin): void
  list(): PluginManifest[]
}