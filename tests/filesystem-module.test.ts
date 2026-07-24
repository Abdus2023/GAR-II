import { rm } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { Kernel } from '../src/kernel'

describe('FilesystemModule', () => {
  it('keeps file operations inside the configured workspace and creates parent directories', async () => {
    const kernel = new Kernel({ auditLogging: false })
    await kernel.start()

    const dir = `fs-test-${crypto.randomUUID()}`
    const path = `${dir}/nested/hello.txt`

    try {
      const writeResult = await kernel.invoke(
        'filesystem.write_file',
        { path, content: 'hello workspace', confirm: true },
        { userId: 'fs-test' }
      )
      expect(writeResult).toMatchObject({ success: true, bytes_written: 15 })

      const readResult = await kernel.invoke(
        'filesystem.read_file',
        { path },
        { userId: 'fs-test' }
      )
      expect(readResult).toMatchObject({ success: true, content: 'hello workspace' })

      const traversalResult = await kernel.invoke(
        'filesystem.write_file',
        { path: `../${dir}-escape.txt`, content: 'nope', confirm: true },
        { userId: 'fs-test' }
      )
      expect(traversalResult).toMatchObject({
        success: false,
        error: 'write_error',
      })
      expect(traversalResult.message).toContain('escapes')
    } finally {
      await rm(`workspace/${dir}`, { recursive: true, force: true })
    }
  })
})
