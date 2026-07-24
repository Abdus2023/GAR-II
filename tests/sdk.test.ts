import { describe, expect, it } from 'vitest'
import { BasePlugin, createPluginRegistry, definePlugin } from '../packages/sdk/src'

class ExamplePlugin extends BasePlugin {
  manifest() {
    return {
      id: 'example',
      name: 'Example Plugin',
      version: '0.1.0',
      description: 'Example plugin for SDK tests',
    }
  }

  tools() {
    return [
      {
        id: 'example.echo',
        description: 'Echo test input',
        execute: async (input: { message: string }) => ({ message: input.message }),
      },
    ]
  }
}

describe('@claude-hub/sdk', () => {
  it('registers plugins and exposes manifests/tools', async () => {
    const registry = createPluginRegistry()
    const plugin = definePlugin(new ExamplePlugin())

    registry.register(plugin)

    expect(registry.list()).toEqual([
      expect.objectContaining({ id: 'example', name: 'Example Plugin' }),
    ])
    expect(registry.get('example')).toBe(plugin)
    expect(registry.tools()).toEqual([
      expect.objectContaining({ id: 'example.echo' }),
    ])

    const result = await registry.tools()[0].execute({ message: 'hello' }, { userId: 'test-user' })
    expect(result).toEqual({ message: 'hello' })
  })

  it('rejects duplicate plugin IDs', () => {
    const registry = createPluginRegistry()
    registry.register(new ExamplePlugin())

    expect(() => registry.register(new ExamplePlugin())).toThrow('Plugin already registered: example')
  })
})
