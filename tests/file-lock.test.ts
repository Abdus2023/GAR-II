import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { FileLock, FileLockTimeoutError } from '../src/memory/file-lock'

describe('FileLock', () => {
  it('provides exclusive access and releases locks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gar-ii-file-lock-'))
    const lockPath = join(root, 'resource.lock')

    try {
      const first = new FileLock(lockPath, { timeoutMs: 100, pollIntervalMs: 10 })
      const second = new FileLock(lockPath, { timeoutMs: 100, pollIntervalMs: 10 })
      const release = await first.acquire()

      await expect(second.acquire()).rejects.toBeInstanceOf(FileLockTimeoutError)
      await release()

      const releaseSecond = await second.acquire()
      await releaseSecond()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('removes stale locks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gar-ii-file-lock-stale-'))
    const lockPath = join(root, 'resource.lock')

    try {
      const first = new FileLock(lockPath, { timeoutMs: 100, staleMs: 1, pollIntervalMs: 10 })
      const release = await first.acquire()
      // Intentionally do not release before acquiring with a stale timeout.
      await new Promise(resolve => setTimeout(resolve, 5))

      const second = new FileLock(lockPath, { timeoutMs: 200, staleMs: 1, pollIntervalMs: 10 })
      const releaseSecond = await second.acquire()
      await releaseSecond()
      await release()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
