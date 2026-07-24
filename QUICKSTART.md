# Quick Start — Claude Hub Gateway (5 Minutes)

Get the gateway running and connected to Claude in under 5 minutes.

---

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Start the Gateway

```bash
npm run dev
```

You should see:
```
Claude Hub Gateway ready
```

---

## 3. Expose It Publicly

Claude needs a public HTTPS URL.

**Recommended** — Use Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the `https://*.trycloudflare.com` URL.

---

## 4. Add the Connector in Claude

1. Go to [claude.ai](https://claude.ai)
2. **Settings** → **Customize** → **Connectors** → **+ Add custom connector**
3. Enter:
   - Name: `My Hub`
   - URL: `https://your-tunnel.trycloudflare.com/mcp`
4. Click **Add** and authenticate

---

## 5. Test It

Try any of these prompts in Claude:

```text
Use workspace with action "echo" and message "Hello!"
```

```text
Remember that my favorite color is blue.
```

```text
Search GitHub for "typescript http server".
```

```text
Review PR #42 in anthropics/claude for security issues.
```

---

## 6. Explore More

- See all available prompts: `examples/prompts.md`
- Read the full status: `FINAL_STATUS.md`
- Learn the architecture: `docs/COMPREHENSIVE_TRACEABILITY_v7.md`

---

**You're now running a personal AI operating system connected to Claude.**