import { z } from 'zod'
import { db, notes } from '../../../src/database'
import { eq, and, like } from 'drizzle-orm'
import type { Module, ModuleContext, Tool } from '../../../src/kernel/types'

export default class NotesModule implements Module {
  private ctx!: ModuleContext

  manifest() {
    return {
      id: 'notes',
      version: '1.0.0',
      permissions: ['notes.read', 'notes.write'],
      dependencies: ['auth', 'filesystem'],
    }
  }

  async initialize(ctx: ModuleContext) {
    this.ctx = ctx
    this.ctx.logger.info('Notes module initialized')
  }

  tools(): Tool[] {
    return [
      {
        id: 'create',
        description: 'Create a new note',
        inputSchema: z.object({
          title: z.string().min(1),
          content: z.string(),
          tags: z.array(z.string()).default([]),
        }),
        execute: this.createNote.bind(this),
      },
      {
        id: 'get',
        description: 'Retrieve a note by ID',
        inputSchema: z.object({
          id: z.string(),
        }),
        execute: this.getNote.bind(this),
      },
      {
        id: 'search',
        description: 'Search notes by title or content',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: this.searchNotes.bind(this),
      },
      {
        id: 'list',
        description: 'List all notes',
        inputSchema: z.object({}),
        execute: this.listNotes.bind(this),
      },
    ]
  }

  private async createNote(
    { title, content, tags }: { title: string; content: string; tags: string[] },
    ctx: { userId: string }
  ) {
    const id = crypto.randomUUID()

    await db.insert(notes).values({
      id,
      userId: ctx.userId,
      title,
      content,
      tags: JSON.stringify(tags),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    this.ctx.events.emit('notes:created', { id, title, userId: ctx.userId })

    return {
      success: true,
      id,
      title,
    }
  }

  private async getNote({ id }: { id: string }, ctx: { userId: string }) {
    const result = await db.query.notes.findFirst({
      where: and(eq(notes.id, id), eq(notes.userId, ctx.userId)),
    })

    if (!result) {
      return { success: false, error: 'not_found' }
    }

    return {
      success: true,
      id: result.id,
      title: result.title,
      content: result.content,
      tags: JSON.parse(result.tags),
      updatedAt: result.updatedAt,
    }
  }

  private async searchNotes({ query }: { query: string }, ctx: { userId: string }) {
    const results = await db.query.notes.findMany({
      where: and(
        eq(notes.userId, ctx.userId),
        like(notes.title, `%${query}%`)
      ),
      limit: 20,
    })

    return {
      success: true,
      results: results.map(r => ({
        id: r.id,
        title: r.title,
        tags: JSON.parse(r.tags),
        updatedAt: r.updatedAt,
      })),
    }
  }

  private async listNotes(_: any, ctx: { userId: string }) {
    const results = await db.query.notes.findMany({
      where: eq(notes.userId, ctx.userId),
      limit: 50,
    })

    return {
      success: true,
      notes: results.map(r => ({
        id: r.id,
        title: r.title,
        tags: JSON.parse(r.tags),
        updatedAt: r.updatedAt,
      })),
    }
  }

  async shutdown() {
    this.ctx.logger.info('Notes module shutting down')
  }
}