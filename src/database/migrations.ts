import { createHash } from 'node:crypto'

export interface Migration {
  id: string
  description: string
  statements: string[]
}

export interface MigrationClient {
  execute(statement: any): Promise<any>
}

export interface MigrationResult {
  applied: string[]
  skipped: string[]
}

export const migrations: Migration[] = [
  {
    id: '0001_initial_schema',
    description: 'Create core memory, audit, OAuth, and notes tables',
    statements: [
      `CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        namespace TEXT DEFAULT 'default',
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS memory_user_key_idx ON memory (user_id, key)`,
      `CREATE INDEX IF NOT EXISTS memory_user_namespace_idx ON memory (user_id, namespace)`,

      `CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        action TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT,
        duration_ms INTEGER,
        error TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS tool_calls_user_created_idx ON tool_calls (user_id, created_at)`,

      `CREATE TABLE IF NOT EXISTS oauth_clients (
        id TEXT PRIMARY KEY,
        secret TEXT NOT NULL,
        redirect_uris TEXT NOT NULL,
        name TEXT,
        created_at INTEGER NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS auth_codes (
        code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        code_challenge TEXT,
        state TEXT,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS auth_codes_client_idx ON auth_codes (client_id)`,
      `CREATE INDEX IF NOT EXISTS auth_codes_expires_idx ON auth_codes (expires_at)`,

      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS notes_user_title_idx ON notes (user_id, title)`,
    ],
  },
]

function checksumMigration(migration: Migration) {
  return createHash('sha256')
    .update(migration.id)
    .update('\n')
    .update(migration.description)
    .update('\n')
    .update(migration.statements.join('\n-- statement --\n'))
    .digest('hex')
}

async function ensureMigrationTable(client: MigrationClient) {
  await client.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    description TEXT,
    applied_at INTEGER NOT NULL
  )`)
}

async function getAppliedMigrations(client: MigrationClient) {
  const result = await client.execute('SELECT id, checksum FROM schema_migrations')
  const rows = result.rows || []
  return new Map<string, string>(
    rows.map((row: any) => [String(row.id), String(row.checksum)])
  )
}

export async function runMigrations(
  client: MigrationClient,
  migrationList: Migration[] = migrations
): Promise<MigrationResult> {
  await ensureMigrationTable(client)

  const appliedMigrations = await getAppliedMigrations(client)
  const result: MigrationResult = {
    applied: [],
    skipped: [],
  }

  for (const migration of migrationList) {
    const checksum = checksumMigration(migration)
    const appliedChecksum = appliedMigrations.get(migration.id)

    if (appliedChecksum) {
      if (appliedChecksum !== checksum) {
        throw new Error(
          `Migration checksum mismatch for ${migration.id}. ` +
          'Create a new migration instead of editing applied migrations.'
        )
      }

      result.skipped.push(migration.id)
      continue
    }

    for (const statement of migration.statements) {
      await client.execute(statement)
    }

    await client.execute({
      sql: 'INSERT INTO schema_migrations (id, checksum, description, applied_at) VALUES (?, ?, ?, ?)',
      args: [migration.id, checksum, migration.description, Date.now()],
    })

    result.applied.push(migration.id)
  }

  return result
}
