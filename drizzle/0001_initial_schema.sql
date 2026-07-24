CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  namespace TEXT DEFAULT 'default',
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS memory_user_key_idx ON memory (user_id, key);
CREATE INDEX IF NOT EXISTS memory_user_namespace_idx ON memory (user_id, namespace);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  action TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT,
  duration_ms INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tool_calls_user_created_idx ON tool_calls (user_id, created_at);

CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT,
  state TEXT,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_codes_client_idx ON auth_codes (client_id);
CREATE INDEX IF NOT EXISTS auth_codes_expires_idx ON auth_codes (expires_at);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_user_title_idx ON notes (user_id, title);
