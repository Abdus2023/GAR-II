import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import hub, { bootstrap } from './index'
import { config } from './config'
import { logger } from './logger'

const port = config.port

function headersFromIncoming(headers: Record<string, string | string[] | undefined>) {
  const result = new Headers()

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(key, item)
    } else if (value !== undefined) {
      result.set(key, value)
    }
  }

  return result
}

const server = createServer(async (incoming, outgoing) => {
  const method = incoming.method || 'GET'
  const host = incoming.headers.host || `localhost:${port}`
  const url = new URL(incoming.url || '/', `http://${host}`)

  try {
    const request = new Request(url, {
      method,
      headers: headersFromIncoming(incoming.headers),
      body: method === 'GET' || method === 'HEAD'
        ? undefined
        : Readable.toWeb(incoming) as ReadableStream,
      // Required by Node.js when passing a streaming request body to fetch-compatible APIs.
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })

    const response = await hub.fetch(request)

    outgoing.statusCode = response.status
    response.headers.forEach((value, key) => outgoing.setHeader(key, value))

    if (method === 'HEAD' || !response.body) {
      outgoing.end()
      return
    }

    Readable.fromWeb(response.body as any).pipe(outgoing)
  } catch (error: any) {
    logger.error({ error: error.message }, 'Unhandled Node HTTP adapter error')

    if (!outgoing.headersSent) {
      outgoing.statusCode = 500
      outgoing.setHeader('content-type', 'application/json')
    }

    outgoing.end(JSON.stringify({ error: 'internal_server_error' }))
  }
})

async function main() {
  await bootstrap()

  server.listen(port, () => {
    logger.info({ port }, 'Claude Hub Gateway listening')
  })
}

void main().catch((error: any) => {
  logger.error({ error: error.message }, 'Failed to start Claude Hub Gateway')
  process.exitCode = 1
})
