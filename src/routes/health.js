import { Hono } from 'hono';
import { kernel } from '../kernel';
export const healthRouter = new Hono();
healthRouter.get('/', (c) => c.json({ status: 'ok', timestamp: Date.now() }));
healthRouter.get('/ready', (c) => {
    return c.json({
        status: 'ok',
        kernel: kernel ? 'ready' : 'not_ready',
        timestamp: Date.now(),
    });
});
healthRouter.get('/diagnostics', (c) => {
    return c.json({
        modules: kernel.getLoadedModules(),
        tools: kernel.getRegisteredTools(),
        uptime: process.uptime?.() || 0,
        timestamp: Date.now(),
    });
});
