import { describe, expect, it } from 'vitest'
import { EmbeddingCache, HashingEmbeddingProvider, type EmbeddingProvider } from '../src/memory/semantic'

function cosine(a: number[], b: number[]) {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index]
    normA += a[index] * a[index]
    normB += b[index] * b[index]
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

describe('HashingEmbeddingProvider', () => {
  it('returns normalized fixed-size vectors', async () => {
    const provider = new HashingEmbeddingProvider()
    const vector = await provider.embed('github pull request review')
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))

    expect(vector).toHaveLength(384)
    expect(norm).toBeCloseTo(1, 5)
  })

  it('places lexically related texts closer than unrelated texts', async () => {
    const provider = new HashingEmbeddingProvider()
    const query = await provider.embed('github pull request review')
    const related = await provider.embed('review github pr diff and changed files')
    const unrelated = await provider.embed('calendar dinner event tomorrow')

    expect(cosine(query, related)).toBeGreaterThan(cosine(query, unrelated))
  })
})

describe('EmbeddingCache', () => {
  it('evicts least recently used entries beyond capacity', () => {
    const cache = new EmbeddingCache(2)
    cache.set('a', [1])
    cache.set('b', [2])
    expect(cache.get('a')).toEqual([1])
    cache.set('c', [3])

    expect(cache.get('a')).toEqual([1])
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toEqual([3])
  })
})
