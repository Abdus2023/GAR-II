import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { mcpRouter } from './mcp/server';
import { authRouter } from './auth/router';
import { healthRouter } from './routes/health';
import { discoveryRouter } from './routes/discovery';
import { rateLimit } from './middleware/rate-limit';
import { kernel } from './kernel';
import { skillRuntime } from './skills/runtime';
import { logger } from './logger';
const app = new Hono();
// CORS - restrict to Claude domains
app.use('*', cors({
    origin: ['https://claude.ai', 'https://*.anthropic.com'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'MCP-Session-Id'],
    exposeHeaders: ['MCP-Session-Id'],
}));
app.use('*', honoLogger());
// Rate limiting
app.use('*', rateLimit);
// Routes
app.route('/mcp', mcpRouter);
app.route('/auth', authRouter);
app.route('/health', healthRouter);
app.route('/', discoveryRouter);
// Start kernel and skills
await kernel.start();
await skillRuntime.loadFromDirectory('./.claude/skills');
logger.info({
    modules: kernel.getLoadedModules(),
    skills: skillRuntime.listSkills().length
}, 'Claude Hub Gateway ready');
export default {
    port: process.env.PORT || 3000,
    fetch: app.fetch,
};
