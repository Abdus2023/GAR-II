import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { config } from '../config'
import { runMigrations } from './migrations'
import * as schema from './schema'

export const client = createClient({
  url: config.tursoDatabaseUrl,
  authToken: config.tursoAuthToken,
})

export const db = drizzle(client, { schema })

let initializationPromise: Promise<void> | null = null

/**
 * Idempotently applies database migrations.
 *
 * The migration runner keeps local SQLite quickstarts and Turso deployments in
 * sync without relying on ad-hoc table bootstrap code. The Drizzle schema remains
 * the TypeScript source of truth, while migrations preserve deploy-time history.
 */
export function initializeDatabase() {
  initializationPromise ??= runMigrations(client).then(() => undefined)
  return initializationPromise
}

export * from './migrations'
export * from './schema'
