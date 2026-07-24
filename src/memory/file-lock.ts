import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

export interface FileLockOptions {
  timeoutMs?: number
  staleMs?: number
  pollIntervalMs?: number
  metadata?: Record<string, unknown>
}

export class FileLockTimeoutError extends Error {
  constructor(lockPath: string, timeoutMs: number) {
    super(`Timed out acquiring file lock ${lockPath} after ${timeoutMs}ms`)
    this.name = 'FileLockTimeoutError'
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Cross-process advisory lock using atomic directory creation.
 *
 * `mkdir(lockPath)` is atomic on local filesystems. This simple lock is sufficient
 * for guarding embedded LanceDB file access across multiple Node processes.
 */
export class FileLock {
  readonly lockPath: string
  private readonly timeoutMs: number
  private readonly staleMs: number
  private readonly pollIntervalMs: number
  private readonly metadata: Record<string, unknown>

  constructor(lockPath: string, options: FileLockOptions = {}) {
    this.lockPath = resolve(lockPath)
    this.timeoutMs = options.timeoutMs ?? 5_000
    this.staleMs = options.staleMs ?? 60_000
    this.pollIntervalMs = options.pollIntervalMs ?? 50
    this.metadata = options.metadata || {}
  }

  async acquire(): Promise<() => Promise<void>> {
    const start = Date.now()

    while (true) {
      try {
        await mkdir(dirname(this.lockPath), { recursive: true })
        await mkdir(this.lockPath)
        await writeFile(join(this.lockPath, 'owner.json'), JSON.stringify({
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
          ...this.metadata,
        }, null, 2))

        let released = false
        return async () => {
          if (released) return
          released = true
          await rm(this.lockPath, { recursive: true, force: true })
        }
      } catch (error: any) {
        if (error?.code !== 'EEXIST') {
          throw error
        }

        await this.removeIfStale()

        if (Date.now() - start >= this.timeoutMs) {
          throw new FileLockTimeoutError(this.lockPath, this.timeoutMs)
        }

        await sleep(this.pollIntervalMs)
      }
    }
  }

  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire()

    try {
      return await fn()
    } finally {
      await release()
    }
  }

  private async removeIfStale() {
    try {
      const stats = await stat(this.lockPath)
      const ageMs = Date.now() - stats.mtimeMs

      if (ageMs > this.staleMs) {
        await rm(this.lockPath, { recursive: true, force: true })
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
    }
  }
}
