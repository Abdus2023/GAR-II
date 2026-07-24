import { z } from 'zod';
export default class EchoModule {
    ctx;
    manifest() {
        return {
            id: 'echo',
            version: '0.1.0',
            permissions: [],
            dependencies: [],
        };
    }
    async initialize(ctx) {
        this.ctx = ctx;
        this.ctx.logger.info('Echo module initialized');
    }
    tools() {
        return [{
                id: 'echo',
                description: 'Returns the message you send (test tool)',
                inputSchema: z.object({
                    message: z.string().min(1),
                }),
                execute: async (input) => ({
                    success: true,
                    message: `Echo: ${input.message}`,
                }),
            }];
    }
    async shutdown() {
        this.ctx.logger.info('Echo module shutting down');
    }
}
