# How to Test the Claude Hub Gateway with Claude

This guide walks you through connecting your running gateway to Claude and testing the core features.

---

## Step 1: Start the Gateway

```bash
npm run dev
```

You should see:
```
Claude Hub Gateway ready
```

---

## Step 2: Expose It Publicly

Claude needs a public HTTPS URL.

### Recommended: Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the `https://*.trycloudflare.com` URL.

### Alternative: ngrok

```bash
ngrok http 3000
```

---

## Step 3: Add the Connector in Claude

1. Go to **[claude.ai](https://claude.ai)**
2. Click your profile → **Settings** → **Customize** → **Connectors**
3. Click **+ Add custom connector**
4. Fill in:
   - **Name**: `My Hub`
   - **URL**: `https://your-tunnel.trycloudflare.com/mcp`
5. Click **Add**
6. Authenticate when prompted

The connector should now appear in your conversations.

---

## Step 4: Test the Features

### Test 1: Echo (Basic connectivity)

```
Use workspace with action "echo" and message "Hello from my gateway"
```

**Expected**: Claude calls the tool and returns `Echo: Hello from my gateway`

### Test 2: Memory (Persistent storage)

```
Remember that my favorite programming language is TypeScript
```

Then in a new conversation:

```
What is my favorite programming language?
```

**Expected**: Claude uses `memory.get` and correctly recalls "TypeScript"

### Test 3: GitHub (Real external tool)

```
Search GitHub for "typescript http server framework"
```

**Expected**: Claude calls `github.search_repo` and shows relevant repositories.

### Test 4: Skills (Progressive disclosure)

Ask Claude:

```
Review PR #123 in anthropics/claude for security issues
```

**Expected**: Claude should detect the trigger and load the `pr-review` skill, then guide you through the review process.

---

## Step 5: Verify Context Budget

In any conversation, ask:

```
What is the current context budget status?
```

Then ask Claude to read `workspace://schema`.

You should see live token usage and available actions.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection refused" | Make sure your tunnel is running and the URL ends with `/mcp` |
| No tools appear | Check gateway logs for errors |
| GitHub tools fail | Make sure `GITHUB_TOKEN` is set in your environment |
| Rate limit errors | Normal during testing — the limit is 60/min |

---

**You now have a fully functional personal AI operating system connected to Claude.**