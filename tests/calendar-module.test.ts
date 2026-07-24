import { describe, expect, it, vi } from 'vitest'
import CalendarModule, { GoogleCalendarClient } from '../modules/calendar/src/index'

const moduleContext = () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  events: { emit: vi.fn() },
  config: {},
  cache: new Map(),
  invoke: vi.fn(),
})

describe('CalendarModule', () => {
  it('lists and normalizes upcoming events through a CalendarClient', async () => {
    const client = {
      listEvents: vi.fn().mockResolvedValue([
        {
          id: 'event-1',
          summary: 'Planning Session',
          description: 'Discuss roadmap',
          htmlLink: 'https://calendar.google.com/event?eid=1',
          status: 'confirmed',
          start: { dateTime: '2026-07-24T10:00:00Z' },
          end: { dateTime: '2026-07-24T11:00:00Z' },
          creator: { email: 'owner@example.com' },
        },
      ]),
      createEvent: vi.fn(),
    }
    const module = new CalendarModule(client)

    await module.initialize(moduleContext())
    const tool = module.tools().find(tool => tool.id === 'list_events')!
    const result = await tool.execute({ days: 3, max_results: 5, calendar_id: 'team@example.com' }, { userId: 'test-user' })

    expect(client.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      calendarId: 'team@example.com',
      maxResults: 5,
    }))
    expect(result).toMatchObject({
      success: true,
      calendar_id: 'team@example.com',
      days: 3,
      events: [
        {
          id: 'event-1',
          title: 'Planning Session',
          start: '2026-07-24T10:00:00Z',
          end: '2026-07-24T11:00:00Z',
        },
      ],
    })
  })

  it('creates events through a CalendarClient and emits lifecycle events', async () => {
    const client = {
      listEvents: vi.fn(),
      createEvent: vi.fn().mockResolvedValue({
        id: 'event-2',
        summary: 'Demo',
        htmlLink: 'https://calendar.google.com/event?eid=2',
        start: { dateTime: '2026-07-24T12:00:00Z' },
        end: { dateTime: '2026-07-24T13:00:00Z' },
      }),
    }
    const module = new CalendarModule(client)
    const ctx = moduleContext()

    await module.initialize(ctx)
    const tool = module.tools().find(tool => tool.id === 'create_event')!
    const result = await tool.execute({
      calendar_id: 'team@example.com',
      title: 'Demo',
      start: '2026-07-24T12:00:00Z',
      end: '2026-07-24T13:00:00Z',
      description: 'Product demo',
    }, { userId: 'test-user' })

    expect(client.createEvent).toHaveBeenCalledWith({
      calendarId: 'team@example.com',
      title: 'Demo',
      start: '2026-07-24T12:00:00Z',
      end: '2026-07-24T13:00:00Z',
      description: 'Product demo',
      timeZone: undefined,
    })
    expect(ctx.events.emit).toHaveBeenCalledWith('calendar:event_created', {
      calendarId: 'team@example.com',
      eventId: 'event-2',
      title: 'Demo',
    })
    expect(result).toMatchObject({
      success: true,
      event: {
        id: 'event-2',
        title: 'Demo',
      },
    })
  })
})

describe('GoogleCalendarClient', () => {
  it('builds authenticated Google Calendar list requests', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as any
    const client = new GoogleCalendarClient('token-123', 'https://calendar.example/v3', fetchImpl)

    await client.listEvents({
      calendarId: 'team@example.com',
      timeMin: '2026-07-24T00:00:00Z',
      timeMax: '2026-07-25T00:00:00Z',
      maxResults: 10,
    })

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('/calendars/team%40example.com/events?')
    expect(url).toContain('singleEvents=true')
    expect(init.headers.authorization).toBe('Bearer token-123')
  })
})
