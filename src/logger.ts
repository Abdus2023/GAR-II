import pino from 'pino'
import { config } from './config'

export const logger = pino({
  level: config.logLevel,
  base: {
    service: 'claude-hub',
    version: '0.1.0',
    env: config.nodeEnv,
  },
  redact: {
    paths: ['*.token', '*.password', '*.secret', '*.api_key'],
    censor: '[REDACTED]',
  },
})