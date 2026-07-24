# Cloudflare Workers Deployment

## Prerequisites

1. Cloudflare account (free)
2. Wrangler CLI: `npm install -g wrangler`
3. Turso database created

## Steps

```bash
# 1. Login to Cloudflare
wrangler login

# 2. Create D1 database
wrangler d1 create claude-hub

# 3. Create R2 bucket
wrangler r2 bucket create claude-hub-storage

# 4. Set secrets
wrangler secret put JWT_SECRET
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put GITHUB_TOKEN   # optional

# 5. Update wrangler.toml with your database_id

# 6. Deploy
npm run deploy:cloudflare
```

## After Deployment

1. Copy your worker URL (e.g. `https://claude-hub.your-account.workers.dev`)
2. Add it as a custom connector at [claude.ai](https://claude.ai)
3. Test with the `echo` tool

## Custom Domain (Recommended)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Add route: `mcp.yourdomain.com/*`
3. Update `MCP_SERVER_URL` environment variable

## Monitoring

```bash
# View logs
wrangler tail claude-hub

# View metrics
# Dashboard → Workers → claude-hub → Metrics
```