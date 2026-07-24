import * as lancedb from '@lancedb/lancedb'
import { config } from '../config'
import { FileLock } from './file-lock'
import { logger } from '../logger'

const EMBEDDING_DIMENSIONS = 384
const TOKEN_PATTERN = /[\p{L}\p{N}_-]+/gu
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'to', 'was', 'were', 'with',
])

interface MemoryEntry {
  id: string
  user_id: string
  key: string
  content: string
  embedding: number[]
  created_at: number
}

export interface EmbeddingProvider {
  readonly name: string
  embed(text: string): Promise<number[]>
}

function hashString(input: string): number {
  let hash = 2_166_136_261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }

  return hash >>> 0
}

function normalizeVector(vector: number[], dimensions = EMBEDDING_DIMENSIONS): number[] {
  const folded = new Array(dimensions).fill(0)

  for (let index = 0; index < vector.length; index += 1) {
    const value = Number(vector[index])
    if (Number.isFinite(value)) {
      folded[index % dimensions] += value
    }
  }

  const norm = Math.sqrt(folded.reduce((sum, value) => sum + value * value, 0)) || 1
  return folded.map(value => value / norm)
}

function tokenize(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(TOKEN_PATTERN))
    .map(match => match[0])
    .filter(token => token.length > 1 && !STOP_WORDS.has(token))
}

function addFeature(vector: number[], feature: string, weight: number) {
  const hash = hashString(feature)
  const index = hash % vector.length
  const sign = hash & 1 ? 1 : -1
  vector[index] += sign * weight
}

/**
 * Lightweight local embedding provider based on feature hashing.
 *
 * It is intentionally deterministic and dependency-free, but unlike the old
 * sine-wave placeholder it encodes lexical overlap, token prefixes, and token
 * bigrams into a normalized vector that produces useful nearest-neighbor
 * behavior for local prototypes.
 */
export class HashingEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'hashing-v1'

  async embed(text: string): Promise<number[]> {
    const vector = new Array(EMBEDDING_DIMENSIONS).fill(0)
    const tokens = tokenize(text)

    for (const token of tokens) {
      addFeature(vector, `tok:${token}`, 1)

      if (token.length >= 4) {
        addFeature(vector, `prefix:${token.slice(0, 4)}`, 0.35)
      }

      for (let index = 0; index <= token.length - 3; index += 1) {
        addFeature(vector, `tri:${token.slice(index, index + 3)}`, 0.15)
      }
    }

    for (let index = 0; index < tokens.length - 1; index += 1) {
      addFeature(vector, `bigram:${tokens[index]}:${tokens[index + 1]}`, 0.5)
    }

    return normalizeVector(vector)
  }
}

export class ApiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'api'

  constructor(
    private readonly apiUrl: string,
    private readonly apiKey?: string,
    private readonly model?: string
  ) {}

  async embed(text: string): Promise<number[]> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    })

    if (!response.ok) {
      throw new Error(`Embedding API failed: ${response.status} ${response.statusText}`)
    }

    const body = await response.json() as any
    const embedding = body.embedding || body.data?.[0]?.embedding

    if (!Array.isArray(embedding)) {
      throw new Error('Embedding API response did not include an embedding array')
    }

    return normalizeVector(embedding)
  }
}

export class EmbeddingCache {
  private cache = new Map<string, number[]>()

  constructor(private readonly maxEntries = 1_000) {}

  get(key: string) {
    const value = this.cache.get(key)
    if (!value) return undefined

    // Refresh recency for simple LRU behavior.
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: string, value: number[]) {
    this.cache.set(key, value)

    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value
      if (!oldestKey) break
      this.cache.delete(oldestKey)
    }
  }

  get size() {
    return this.cache.size
  }
}

function createEmbeddingProvider(): EmbeddingProvider {
  if (config.embeddingProvider === 'api' && config.embeddingApiUrl) {
    logger.info({ model: config.embeddingModel }, 'Using API embedding provider')
    return new ApiEmbeddingProvider(config.embeddingApiUrl, config.embeddingApiKey, config.embeddingModel)
  }

  if (config.embeddingProvider === 'api' && !config.embeddingApiUrl) {
    logger.warn('EMBEDDING_PROVIDER=api configured without EMBEDDING_API_URL; falling back to local hashing embeddings')
  }

  logger.info('Using local hashing embedding provider')
  return new HashingEmbeddingProvider()
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
  private readonly embeddingProvider: EmbeddingProvider
  private readonly embeddingCache: EmbeddingCache
  private lock: FileLock | null = null

  constructor(
    embeddingProvider: EmbeddingProvider = createEmbeddingProvider(),
    embeddingCache = new EmbeddingCache(config.embeddingCacheSize)
  ) {
    this.embeddingProvider = embeddingProvider
    this.embeddingCache = embeddingCache
  }

  async initialize(path: string = config.lanceDbPath) {
    if (this.initialized) return

    this.lock = new FileLock(`${path}.lock`, {
      timeoutMs: config.lanceDbLockTimeoutMs,
      staleMs: config.lanceDbLockStaleMs,
      metadata: {
        subsystem: 'semantic-memory',
      },
    })

    try {
      await this.withStorageLock(async () => {
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
              embedding: new Array(EMBEDDING_DIMENSIONS).fill(0),
              created_at: Date.now(),
            }
          ])
          // Remove the init record
          await this.table.delete('id = "init"')
        } else {
          this.table = await this.db.openTable('memory')
        }
      })

      this.initialized = true
      logger.info({ embeddingProvider: this.embeddingProvider.name }, 'Semantic Memory (LanceDB) initialized')
    } catch (error) {
      logger.warn({ error }, 'LanceDB initialization failed — semantic memory disabled')
    }
  }

  private async withStorageLock<T>(fn: () => Promise<T> | T): Promise<T> {
    return this.lock ? this.lock.runExclusive(fn) : fn()
  }

  private async embed(text: string): Promise<number[]> {
    const cacheKey = `${this.embeddingProvider.name}:${text}`
    const cached = this.embeddingCache.get(cacheKey)
    if (cached) return cached

    const embedding = await this.embeddingProvider.embed(text)
    this.embeddingCache.set(cacheKey, embedding)
    return embedding
  }

  async add(userId: string, key: string, content: string) {
    if (!this.table) return

    const embedding = await this.embed(content)

    await this.withStorageLock(() => this.table.add([
      {
        id: `${userId}:${key}:${Date.now()}`,
        user_id: userId,
        key,
        content,
        embedding,
        created_at: Date.now(),
      }
    ]))

    logger.debug({ userId, key }, 'Semantic memory entry added')
  }

  async search(userId: string, query: string, limit: number = 5) {
    if (!this.table) return []

    const queryEmbedding = await this.embed(query)

    try {
      const results = await this.withStorageLock(() => this.table
        .search(queryEmbedding)
        .filter(`user_id = '${userId.replace(/'/g, "''")}'`)
        .limit(limit)
        .execute())

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
