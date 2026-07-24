import { rm } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { Kernel } from '../src/kernel'

describe('Kernel confirmation gate', () => {
  it('requires explicit confirmation for high-impact write actions', async () => {
    const kernel = new Kernel({ auditLogging: false })
    await kernel.start()

    await expect(
      kernel.invoke(
        'filesystem.write_file',
        { path: 'confirmation-test/blocked.txt', content: 'blocked' },
        { userId: 'confirmation-test' }
      )
    ).rejects.toMatchObject({
      code: 'AUTHORIZATION_ERROR',
      status: 403,
    })
  })

  it('allows confirmed high-impact write actions and strips confirmation before execution', async () => {
    const kernel = new Kernel({ auditLogging: false })
    await kernel.start()

    try {
      const result = await kernel.invoke(
        'filesystem.write_file',
        {
          path: 'confirmation-test/allowed.txt',
          content: 'allowed',
          confirm: true,
        },
        { userId: 'confirmation-test' }
      )

      expect(result).toMatchObject({
        success: true,
        path: 'confirmation-test/allowed.txt',
        bytes_written: 7,
      })
    } finally {
      await rm('workspace/confirmation-test', { recursive: true, force: true })
    }
  })

  it('marks confirmation-required tools in registry metadata', async () => {
    const kernel = new Kernel({ auditLogging: false })
    await kernel.start()

    const filesystemWrite = kernel.getRegisteredToolMetadata()
      .find(tool => tool.id === 'filesystem.write_file')
    const echo = kernel.getRegisteredToolMetadata()
      .find(tool => tool.id === 'echo')

    expect(filesystemWrite).toMatchObject({ requiresConfirmation: true })
    expect(echo).toMatchObject({ requiresConfirmation: false })
  })
})
