import { z } from 'zod'

const emptyStringToUndefined = (value: unknown) => value === '' ? undefined : value

const parsePublicKeys = (value: unknown) => {
  if (value === '' || value === undefined || value === null) return []
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed).map((key: string) => key.replace(/\n/g, '\n'))
  }

  return trimmed.split(',').map(key => key.trim().replace(/\n/g, '\n')).filter(Boolean)
}

const ConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().int().min(1).max(65_535).default(3000),
  tursoDatabaseUrl: z.string().min(1).default('file:local.db'),
  tursoAuthToken: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  jwtSecret: z.string().default('dev-secret'),
  mcpServerUrl: z.string().url().default('http://localhost:3000'),
  githubToken: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  workspaceDir: z.string().min(1).default('./workspace'),
  executorNodeTimeoutMs: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
  kernelToolTimeoutMs: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
  authTokenTtlSeconds: z.coerce.number().int().min(60).max(86_400).default(3_600),
  rateLimitWindowMs: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
  rateLimitMaxRequests: z.coerce.number().int().min(1).max(100_000).default(60),
  upstashRedisUrl: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  upstashRedisToken: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  embeddingProvider: z.enum(['hash', 'api']).default('hash'),
  embeddingApiUrl: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  embeddingApiKey: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  embeddingModel: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  embeddingCacheSize: z.coerce.number().int().min(0).max(100_000).default(1_000),
  maxJsonBodyBytes: z.coerce.number().int().min(1_024).max(50_000_000).default(1_048_576),
  mcpSessionTtlMs: z.coerce.number().int().min(1_000).max(86_400_000).default(1_800_000),
  mcpMaxSessions: z.coerce.number().int().min(1).max(100_000).default(1_000),
  moduleSignatureMode: z.enum(['off', 'warn', 'enforce']).default('off'),
  moduleSignaturePublicKeys: z.preprocess(parsePublicKeys, z.array(z.string()).default([])),
  otelEnabled: z.preprocess(value => value === 'true' || value === true, z.boolean()).default(false),
  otelExporterOtlpEndpoint: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  otelServiceName: z.string().min(1).default('claude-hub'),
  otelExportIntervalMs: z.coerce.number().int().min(100).max(60_000).default(5_000),
  browserFetchTimeoutMs: z.coerce.number().int().min(1_000).max(120_000).default(15_000),
  browserMaxBytes: z.coerce.number().int().min(1_000).max(5_000_000).default(500_000),
  googleCalendarAccessToken: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  googleCalendarId: z.string().min(1).default('primary'),
  googleCalendarApiBaseUrl: z.string().url().default('https://www.googleapis.com/calendar/v3'),
  lanceDbPath: z.string().min(1).default('./data/lancedb'),
  lanceDbLockTimeoutMs: z.coerce.number().int().min(100).max(120_000).default(5_000),
  lanceDbLockStaleMs: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
}).superRefine((value, ctx) => {
  if (
    value.nodeEnv === 'production' &&
    (!value.jwtSecret || value.jwtSecret === 'dev-secret' || value.jwtSecret === 'change-this-in-production')
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['jwtSecret'],
      message: 'JWT_SECRET must be set to a strong non-default value in production',
    })
  }
})

function loadConfig() {
  return ConfigSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    tursoDatabaseUrl: process.env.TURSO_DATABASE_URL,
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
    jwtSecret: process.env.JWT_SECRET,
    mcpServerUrl: process.env.MCP_SERVER_URL,
    githubToken: process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN,
    logLevel: process.env.LOG_LEVEL,
    workspaceDir: process.env.WORKSPACE_DIR,
    executorNodeTimeoutMs: process.env.EXECUTOR_NODE_TIMEOUT_MS,
    kernelToolTimeoutMs: process.env.KERNEL_TOOL_TIMEOUT_MS,
    authTokenTtlSeconds: process.env.AUTH_TOKEN_TTL_SECONDS,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    upstashRedisUrl: process.env.UPSTASH_REDIS_URL,
    upstashRedisToken: process.env.UPSTASH_REDIS_TOKEN,
    embeddingProvider: process.env.EMBEDDING_PROVIDER,
    embeddingApiUrl: process.env.EMBEDDING_API_URL,
    embeddingApiKey: process.env.EMBEDDING_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL,
    embeddingCacheSize: process.env.EMBEDDING_CACHE_SIZE,
    maxJsonBodyBytes: process.env.MAX_JSON_BODY_BYTES,
    mcpSessionTtlMs: process.env.MCP_SESSION_TTL_MS,
    mcpMaxSessions: process.env.MCP_MAX_SESSIONS,
    moduleSignatureMode: process.env.MODULE_SIGNATURE_MODE,
    moduleSignaturePublicKeys: process.env.MODULE_SIGNATURE_PUBLIC_KEYS,
    otelEnabled: process.env.OTEL_ENABLED,
    otelExporterOtlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelServiceName: process.env.OTEL_SERVICE_NAME,
    otelExportIntervalMs: process.env.OTEL_EXPORT_INTERVAL_MS,
    browserFetchTimeoutMs: process.env.BROWSER_FETCH_TIMEOUT_MS,
    browserMaxBytes: process.env.BROWSER_MAX_BYTES,
    googleCalendarAccessToken: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
    googleCalendarId: process.env.GOOGLE_CALENDAR_ID,
    googleCalendarApiBaseUrl: process.env.GOOGLE_CALENDAR_API_BASE_URL,
    lanceDbPath: process.env.LANCEDB_PATH,
    lanceDbLockTimeoutMs: process.env.LANCEDB_LOCK_TIMEOUT_MS,
    lanceDbLockStaleMs: process.env.LANCEDB_LOCK_STALE_MS,
  })
}

export type Config = z.infer<typeof ConfigSchema>
export const config = loadConfig()
