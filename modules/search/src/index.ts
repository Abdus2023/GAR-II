import { z } from 'zod'
import { db, memory, notes } from '../../../src/database'
import { eq, and, like } from 'drizzle-orm'
import type { Module, ModuleContext, Tool } from '../../../src/kernel/types'

export default class SearchModule implements Module {
  private ctx!: ModuleContext

  manifest() {
    return {
      id: 'search',
      version: '1.0.0',
      permissions: ['search.internal'],
      dependencies: ['auth', 'memory', 'notes'],
    }
  }

  async initialize(ctx: ModuleContext) {
    this.ctx = ctx
    this.ctx.logger.info('Search module initialized')
  }

  tools(): Tool[] {
    return [
      {
        id: 'query',
        description: 'Search across memory and notes',
        inputSchema: z.object({
          query: z.string().min(1),
          sources: z.array(z.string()).default(['memory', 'notes']),
        }),
        execute: this.search.bind(this),
      },
    ]
  }

  private async search(
    { query, sources }: { query: string; sources: string[] },
    ctx: { userId: string }
  ) {
    const results: any[] = []

    if (sources.includes('memory')) {
      const memResults = await db.query.memory.findMany({
        where: and(
          eq(memory.userId, ctx.userId),
          like(memory.key, `%${query}%`)
        ),
        limit: 10,
      })
      results.push(
        ...memResults.map(r => ({
          source: 'memory',
          key: r.key,
          value: JSON.parse(r.value),
        }))
      )
    }

    if (sources.includes('notes')) {
      const noteResults = await db.query.notes.findMany({
        where: and(
          eq(notes.userId, ctx.userId),
          like(notes.title, `%${query}%`)
        ),
        limit: 10,
      })
      results.push(
        ...noteResults.map(r => ({
          source: 'notes',
          id: r.id,
          title: r.title,
          content: r.content.slice(0, 200),
        }))
      )
    }

    return {
      success: true,
      query,
      results,
    }
  }

  async shutdown() {
    this.ctx.logger.info('Search module shutting down')
  }
}