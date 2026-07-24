import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const memory = sqliteTable('memory', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  namespace: text('namespace').default('default'),
  expiresAt: integer('expires_at'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
})

export const toolCalls = sqliteTable('tool_calls', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  toolId: text('tool_id').notNull(),
  action: text('action').notNull(),
  input: text('input').notNull(),
  output: text('output'),
  durationMs: integer('duration_ms'),
  error: text('error'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
})

export const oauthClients = sqliteTable('oauth_clients', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  redirectUris: text('redirect_uris').notNull(),
  name: text('name'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
})

export const authCodes = sqliteTable('auth_codes', {
  code: text('code').primaryKey(),
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge'),
  state: text('state'),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
})

// Notes table (for the Notes module)
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  tags: text('tags').default('[]'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
})