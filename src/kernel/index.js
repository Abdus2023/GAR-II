import { EventEmitter } from 'eventemitter3';
import { logger } from '../logger';
import { db, memory } from '../database';
import { eq, and, like } from 'drizzle-orm';
class Kernel {
    modules = new Map();
    tools = new Map();
    events = new EventEmitter();
    initialized = false;
    async start() {
        if (this.initialized)
            return;
        // Register built-in tools
        this.registerBuiltinTools();
        this.initialized = true;
        logger.info('Kernel ready with database support');
    }
    registerBuiltinTools() {
        // echo (test tool)
        this.tools.set('echo', async (input) => ({
            success: true,
            message: `Echo: ${input.message}`,
        }));
        // memory.get
        this.tools.set('memory.get', async (input, ctx) => {
            const result = await db.query.memory.findFirst({
                where: and(eq(memory.userId, ctx.userId), eq(memory.key, input.key)),
            });
            return {
                success: true,
                value: result ? JSON.parse(result.value) : null,
            };
        });
        // memory.set
        this.tools.set('memory.set', async (input, ctx) => {
            const existing = await db.query.memory.findFirst({
                where: and(eq(memory.userId, ctx.userId), eq(memory.key, input.key)),
            });
            if (existing) {
                await db.update(memory)
                    .set({
                    value: JSON.stringify(input.value),
                    updatedAt: Date.now(),
                })
                    .where(eq(memory.id, existing.id));
            }
            else {
                await db.insert(memory).values({
                    userId: ctx.userId,
                    key: input.key,
                    value: JSON.stringify(input.value),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
            }
            this.events.emit('memory:updated', { key: input.key, userId: ctx.userId });
            return { success: true };
        });
        // memory.search
        this.tools.set('memory.search', async (input, ctx) => {
            const results = await db.query.memory.findMany({
                where: and(eq(memory.userId, ctx.userId), like(memory.key, `%${input.query}%`)),
                limit: 20,
            });
            return {
                success: true,
                results: results.map(r => ({
                    key: r.key,
                    value: JSON.parse(r.value),
                    updatedAt: r.updatedAt,
                })),
            };
        });
    }
    async invoke(action, params, ctx) {
        const handler = this.tools.get(action);
        if (!handler) {
            throw new Error(`Unknown action: ${action}. Available: ${Array.from(this.tools.keys()).join(', ')}`);
        }
        const start = performance.now();
        try {
            const result = await handler(params, ctx);
            const duration = Math.round(performance.now() - start);
            this.events.emit('tool:executed', {
                toolId: action,
                userId: ctx.userId,
                duration,
                success: true,
            });
            // Audit log
            await db.insert(require('../database').toolCalls).values({
                userId: ctx.userId,
                toolId: action,
                action,
                input: JSON.stringify(params),
                output: JSON.stringify(result),
                durationMs: duration,
                createdAt: Date.now(),
            });
            return result;
        }
        catch (error) {
            this.events.emit('tool:failed', { toolId: action, userId: ctx.userId, error: error.message });
            throw error;
        }
    }
    getRegisteredTools() {
        return Array.from(this.tools.keys());
    }
    getLoadedModules() {
        return Array.from(this.modules.keys());
    }
    on(event, handler) {
        this.events.on(event, handler);
    }
    emit(event, data) {
        this.events.emit(event, data);
    }
}
export const kernel = new Kernel();
