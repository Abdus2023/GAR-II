import { EventEmitter } from 'eventemitter3'
import { logger } from '../logger'
import { db, memory } from '../database'
import { semanticMemory } from '../memory/semantic'
import { eq, and, like } from 'drizzle-orm'
import type { Module, ModuleContext } from './types'

class Kernel {
  private modules = new Map<string, Module>()
  private tools = new Map<string, Function>()
  private events = new EventEmitter()
  private initialized = false

  async start() {
    if (this.initialized) return

    // Register built-in tools
    this.registerBuiltinTools()

    this.initialized = true
    logger.info('Kernel ready with database support')
  }

  private registerBuiltinTools() {
    // echo (test tool)
    this.tools.set('echo', async (input: { message: string }) => ({
      success: true,
      message: `Echo: ${input.message}`,
    }))

    // memory.get
    this.tools.set('memory.get', async (input: { key: string }, ctx: { userId: string }) => {
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
    })

    // memory.set
    this.tools.set('memory.set', async (input: { key: string; value: any }, ctx: { userId: string }) => {
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
      return { success: true }
    })

    // memory.search (keyword + semantic hybrid)
    this.tools.set('memory.search', async (input: { query: string }, ctx: { userId: string }) => {
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
        keyword_results: keywordResults.map(r => ({
          key: r.key,
          value: JSON.parse(r.value),
          updatedAt: r.updatedAt,
          source: 'keyword',
        })),
        semantic_results: semanticResults.map(r => ({
          key: r.key,
          content: r.content,
          score: r.score,
          source: 'semantic',
        })),
      }
    })
  }

  async invoke(action: string, params: any, ctx: { userId: string }) {
    const handler = this.tools.get(action)
    if (!handler) {
      throw new Error(`Unknown action: ${action}. Available: ${Array.from(this.tools.keys()).join(', ')}`)
    }

    const start = performance.now()
    try {
      const result = await handler(params, ctx)
      const duration = Math.round(performance.now() - start)

      this.events.emit('tool:executed', {
        toolId: action,
        userId: ctx.userId,
        duration,
        success: true,
      })

      // Audit log
      await db.insert(require('../database').toolCalls).values({
        userId: ctx.userId,
        toolId: action,
        action,
        input: JSON.stringify(params),
        output: JSON.stringify(result),
        durationMs: duration,
        createdAt: Date.now(),
      })

      return result
    } catch (error: any) {
      this.events.emit('tool:failed', { toolId: action, userId: ctx.userId, error: error.message })
      throw error
    }
  }

  getRegisteredTools() {
    return Array.from(this.tools.keys())
  }

  getLoadedModules() {
    return Array.from(this.modules.keys())
  }

  on(event: string, handler: Function) {
    this.events.on(event, handler)
  }

  emit(event: string, data: any) {
    this.events.emit(event, data)
  }
}

export const kernel = new Kernel()