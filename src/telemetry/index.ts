import { randomBytes } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { config } from '../config'
import { logger } from '../logger'

export type TelemetryAttributeValue = string | number | boolean | null | undefined
export type TelemetryAttributes = Record<string, TelemetryAttributeValue>

type SpanStatusCode = 'UNSET' | 'OK' | 'ERROR'

type FetchLike = typeof fetch

interface CompletedSpan {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  startTimeUnixNano: string
  endTimeUnixNano: string
  attributes: TelemetryAttributes
  status: {
    code: SpanStatusCode
    message?: string
  }
}

export interface TelemetryOptions {
  enabled?: boolean
  serviceName?: string
  endpoint?: string
  exportIntervalMs?: number
  fetchImpl?: FetchLike
}

function randomHex(bytes: number) {
  return randomBytes(bytes).toString('hex')
}

function hrTimeUnixNano() {
  return (BigInt(Date.now()) * 1_000_000n).toString()
}

function sanitizeAttributes(attributes: TelemetryAttributes = {}) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined && value !== null)
  ) as Record<string, string | number | boolean>
}

function otelValue(value: string | number | boolean) {
  if (typeof value === 'boolean') return { boolValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value }
  }
  return { stringValue: value }
}

function otelStatusCode(code: SpanStatusCode) {
  if (code === 'OK') return 1
  if (code === 'ERROR') return 2
  return 0
}

export class TelemetrySpan {
  private ended = false
  private readonly startTimeUnixNano = hrTimeUnixNano()
  private status: CompletedSpan['status'] = { code: 'UNSET' }
  readonly traceId: string
  readonly spanId: string
  readonly parentSpanId?: string

  constructor(
    private readonly telemetry: Telemetry,
    readonly name: string,
    readonly attributes: TelemetryAttributes = {},
    parent?: TelemetrySpan
  ) {
    this.traceId = parent?.traceId || randomHex(16)
    this.parentSpanId = parent?.spanId
    this.spanId = randomHex(8)
  }

  setAttribute(key: string, value: TelemetryAttributeValue) {
    this.attributes[key] = value
  }

  setStatus(code: SpanStatusCode, message?: string) {
    this.status = { code, message }
  }

  recordException(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    this.setAttribute('exception.message', message)
    if (error instanceof Error && error.name) {
      this.setAttribute('exception.type', error.name)
    }
    this.setStatus('ERROR', message)
  }

  end() {
    if (this.ended) return
    this.ended = true

    this.telemetry.enqueue({
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      startTimeUnixNano: this.startTimeUnixNano,
      endTimeUnixNano: hrTimeUnixNano(),
      attributes: sanitizeAttributes(this.attributes),
      status: this.status,
    })
  }
}

export class Telemetry {
  private readonly enabled: boolean
  private readonly serviceName: string
  private readonly endpoint?: string
  private readonly exportIntervalMs: number
  private readonly fetchImpl: FetchLike
  private readonly storage = new AsyncLocalStorage<TelemetrySpan>()
  private queue: CompletedSpan[] = []
  private flushTimer: NodeJS.Timeout | undefined

  constructor(options: TelemetryOptions = {}) {
    this.enabled = options.enabled ?? false
    this.serviceName = options.serviceName || 'claude-hub'
    this.endpoint = options.endpoint?.replace(/\/$/, '')
    this.exportIntervalMs = options.exportIntervalMs ?? 5_000
    this.fetchImpl = options.fetchImpl || fetch
  }

  isEnabled() {
    return this.enabled && Boolean(this.endpoint)
  }

  currentSpan() {
    return this.storage.getStore()
  }

  startSpan(name: string, attributes: TelemetryAttributes = {}) {
    return new TelemetrySpan(this, name, attributes, this.currentSpan())
  }

  async withSpan<T>(name: string, attributes: TelemetryAttributes, fn: (span: TelemetrySpan) => Promise<T> | T): Promise<T> {
    const span = this.startSpan(name, attributes)

    return this.storage.run(span, async () => {
      try {
        const result = await fn(span)
        span.setStatus('OK')
        return result
      } catch (error) {
        span.recordException(error)
        throw error
      } finally {
        span.end()
      }
    })
  }

  enqueue(span: CompletedSpan) {
    if (!this.isEnabled()) return

    this.queue.push(span)
    this.scheduleFlush()
  }

  private scheduleFlush() {
    if (this.flushTimer) return

    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      void this.flush().catch((error: any) => {
        logger.warn({ error: error.message }, 'Telemetry export failed')
      })
    }, this.exportIntervalMs)

    this.flushTimer.unref?.()
  }

  pendingSpanCount() {
    return this.queue.length
  }

  async flush() {
    if (!this.isEnabled() || this.queue.length === 0) return

    const spans = this.queue.splice(0, this.queue.length)
    const response = await this.fetchImpl(`${this.endpoint}/v1/traces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(this.toOtlpPayload(spans)),
    })

    if (!response.ok) {
      this.queue.unshift(...spans)
      throw new Error(`OTLP trace export failed: ${response.status} ${response.statusText}`)
    }
  }

  toOtlpPayload(spans: CompletedSpan[]) {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this.serviceName } },
            ],
          },
          scopeSpans: [
            {
              scope: {
                name: 'claude-hub-gateway',
                version: '0.1.0',
              },
              spans: spans.map(span => ({
                traceId: span.traceId,
                spanId: span.spanId,
                ...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
                name: span.name,
                kind: 1,
                startTimeUnixNano: span.startTimeUnixNano,
                endTimeUnixNano: span.endTimeUnixNano,
                attributes: Object.entries(sanitizeAttributes(span.attributes)).map(([key, value]) => ({
                  key,
                  value: otelValue(value),
                })),
                status: {
                  code: otelStatusCode(span.status.code),
                  ...(span.status.message ? { message: span.status.message } : {}),
                },
              })),
            },
          ],
        },
      ],
    }
  }
}

export const telemetry = new Telemetry({
  enabled: config.otelEnabled,
  serviceName: config.otelServiceName,
  endpoint: config.otelExporterOtlpEndpoint,
  exportIntervalMs: config.otelExportIntervalMs,
})
