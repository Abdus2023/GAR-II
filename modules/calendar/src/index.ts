import { z } from 'zod'
import { config } from '../../../src/config'
import type { Module, ModuleContext, Tool } from '../../../src/kernel/types'

interface CalendarEventDateTime {
  date?: string
  dateTime?: string
  timeZone?: string
}

interface CalendarEvent {
  id?: string
  summary?: string
  description?: string
  htmlLink?: string
  status?: string
  start?: CalendarEventDateTime
  end?: CalendarEventDateTime
  creator?: { email?: string; displayName?: string }
  organizer?: { email?: string; displayName?: string }
}

export interface CalendarClient {
  listEvents(input: {
    calendarId: string
    timeMin: string
    timeMax: string
    maxResults: number
  }): Promise<CalendarEvent[]>
  createEvent(input: {
    calendarId: string
    title: string
    start: string
    end: string
    description?: string
    timeZone?: string
  }): Promise<CalendarEvent>
}

const ListEventsInput = z.object({
  days: z.number().int().min(1).max(365).default(7),
  max_results: z.number().int().min(1).max(250).default(25),
  calendar_id: z.string().min(1).optional(),
})

const CreateEventInput = z.object({
  title: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  description: z.string().default(''),
  calendar_id: z.string().min(1).optional(),
  time_zone: z.string().min(1).optional(),
}).refine(input => Date.parse(input.end) > Date.parse(input.start), {
  message: 'Event end must be after start',
  path: ['end'],
})

function normalizeEvent(event: CalendarEvent) {
  return {
    id: event.id,
    title: event.summary || '(untitled)',
    description: event.description,
    status: event.status,
    url: event.htmlLink,
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    creator: event.creator?.displayName || event.creator?.email,
    organizer: event.organizer?.displayName || event.organizer?.email,
  }
}

export class GoogleCalendarClient implements CalendarClient {
  constructor(
    private readonly accessToken: string | undefined = config.googleCalendarAccessToken,
    private readonly baseUrl = config.googleCalendarApiBaseUrl,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  private requireAccessToken() {
    if (!this.accessToken) {
      throw new Error('GOOGLE_CALENDAR_ACCESS_TOKEN is required for calendar operations')
    }

    return this.accessToken
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.requireAccessToken()}`,
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Google Calendar API failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`)
    }

    return response.json() as Promise<T>
  }

  async listEvents(input: {
    calendarId: string
    timeMin: string
    timeMax: string
    maxResults: number
  }) {
    const params = new URLSearchParams({
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      maxResults: String(input.maxResults),
      singleEvents: 'true',
      orderBy: 'startTime',
    })
    const calendarId = encodeURIComponent(input.calendarId)
    const response = await this.request<{ items?: CalendarEvent[] }>(`/calendars/${calendarId}/events?${params}`)
    return response.items || []
  }

  async createEvent(input: {
    calendarId: string
    title: string
    start: string
    end: string
    description?: string
    timeZone?: string
  }) {
    const calendarId = encodeURIComponent(input.calendarId)
    return this.request<CalendarEvent>(`/calendars/${calendarId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        summary: input.title,
        description: input.description || undefined,
        start: {
          dateTime: input.start,
          timeZone: input.timeZone,
        },
        end: {
          dateTime: input.end,
          timeZone: input.timeZone,
        },
      }),
    })
  }
}

export default class CalendarModule implements Module {
  private ctx!: ModuleContext

  constructor(private readonly client: CalendarClient = new GoogleCalendarClient()) {}

  manifest() {
    return {
      id: 'calendar',
      version: '1.0.0',
      permissions: ['calendar.read', 'calendar.write'],
      dependencies: ['auth'],
    }
  }

  async initialize(ctx: ModuleContext) {
    this.ctx = ctx
    this.ctx.logger.info(
      { configured: Boolean(config.googleCalendarAccessToken) },
      'Calendar module initialized with Google Calendar client'
    )
  }

  tools(): Tool[] {
    return [
      {
        id: 'list_events',
        description: 'List upcoming Google Calendar events',
        inputSchema: ListEventsInput,
        execute: this.listEvents.bind(this),
      },
      {
        id: 'create_event',
        description: 'Create a new Google Calendar event',
        inputSchema: CreateEventInput,
        execute: this.createEvent.bind(this),
      },
    ]
  }

  private async listEvents(input: z.infer<typeof ListEventsInput>) {
    const days = input.days ?? 7
    const maxResults = input.max_results ?? 25
    const now = new Date()
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const calendarId = input.calendar_id || config.googleCalendarId
    const events = await this.client.listEvents({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      maxResults,
    })

    return {
      success: true,
      calendar_id: calendarId,
      days,
      events: events.map(normalizeEvent),
    }
  }

  private async createEvent(input: z.infer<typeof CreateEventInput>) {
    const calendarId = input.calendar_id || config.googleCalendarId
    const event = await this.client.createEvent({
      calendarId,
      title: input.title,
      start: input.start,
      end: input.end,
      description: input.description || '',
      timeZone: input.time_zone,
    })

    this.ctx.events.emit('calendar:event_created', {
      calendarId,
      eventId: event.id,
      title: event.summary,
    })

    return {
      success: true,
      calendar_id: calendarId,
      event: normalizeEvent(event),
    }
  }

  async shutdown() {
    this.ctx.logger.info('Calendar module shutting down')
  }
}
