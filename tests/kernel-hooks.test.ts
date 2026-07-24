import { describe, expect, it } from 'vitest'
import { Kernel } from '../src/kernel'

describe('Kernel invocation hooks', () => {
  it('allows before hooks to mutate input and after hooks to observe results', async () => {
    const kernel = new Kernel({ autoLoadModules: false, auditLogging: false })
    const observed: any[] = []

    kernel.registerHook('beforeInvoke', invocation => {
      if (invocation.action !== 'echo') return
      return {
        params: {
          ...invocation.params,
          message: `${invocation.params.message} via hook`,
        },
      }
    })

    kernel.registerHook('afterInvoke', invocation => {
      observed.push({
        action: invocation.action,
        result: invocation.result,
      })
    })

    await kernel.start()
    const result = await kernel.invoke('echo', { message: 'hello' }, { userId: 'hook-test' })

    expect(result).toMatchObject({ message: 'Echo: hello via hook' })
    expect(observed).toEqual([
      {
        action: 'echo',
        result: expect.objectContaining({ message: 'Echo: hello via hook' }),
      },
    ])
  })

  it('blocks write actions containing secrets for all invocation entrypoints', async () => {
    const kernel = new Kernel({ autoLoadModules: false, auditLogging: false })
    await kernel.start()

    await expect(
      kernel.invoke(
        'memory.set',
        {
          key: 'unsafe-config',
          value: {
            clientSecret: 'super-secret-value',
          },
        },
        { userId: 'hook-test' }
      )
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      status: 400,
    })
  })
})
