import { describe, expect, it } from 'vitest'
import { Kernel } from '../src/kernel'

describe('Kernel capability module loader', () => {
  it('loads repository capability modules and registers namespaced tools', async () => {
    const kernel = new Kernel({ auditLogging: false })

    await kernel.start()

    expect(kernel.getLoadedModules()).toEqual(expect.arrayContaining([
      'browser',
      'calendar',
      'echo',
      'filesystem',
      'github',
      'notes',
      'search',
    ]))

    expect(kernel.getRegisteredTools()).toEqual(expect.arrayContaining([
      'browser.open_page',
      'calendar.list_events',
      'echo.echo',
      'filesystem.read_file',
      'filesystem.write_file',
      'github.search_repo',
      'github.read_file',
      'github.review_pr',
      'github.create_issue',
      'memory.get',
      'notes.create',
      'search.query',
    ]))
  })

  it('validates and invokes dynamically registered module tools', async () => {
    const kernel = new Kernel({ auditLogging: false })

    await kernel.start()

    const result = await kernel.invoke(
      'echo.echo',
      { message: 'dynamic module call' },
      { userId: 'test-user' }
    )

    expect(result).toMatchObject({
      success: true,
      message: 'Echo: dynamic module call',
    })
  })
})
