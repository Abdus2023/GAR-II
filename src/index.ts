import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { mcpRouter } from './mcp/server'
import { authRouter } from './auth/router'
import { healthRouter } from './routes/health'
import { discoveryRouter } from './routes/discovery'
import { rateLimit } from './middleware/rate-limit'
import { kernel } from './kernel'
import { skillRuntime } from './skills/runtime'
import { toolSearch } from './search/tool-search'
import { semanticMemory } from './memory/semantic'
import { logger } from './logger'

const app = new Hono()

// CORS - restrict to Claude domains
app.use('*', cors({
  origin: ['https://claude.ai', 'https://*.anthropic.com'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type', 'MCP-Session-Id'],
  exposeHeaders: ['MCP-Session-Id'],
}))

app.use('*', honoLogger())

// Rate limiting
app.use('*', rateLimit)

// Routes
app.route('/mcp', mcpRouter)
app.route('/auth', authRouter)
app.route('/health', healthRouter)
app.route('/', discoveryRouter)

// Start kernel and skills
await kernel.start()
await skillRuntime.loadFromDirectory('./.claude/skills')

// Initialize semantic memory (L3)
await semanticMemory.initialize()

// Register tools for semantic search (Phase 2 + Phase 3)
const registeredTools = [
  // Core
  {
    id: 'echo',
    description: 'Simple test tool that echoes back any message you send',
    category: 'core',
    cost: 'low' as const,
  },
  // Memory
  {
    id: 'memory.set',
    description: 'Store a key-value pair in persistent memory for later retrieval',
    category: 'memory',
    cost: 'low' as const,
  },
  {
    id: 'memory.get',
    description: 'Retrieve a previously stored value from persistent memory',
    category: 'memory',
    cost: 'low' as const,
  },
  {
    id: 'memory.search',
    description: 'Search through all stored memory keys for relevant information',
    category: 'memory',
    cost: 'low' as const,
  },
  // GitHub
  {
    id: 'github.search_repo',
    description: 'Search GitHub repositories by keyword, topic, or programming language',
    category: 'developer',
    cost: 'low' as const,
  },
  {
    id: 'github.read_file',
    description: 'Read the contents of any file from a GitHub repository',
    category: 'developer',
    cost: 'low' as const,
  },
  {
    id: 'github.review_pr',
    description: 'Fetch pull request details, metadata, and diff for code review',
    category: 'developer',
    cost: 'medium' as const,
  },
  // Filesystem
  {
    id: 'filesystem.read_file',
    description: 'Read the contents of a file from the workspace',
    category: 'filesystem',
    cost: 'low' as const,
  },
  {
    id: 'filesystem.write_file',
    description: 'Write or overwrite a file in the workspace',
    category: 'filesystem',
    cost: 'low' as const,
  },
  {
    id: 'filesystem.list_directory',
    description: 'List files and folders in a directory',
    category: 'filesystem',
    cost: 'low' as const,
  },
  // Notes
  {
    id: 'notes.create',
    description: 'Create a new note in your personal knowledge base',
    category: 'notes',
    cost: 'low' as const,
  },
  {
    id: 'notes.get',
    description: 'Retrieve a note by its ID',
    category: 'notes',
    cost: 'low' as const,
  },
  {
    id: 'notes.search',
    description: 'Search your notes by title or content',
    category: 'notes',
    cost: 'low' as const,
  },
  // Search
  {
    id: 'search.query',
    description: 'Unified search across memory and notes',
    category: 'search',
    cost: 'medium' as const,
  },
]

toolSearch.registerTools(registeredTools)

logger.info({ 
  modules: kernel.getLoadedModules(),
  skills: skillRuntime.listSkills().length,
  searchableTools: registeredTools.length
}, 'Claude Hub Gateway ready (Phase 2)')

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
}