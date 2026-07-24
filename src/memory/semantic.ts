import * as lancedb from '@lancedb/lancedb'
import { logger } from '../logger'

interface MemoryEntry {
  id: string
  user_id: string
  key: string
  content: string
  embedding: number[]
  created_at: number
}

/**
 * L3 Semantic Memory using LanceDB
 * 
 * This provides meaning-based retrieval of past context.
 */
export class SemanticMemory {
  private db: any = null
  private table: any = null
  private initialized = false

  async initialize(path: string = './data/lancedb') {
    if (this.initialized) return

    try {
      this.db = await lancedb.connect(path)
      
      // Create table if it doesn't exist
      const tables = await this.db.tableNames()
      
      if (!tables.includes('memory')) {
        // Create with a simple schema
        this.table = await this.db.createTable('memory', [
          {
            id: 'init',
            user_id: 'system',
            key: 'init',
            content: 'Initialization record',
            embedding: new Array(384).fill(0),
            created_at: Date.now(),
          }
        ])
        // Remove the init record
        await this.table.delete('id = "init"')
      } else {
        this.table = await this.db.openTable('memory')
      }

      this.initialized = true
      logger.info('Semantic Memory (LanceDB) initialized')
    } catch (error) {
      logger.warn({ error }, 'LanceDB initialization failed — semantic memory disabled')
    }
  }

  /**
   * Simple embedding function (placeholder)
   * In production, replace with a real embedding model (e.g. @xenova/transformers)
   */
  private async embed(text: string): Promise<number[]> {
    // Placeholder: return a deterministic pseudo-embedding
    // Real implementation would use an embedding model
    const hash = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return Array.from({ length: 384 }, (_, i) => 
      Math.sin(hash * (i + 1)) * 0.5 + 0.5
    )
  }

  async add(userId: string, key: string, content: string) {
    if (!this.table) return

    const embedding = await this.embed(content)

    await this.table.add([
      {
        id: `${userId}:${key}:${Date.now()}`,
        user_id: userId,
        key,
        content,
        embedding,
        created_at: Date.now(),
      }
    ])

    logger.debug({ userId, key }, 'Semantic memory entry added')
  }

  async search(userId: string, query: string, limit: number = 5) {
    if (!this.table) return []

    const queryEmbedding = await this.embed(query)

    try {
      const results = await this.table
        .search(queryEmbedding)
        .filter(`user_id = '${userId}'`)
        .limit(limit)
        .execute()

      return results.map((r: any) => ({
        key: r.key,
        content: r.content,
        score: r._distance,
      }))
    } catch (error) {
      logger.warn({ error }, 'Semantic search failed')
      return []
    }
  }
}

export const semanticMemory = new SemanticMemory()