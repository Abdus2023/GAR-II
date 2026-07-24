export interface ModuleContext {
  logger: any
  events: any
  config: any
  cache: any
  invoke: (action: string, params: any) => Promise<any>
}

export interface Tool {
  id: string
  description: string
  inputSchema: any
  execute: (input: any, ctx: any) => Promise<any>
}

export interface Module {
  manifest(): any
  initialize(ctx: ModuleContext): Promise<void>
  tools(): Tool[]
  resources?(): any[]
  prompts?(): any[]
  shutdown?(): Promise<void>
}