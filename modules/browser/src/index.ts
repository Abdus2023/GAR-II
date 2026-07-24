import { z } from 'zod'
import { config } from '../../../src/config'
import type { Module, ModuleContext, Tool } from '../../../src/kernel/types'

const BrowserUrl = z.string().url().refine(value => {
  const protocol = new URL(value).protocol
  return protocol === 'http:' || protocol === 'https:'
}, 'Only http:// and https:// URLs are supported')

const OpenPageInput = z.object({
  url: BrowserUrl,
  max_bytes: z.number().int().min(1_000).max(5_000_000).default(config.browserMaxBytes),
})

const ExtractContentInput = z.object({
  url: BrowserUrl,
  selector: z.string().min(1),
  max_bytes: z.number().int().min(1_000).max(5_000_000).default(config.browserMaxBytes),
})

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function stripDangerousBlocks(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
}

function htmlToText(html: string) {
  const withLineBreaks = stripDangerousBlocks(html)
    .replace(/<\/(p|div|section|article|header|footer|main|aside|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtmlEntities(withLineBreaks)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncate(text: string, maxBytes: number) {
  const buffer = Buffer.from(text, 'utf8')
  if (buffer.byteLength <= maxBytes) {
    return { text, truncated: false }
  }

  return {
    text: `${buffer.subarray(0, maxBytes).toString('utf8')}\n\n[truncated ${buffer.byteLength - maxBytes} bytes]`,
    truncated: true,
  }
}

function titleFromHtml(html: string) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  return match ? htmlToText(match[1]) : undefined
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractBySelector(html: string, selector: string) {
  const trimmed = selector.trim()

  if (trimmed === 'title') {
    return titleFromHtml(html) || ''
  }

  const metaMatch = trimmed.match(/^meta\[name=["']?([^"'\]]+)["']?\]$/i)
  if (metaMatch) {
    const name = escapeRegex(metaMatch[1])
    const match = html.match(new RegExp(`<meta\\b(?=[^>]*\\bname=["']${name}["'])(?=[^>]*\\bcontent=["']([^"']*)["'])[^>]*>`, 'i'))
    return match ? decodeHtmlEntities(match[1]).trim() : ''
  }

  if (/^[a-z][a-z0-9-]*$/i.test(trimmed)) {
    const tag = escapeRegex(trimmed)
    const matches = Array.from(html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')))
    return matches.map(match => htmlToText(match[1])).filter(Boolean).join('\n\n')
  }

  if (trimmed.startsWith('#')) {
    const id = escapeRegex(trimmed.slice(1))
    const match = html.match(new RegExp(`<([a-z][a-z0-9-]*)\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'))
    return match ? htmlToText(match[2]) : ''
  }

  if (trimmed.startsWith('.')) {
    const className = escapeRegex(trimmed.slice(1))
    const matches = Array.from(html.matchAll(new RegExp(`<([a-z][a-z0-9-]*)\\b(?=[^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'])[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi')))
    return matches.map(match => htmlToText(match[2])).filter(Boolean).join('\n\n')
  }

  throw new Error(`Unsupported selector: ${selector}. Supported selectors: tag, #id, .class, title, meta[name=...]`)
}

export default class BrowserModule implements Module {
  private ctx!: ModuleContext

  manifest() {
    return {
      id: 'browser',
      version: '1.0.0',
      permissions: ['browser.read'],
      dependencies: ['auth'],
    }
  }

  async initialize(ctx: ModuleContext) {
    this.ctx = ctx
    this.ctx.logger.info('Browser module initialized with fetch-based page reader')
  }

  tools(): Tool[] {
    return [
      {
        id: 'open_page',
        description: 'Open a web page and return readable text content',
        inputSchema: OpenPageInput,
        execute: this.openPage.bind(this),
      },
      {
        id: 'extract_content',
        description: 'Extract content from a page using a simple selector: tag, #id, .class, title, meta[name=...]',
        inputSchema: ExtractContentInput,
        execute: this.extractContent.bind(this),
      },
    ]
  }

  private async fetchPage(url: string, maxBytes: number) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.browserFetchTimeoutMs)

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html, text/plain;q=0.9, */*;q=0.1',
          'user-agent': 'Claude-Hub-Gateway/0.1 (+https://github.com/Abdus2023/GAR-II)',
        },
        signal: controller.signal,
      })

      const contentType = response.headers.get('content-type') || ''
      const contentLength = Number(response.headers.get('content-length') || '0')
      if (contentLength && contentLength > maxBytes * 5) {
        throw new Error(`Response too large: ${contentLength} bytes`)
      }

      const raw = await response.text()
      return {
        response,
        contentType,
        raw,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  private async openPage({ url, max_bytes }: z.infer<typeof OpenPageInput>) {
    const maxBytes = max_bytes ?? config.browserMaxBytes
    const { response, contentType, raw } = await this.fetchPage(url, maxBytes)
    const content = contentType.includes('html') ? htmlToText(raw) : raw.trim()
    const truncated = truncate(content, maxBytes)

    return {
      success: response.ok,
      url,
      status: response.status,
      content_type: contentType,
      title: contentType.includes('html') ? titleFromHtml(raw) : undefined,
      content: truncated.text,
      truncated: truncated.truncated,
    }
  }

  private async extractContent({ url, selector, max_bytes }: z.infer<typeof ExtractContentInput>) {
    const maxBytes = max_bytes ?? config.browserMaxBytes
    const { response, contentType, raw } = await this.fetchPage(url, maxBytes)
    if (!contentType.includes('html') && !contentType.includes('xml') && !contentType.includes('text')) {
      throw new Error(`Unsupported content type for extraction: ${contentType}`)
    }

    const extracted = contentType.includes('html') || contentType.includes('xml')
      ? extractBySelector(raw, selector)
      : raw.trim()
    const truncated = truncate(extracted, maxBytes)

    return {
      success: response.ok,
      url,
      selector,
      status: response.status,
      content_type: contentType,
      content: truncated.text,
      truncated: truncated.truncated,
    }
  }

  async shutdown() {
    this.ctx.logger.info('Browser module shutting down')
  }
}
