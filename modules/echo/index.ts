import { z } from 'zod'
import type { Module, ModuleContext, Tool } from '../../src/kernel/types'

export default class EchoModule implements Module {
  private ctx!: ModuleContext

  manifest() {
    return {
      id: 'echo',
      version: '0.1.0',
      permissions: [],
      dependencies: [],
    }
  }

  async initialize(ctx: ModuleContext) {
    this.ctx = ctx
    this.ctx.logger.info('Echo module initialized')
  }

  tools(): Tool[] {
    return [{
      id: 'echo',
      description: 'Returns the message you send (test tool)',
      inputSchema: z.object({
        message: z.string().min(1),
      }),
      execute: async (input: { message: string }) => ({
        success: true,
        message: `Echo: ${input.message}`,
      }),
    }]
  }

  async shutdown() {
    this.ctx.logger.info('Echo module shutting down')
  }
}