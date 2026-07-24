# Deployment Guide — Claude Hub Gateway

This guide covers how to deploy the Claude Hub Gateway from local development to production at scale.

---

## 1. Deployment Progression

| Stage | Environment | Infrastructure | Cost | Use Case |
|-------|-------------|----------------|------|----------|
| **1** | Local | Bun + SQLite (file) | $0 | Development & testing |
| **2** | Edge (Free) | Cloudflare Workers + Turso + R2 | $0 | Personal production |
| **3** | Small Team | Fly.io + Turso + Upstash | $5–15/mo | 2–10 users |
| **4** | Scaled | Kubernetes + PostgreSQL + Qdrant | $100+/mo | 100+ users, enterprise |

---

## 2. Stage 1 — Local Development

```bash
# 1. Clone and install
git clone https://github.com/you/claude-hub
cd claude-hub
bun install

# 2. Create .env (development)
echo 'NODE_ENV=development
PORT=3000
TURSO_DATABASE_URL=file:local.db
JWT_SECRET=dev-secret-change-me' > .env

# 3. Run
bun run dev

# 4. Expose publicly (for Claude)
cloudflared tunnel --url http://localhost:3000
# or
ngrok http 3000

# 5. Add the URL to claude.ai → Connectors
```

**Health check**:
```bash
curl http://localhost:3000/health/ready
```

---

## 3. Stage 2 — Cloudflare Workers (Recommended for Personal Use)

### Prerequisites
- Cloudflare account (free)
- Wrangler CLI installed (`npm i -g wrangler`)
- Turso account + database created

### Steps

```bash
# 1. Install dependencies
bun add @cloudflare/workers-types

# 2. Configure wrangler.toml
cat > wrangler.toml << 'EOF'
name = "claude-hub"
main = "src/index.ts"
compatibility_date = "2026-07-01"
compatibility_flags = ["nodejs_compat"]

[vars]
NODE_ENV = "production"

[[d1_databases]]
binding = "DB"
database_name = "claude-hub"
database_id = "<your-d1-id>"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "claude-hub-storage"

[observability]
enabled = true
EOF

# 3. Set secrets
wrangler secret put JWT_SECRET
wrangler secret put GITHUB_TOKEN
wrangler secret put TURSO_AUTH_TOKEN

# 4. Deploy
wrangler deploy

# 5. Your gateway is now live at:
# https://claude-hub.<your-subdomain>.workers.dev
```

### Add Custom Domain (optional but recommended)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Add custom domain: `mcp.yourdomain.com`
3. Update `MCP_SERVER_URL` in your environment

---

## 4. Stage 3 — Fly.io (Persistent Workloads)

Use this when you need:
- Background workers (Inngest)
- Persistent LanceDB (file-based vector store)
- Long-running processes

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Initialize app
fly launch --name claude-hub --region ams

# 3. Add persistent volume for LanceDB
fly volumes create data --size 10

# 4. Deploy
fly deploy
```

**`fly.toml`** example:

```toml
app = "claude-hub"
primary_region = "ams"

[build]
  builder = "paketo-buildpacks/bun"

[[mounts]]
  source = "data"
  destination = "/data"

[env]
  NODE_ENV = "production"
  LANCEDB_PATH = "/data/lancedb"
```

---

## 5. Stage 4 — Kubernetes (Enterprise Scale)

For 100+ users or strict compliance requirements.

### Recommended Stack
- **Gateway**: Cloudflare Workers (edge) or Kubernetes Ingress
- **Database**: PostgreSQL (managed) + read replicas
- **Vector**: Qdrant cluster
- **Cache**: Redis Cluster
- **Jobs**: Temporal or Argo Workflows
- **Observability**: Prometheus + Grafana + Loki

### Key Considerations
- Horizontal Pod Autoscaler on the gateway
- Network policies (only gateway can reach database)
- Secrets via External Secrets Operator + Vault
- Blue-green or canary deployments

---

## 6. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` / `production` |
| `PORT` | Yes | Server port (default 3000) |
| `JWT_SECRET` | Yes | Signing key for access tokens |
| `MCP_SERVER_URL` | Yes | Public URL of your gateway |
| `TURSO_DATABASE_URL` | Yes | Turso connection string |
| `TURSO_AUTH_TOKEN` | Yes (prod) | Turso auth token |
| `UPSTASH_REDIS_URL` | Recommended | Redis REST endpoint |
| `UPSTASH_REDIS_TOKEN` | Recommended | Redis token |
| `GITHUB_TOKEN` | Per module | GitHub PAT (least privilege) |
| `OTEL_EXPORTER_URL` | Optional | OpenTelemetry collector |
| `SENTRY_DSN` | Optional | Error tracking |

---

## 7. Health & Readiness Endpoints

```bash
# Liveness
curl https://mcp.yourdomain.com/health

# Readiness (checks DB, kernel, auth)
curl https://mcp.yourdomain.com/health/ready

# Diagnostics (authenticated)
curl -H "Authorization: Bearer $TOKEN" \
     https://mcp.yourdomain.com/health/diagnostics
```

---

## 8. Monitoring & Alerting Recommendations

### Critical Alerts
- Gateway error rate > 5% for 5 minutes
- Database connection failures
- Token validation failures (possible attack)
- Rate limit exhaustion (possible abuse)

### Recommended Dashboards
- Tool call volume per module
- P50 / P95 / P99 latency per tool
- Cache hit rate
- Token usage trends
- Background job success rate

---

## 9. Backup & Disaster Recovery

- **Database**: Turso / PostgreSQL automatic daily backups (enable point-in-time recovery)
- **Vector store**: LanceDB files → R2 nightly snapshot
- **Configuration**: Store `wrangler.toml`, secrets, and manifests in Git
- **Recovery time objective**: < 15 minutes for personal, < 1 hour for enterprise

---

## 10. Cost Optimization Tips

- Use Cloudflare Workers + Turso + R2 for 95% of personal/team use cases ($0)
- Only move to Fly.io / Kubernetes when you need persistent compute or > 100k requests/day
- Cache aggressively (especially `tools/list` and Server Cards)
- Set short TTLs on expensive external API calls

---

**You are now ready to deploy the Claude Hub Gateway from laptop to production.**