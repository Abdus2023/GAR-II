import { createMiddleware } from 'hono/factory';
const requestCounts = new Map();
export const rateLimit = createMiddleware(async (c, next) => {
    const userId = c.get('userId') || c.req.header('CF-Connecting-IP') || 'anonymous';
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const maxRequests = 60;
    const key = `${userId}:${Math.floor(now / windowMs)}`;
    let current = requestCounts.get(key);
    if (!current || now > current.resetTime) {
        current = { count: 0, resetTime: now + windowMs };
    }
    current.count++;
    requestCounts.set(key, current);
    // Cleanup old entries periodically
    if (requestCounts.size > 1000) {
        const oldestKey = Array.from(requestCounts.keys())[0];
        requestCounts.delete(oldestKey);
    }
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - current.count)));
    c.header('X-RateLimit-Reset', String(current.resetTime));
    if (current.count > maxRequests) {
        return c.json({
            error: 'rate_limit_exceeded',
            message: 'Too many requests. Please slow down.',
            retry_after: Math.ceil((current.resetTime - now) / 1000),
        }, 429);
    }
    await next();
});
