import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'
import { migrations, runMigrations, type Migration } from '../src/database/migrations'

describe('database migrations', () => {
  it('applies core migrations idempotently', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gar-ii-migrations-'))
    const client = createClient({ url: `file:${join(tempDir, 'test.db')}` })

    try {
      const first = await runMigrations(client)
      const second = await runMigrations(client)
      const tables = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
      const tableNames = tables.rows.map((row: any) => row.name)

      expect(first.applied).toEqual(migrations.map(migration => migration.id))
      expect(second.applied).toEqual([])
      expect(second.skipped).toEqual(migrations.map(migration => migration.id))
      expect(tableNames).toEqual(expect.arrayContaining([
        'schema_migrations',
        'memory',
        'tool_calls',
        'oauth_clients',
        'auth_codes',
        'notes',
      ]))
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects edited migrations whose checksum no longer matches', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'gar-ii-migrations-mismatch-'))
    const client = createClient({ url: `file:${join(tempDir, 'test.db')}` })
    const original: Migration = {
      id: '0001_test',
      description: 'test migration',
      statements: ['CREATE TABLE IF NOT EXISTS example (id TEXT PRIMARY KEY)'],
    }
    const edited: Migration = {
      ...original,
      statements: ['CREATE TABLE IF NOT EXISTS example (id TEXT PRIMARY KEY, name TEXT)'],
    }

    try {
      await runMigrations(client, [original])
      await expect(runMigrations(client, [edited])).rejects.toThrow('Migration checksum mismatch')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
