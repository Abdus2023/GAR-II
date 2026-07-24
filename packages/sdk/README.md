# @claude-hub/sdk

Typed SDK for writing Claude Hub Gateway capability plugins.

## Install

```bash
npm install @claude-hub/sdk
```

## Example

```ts
import { BasePlugin, definePlugin } from '@claude-hub/sdk'

export default definePlugin(new class EchoPlugin extends BasePlugin {
  manifest() {
    return {
      id: 'example.echo',
      name: 'Example Echo Plugin',
      version: '0.1.0',
      description: 'Minimal plugin example',
    }
  }

  tools() {
    return [
      {
        id: 'example.echo',
        description: 'Echo a message',
        execute: async (input: { message: string }) => ({
          message: input.message,
        }),
      },
    ]
  }
})
```

## Build

```bash
npm run build
```
