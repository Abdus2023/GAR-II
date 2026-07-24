import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { Kernel } from '../src/kernel'

describe('Kernel tool timeout', () => {
  it('fails direct tool invocations that exceed the configured timeout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gar-ii-timeout-module-'))
    const moduleRoot = join(root, 'slow')

    try {
      await mkdir(moduleRoot, { recursive: true })
      await writeFile(join(moduleRoot, 'index.js'), `
        export default class SlowModule {
          manifest() { return { id: 'slow', version: '1.0.0', permissions: [], dependencies: [] } }
          async initialize(ctx) { this.ctx = ctx }
          tools() {
            return [{
              id: 'never',
              description: 'Never resolves',
              execute: () => new Promise(() => {})
            }]
          }
        }
      `)

      const kernel = new Kernel({
        modulesDir: root,
        auditLogging: false,
        toolTimeoutMs: 25,
      })
      await kernel.start()

      await expect(
        kernel.invoke('slow.never', {}, { userId: 'timeout-test' })
      ).rejects.toMatchObject({
        code: 'CAPABILITY_FAILED',
        status: 504,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
