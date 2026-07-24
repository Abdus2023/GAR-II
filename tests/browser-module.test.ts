import { afterEach, describe, expect, it, vi } from 'vitest'
import BrowserModule from '../modules/browser/src/index'

const context = () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  events: { emit: vi.fn() },
  config: {},
  cache: new Map(),
  invoke: vi.fn(),
})

function mockFetch(html: string, headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' }) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(html, { status: 200, headers })))
}

describe('BrowserModule', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens an HTML page and returns readable text', async () => {
    mockFetch(`<!doctype html>
      <html>
        <head><title>Example Page</title><style>body{}</style></head>
        <body><h1>Hello Browser</h1><script>alert('x')</script><p>Readable content &amp; entities.</p></body>
      </html>`)
    const module = new BrowserModule()
    await module.initialize(context())
    const tool = module.tools().find(tool => tool.id === 'open_page')!

    const result = await tool.execute({ url: 'https://example.com' }, { userId: 'test-user' })

    expect(result).toMatchObject({
      success: true,
      url: 'https://example.com',
      status: 200,
      title: 'Example Page',
      truncated: false,
    })
    expect(result.content).toContain('Hello Browser')
    expect(result.content).toContain('Readable content & entities.')
    expect(result.content).not.toContain('alert')
  })

  it('extracts content using simple selectors', async () => {
    mockFetch(`<!doctype html><html><head><title>Selector Page</title></head><body>
      <main id="content"><p class="summary">First summary.</p><p class="summary">Second summary.</p></main>
    </body></html>`)
    const module = new BrowserModule()
    await module.initialize(context())
    const tool = module.tools().find(tool => tool.id === 'extract_content')!

    const titleResult = await tool.execute({ url: 'https://example.com', selector: 'title' }, { userId: 'test-user' })
    const classResult = await tool.execute({ url: 'https://example.com', selector: '.summary' }, { userId: 'test-user' })
    const idResult = await tool.execute({ url: 'https://example.com', selector: '#content' }, { userId: 'test-user' })

    expect(titleResult.content).toBe('Selector Page')
    expect(classResult.content).toContain('First summary.')
    expect(classResult.content).toContain('Second summary.')
    expect(idResult.content).toContain('First summary.')
  })

  it('rejects unsupported URL schemes through tool validation', async () => {
    const module = new BrowserModule()
    await module.initialize(context())
    const tool = module.tools().find(tool => tool.id === 'open_page')!
    const parsed = tool.inputSchema.safeParse({ url: 'file:///etc/passwd' })

    expect(parsed.success).toBe(false)
  })
})
