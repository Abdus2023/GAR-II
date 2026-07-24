# Getting Started – Claude OS / Agentic-Native Runtime

This guide walks you through setting up a local development environment and connecting your first Hub Gateway to Claude.

---

## Prerequisites

- **Bun** ≥ 1.1 (recommended) or Node.js 20+
- Git
- A Claude account (Free tier is sufficient)
- Cloudflare account (for production deployment) – optional for local dev

---

## 1. Clone & Install

```bash
git clone https://github.com/your-org/claude-os.git
cd claude-os
bun install
```

---

## 2. Environment Setup

Create a `.env` file in the root (or use `c12` layered config):

```env
# Development only – never commit real secrets
NODE_ENV=development
PORT=8787

# Turso (SQLite)
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=

# Upstash Redis (optional for local)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Better Auth
BETTER_AUTH_SECRET=super-secret-dev-key

# Cloudflare (for R2 later)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
```

For local development you can leave most values empty — the system falls back to local SQLite and in-memory cache.

---

## 3. Run the Gateway Locally

```bash
bun run dev
```

The gateway will start on `http://localhost:8787`.

You should see:

```
[INFO] MCP Hub Gateway listening on http://localhost:8787
[INFO] Registered 0 capabilities (development mode)
```

---

## 4. Expose Your Local Gateway (for Claude)

Claude requires a public HTTPS URL.

### Option A – Cloudflare Tunnel (Recommended)

```bash
cloudflared tunnel --url http://localhost:8787
```

Copy the `https://*.trycloudflare.com` URL.

### Option B – ngrok

```bash
ngrok http 8787
```

---

## 5. Add the Connector to Claude

1. Go to [claude.ai](https://claude.ai)
2. Settings → Connectors → Add custom connector
3. Paste your public URL (e.g. `https://your-tunnel.trycloudflare.com`)
4. Choose **Streamable HTTP** transport
5. Save

The connector will appear in your conversation list.

---

## 6. Test the Connection

In any Claude chat, type:

> "What tools do you have access to?"

Claude should list the capabilities exposed by your Hub Gateway (initially just a few stub tools).

Try a simple command:

> "Use workspace.search to find notes about project planning"

Even if the module is not yet implemented, you should see the request reach your local gateway logs.

---

## 7. Next Steps

| Goal                              | Document to Read                  |
|-----------------------------------|-----------------------------------|
| Understand the full architecture  | `docs/ARCHITECTURE.md`            |
| Review security model             | `docs/SECURITY.md`                |
| Follow the development plan       | `docs/ROADMAP.md`                 |
| Start implementing Phase 1        | `apps/gateway/README.md` (coming) |
| Learn how to write a module       | `packages/sdk/README.md` (coming) |

---

## 8. Common Issues

**"Connection refused" from Claude**  
→ Make sure your tunnel is running and the URL is HTTPS.

**No tools appear**  
→ Check gateway logs for registration errors. Ensure at least one module is loaded.

**OAuth errors**  
→ For local development, you can temporarily disable strict OAuth validation (see `packages/auth`).

---

## 9. Production Deployment (Quick)

See `deployment/cloudflare/README.md` for a one-command deployment to Cloudflare Workers.

---

**You now have a working single-connector MCP Hub.**  
From here you can follow the roadmap to add real capabilities, memory, and intelligence.

Welcome to the Claude OS project!