import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: {
    service: 'claude-hub',
    version: '0.1.0',
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: ['*.token', '*.password', '*.secret', '*.api_key'],
    censor: '[REDACTED]',
  },
})