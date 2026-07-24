export interface McpSessionStoreOptions<T> {
  ttlMs: number
  maxSessions?: number
  now?: () => number
  onEvict?: (sessionId: string, value: T, reason: 'expired' | 'closed' | 'capacity') => void | Promise<void>
}

interface SessionRecord<T> {
  value: T
  createdAt: number
  lastSeenAt: number
}

export class McpSessionStore<T> {
  private readonly ttlMs: number
  private readonly maxSessions: number
  private readonly now: () => number
  private readonly onEvict?: McpSessionStoreOptions<T>['onEvict']
  private readonly sessions = new Map<string, SessionRecord<T>>()

  constructor(options: McpSessionStoreOptions<T>) {
    this.ttlMs = options.ttlMs
    this.maxSessions = options.maxSessions ?? 1_000
    this.now = options.now ?? (() => Date.now())
    this.onEvict = options.onEvict
  }

  set(sessionId: string, value: T) {
    const now = this.now()
    this.sessions.set(sessionId, {
      value,
      createdAt: now,
      lastSeenAt: now,
    })
    this.enforceCapacity()
  }

  get(sessionId: string): T | undefined {
    const record = this.sessions.get(sessionId)
    if (!record) return undefined

    if (this.isExpired(record)) {
      this.delete(sessionId, 'expired')
      return undefined
    }

    record.lastSeenAt = this.now()
    return record.value
  }

  delete(sessionId: string, reason: 'expired' | 'closed' | 'capacity' = 'closed') {
    const record = this.sessions.get(sessionId)
    if (!record) return false

    this.sessions.delete(sessionId)
    this.notifyEviction(sessionId, record.value, reason)
    return true
  }

  cleanupExpired() {
    for (const [sessionId, record] of this.sessions) {
      if (this.isExpired(record)) {
        this.delete(sessionId, 'expired')
      }
    }
  }

  size() {
    return this.sessions.size
  }

  private isExpired(record: SessionRecord<T>) {
    return this.now() - record.lastSeenAt > this.ttlMs
  }

  private enforceCapacity() {
    while (this.sessions.size > this.maxSessions) {
      const oldest = Array.from(this.sessions.entries())
        .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)[0]

      if (!oldest) return
      this.delete(oldest[0], 'capacity')
    }
  }

  private notifyEviction(sessionId: string, value: T, reason: 'expired' | 'closed' | 'capacity') {
    if (!this.onEvict) return

    Promise.resolve(this.onEvict(sessionId, value, reason)).catch(() => {
      // Session eviction cleanup is best-effort. Callers should not fail because
      // a transport close hook failed after the session was already removed.
    })
  }
}
