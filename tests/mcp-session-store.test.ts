import { describe, expect, it } from 'vitest'
import { McpSessionStore } from '../src/mcp/session-store'

describe('McpSessionStore', () => {
  it('returns active sessions and expires idle sessions', () => {
    let now = 1_000
    const evicted: Array<{ id: string; reason: string }> = []
    const store = new McpSessionStore<string>({
      ttlMs: 100,
      now: () => now,
      onEvict: (id, _value, reason) => evicted.push({ id, reason }),
    })

    store.set('session-a', 'value-a')
    expect(store.get('session-a')).toBe('value-a')

    now += 101
    expect(store.get('session-a')).toBeUndefined()
    expect(evicted).toEqual([{ id: 'session-a', reason: 'expired' }])
    expect(store.size()).toBe(0)
  })

  it('evicts least-recently-seen sessions when capacity is exceeded', () => {
    let now = 1_000
    const evicted: Array<{ id: string; reason: string }> = []
    const store = new McpSessionStore<string>({
      ttlMs: 10_000,
      maxSessions: 2,
      now: () => now,
      onEvict: (id, _value, reason) => evicted.push({ id, reason }),
    })

    store.set('a', 'A')
    now += 1
    store.set('b', 'B')
    now += 1
    expect(store.get('a')).toBe('A')
    now += 1
    store.set('c', 'C')

    expect(store.get('a')).toBe('A')
    expect(store.get('b')).toBeUndefined()
    expect(store.get('c')).toBe('C')
    expect(evicted).toEqual([{ id: 'b', reason: 'capacity' }])
  })

  it('supports explicit deletion and cleanup sweeps', () => {
    let now = 1_000
    const evicted: Array<{ id: string; reason: string }> = []
    const store = new McpSessionStore<string>({
      ttlMs: 50,
      now: () => now,
      onEvict: (id, _value, reason) => evicted.push({ id, reason }),
    })

    store.set('a', 'A')
    store.set('b', 'B')
    expect(store.delete('a')).toBe(true)
    now += 51
    store.cleanupExpired()

    expect(store.size()).toBe(0)
    expect(evicted).toEqual([
      { id: 'a', reason: 'closed' },
      { id: 'b', reason: 'expired' },
    ])
  })
})
