import { beforeAll, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import hub, { app, bootstrap } from '../src/index'

async function issueMcpToken() {
  const registerResponse = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'MCP E2E Test Client',
      redirect_uris: ['http://localhost/mcp-e2e/callback'],
    }),
  })
  const registered = await registerResponse.json()

  const tokenResponse = await app.request('/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: registered.client_id,
      client_secret: registered.client_secret,
    }),
  })
  const token = await tokenResponse.json()
  return token.access_token as string
}

function createInProcessFetch(token: string) {
  return async (input: URL | RequestInfo, init?: RequestInit) => {
    const request = input instanceof Request
      ? input
      : new Request(input, init)
    const headers = new Headers(request.headers)
    headers.set('authorization', `Bearer ${token}`)

    return hub.fetch(new Request(request, { headers }))
  }
}

describe('MCP Streamable HTTP e2e', () => {
  let token: string

  beforeAll(async () => {
    await bootstrap()
    token = await issueMcpToken()
  })

  it('connects with an MCP client, lists tools, and calls workspace', async () => {
    const client = new Client({
      name: 'mcp-e2e-test',
      version: '0.1.0',
    })
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
      fetch: createInProcessFetch(token),
    })

    try {
      await client.connect(transport)

      const tools = await client.listTools()
      expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining(['workspace', '_search_tools']))

      const result = await client.callTool({
        name: 'workspace',
        arguments: {
          action: 'echo',
          params: { message: 'hello mcp' },
        },
      })

      expect(result.isError).toBeFalsy()
      expect(result.content?.[0]?.type).toBe('text')
      expect(JSON.parse((result.content?.[0] as any).text)).toMatchObject({
        success: true,
        message: 'Echo: hello mcp',
      })
    } finally {
      await client.close()
    }
  })
})
