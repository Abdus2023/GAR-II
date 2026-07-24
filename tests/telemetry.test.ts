import { describe, expect, it } from 'vitest'
import { Telemetry } from '../src/telemetry'

describe('Telemetry', () => {
  it('exports completed spans as OTLP JSON', async () => {
    const requests: any[] = []
    const telemetry = new Telemetry({
      enabled: true,
      serviceName: 'test-service',
      endpoint: 'http://collector.example',
      exportIntervalMs: 60_000,
      fetchImpl: (async (url: string, init: RequestInit) => {
        requests.push({ url, init })
        return new Response(null, { status: 200 })
      }) as any,
    })

    await telemetry.withSpan('test.span', { answer: 42, ok: true }, async span => {
      span.setAttribute('custom', 'value')
    })

    expect(telemetry.pendingSpanCount()).toBe(1)
    await telemetry.flush()

    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('http://collector.example/v1/traces')
    const payload = JSON.parse(requests[0].init.body)
    const exportedSpan = payload.resourceSpans[0].scopeSpans[0].spans[0]

    expect(payload.resourceSpans[0].resource.attributes).toEqual([
      { key: 'service.name', value: { stringValue: 'test-service' } },
    ])
    expect(exportedSpan).toMatchObject({
      name: 'test.span',
      kind: 1,
      status: { code: 1 },
    })
    expect(exportedSpan.traceId).toHaveLength(32)
    expect(exportedSpan.spanId).toHaveLength(16)
    expect(exportedSpan.attributes).toEqual(expect.arrayContaining([
      { key: 'answer', value: { intValue: '42' } },
      { key: 'ok', value: { boolValue: true } },
      { key: 'custom', value: { stringValue: 'value' } },
    ]))
    expect(telemetry.pendingSpanCount()).toBe(0)
  })

  it('keeps spans queued when export fails', async () => {
    const telemetry = new Telemetry({
      enabled: true,
      endpoint: 'http://collector.example',
      fetchImpl: (async () => new Response(null, { status: 503, statusText: 'Unavailable' })) as any,
    })

    await telemetry.withSpan('failed.export', {}, async () => {})
    await expect(telemetry.flush()).rejects.toThrow('OTLP trace export failed')
    expect(telemetry.pendingSpanCount()).toBe(1)
  })
})
