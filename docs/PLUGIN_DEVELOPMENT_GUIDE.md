# Plugin Development Guide — Claude Code Plugins (2026)

This guide explains how to create, package, and distribute installable plugins for Claude Code.

---

## 1. What Is a Plugin?

A plugin is a **versioned, installable bundle** that can contain any combination of:

- Skills (`SKILL.md` files)
- Hooks (lifecycle automation scripts)
- Subagents (specialized personas)
- MCP server definitions
- Slash commands
- Custom output styles

Plugins are distributed as Git repositories and installed with a single command.

---

## 2. Plugin Folder Structure

```
my-awesome-plugin/
├── plugin.json                 # REQUIRED manifest
├── README.md
├── skills/
│   ├── security-review/
│   │   └── SKILL.md
│   └── deploy-check/
│       └── SKILL.md
├── agents/
│   └── security-auditor.md
├── hooks/
│   ├── pre-tool-use.sh
│   └── post-tool-use.sh
├── mcp/
│   └── server.json             # MCP server definition
├── commands/                   # Legacy slash commands (still supported)
│   └── review.md
└── styles/
    └── concise.md
```

---

## 3. The Plugin Manifest (`plugin.json`)

```json
{
  "id": "security-audit",
  "name": "Security Audit Plugin",
  "version": "2.3.1",
  "description": "Security review workflows, secret scanning hooks, and a dedicated security auditor subagent",
  "author": "Your Name",
  "repository": "https://github.com/you/security-audit-plugin",
  "homepage": "https://github.com/you/security-audit-plugin",
  
  "skills": [
    "skills/security-review",
    "skills/deploy-check"
  ],
  
  "agents": [
    "agents/security-auditor.md"
  ],
  
  "hooks": {
    "PreToolUse": "hooks/pre-tool-use.sh",
    "PostToolUse": "hooks/post-tool-use.sh"
  },
  
  "mcp": {
    "servers": ["mcp/server.json"]
  },
  
  "permissions": {
    "filesystem": ["read"],
    "network": ["github.com", "api.github.com"],
    "mcp_connectors": ["github"]
  },
  
  "minClaudeCodeVersion": "2.1.0",
  "tags": ["security", "review", "github"]
}
```

---

## 4. Creating a Skill Inside a Plugin

Skills inside plugins use the `plugin-name:skill-name` namespace automatically.

**Example skill** (`skills/security-review/SKILL.md`):

```markdown
---
name: security-review
description: >
  Reviews code changes for security vulnerabilities, injection risks,
  authentication flaws, and insecure data handling patterns.
slash_command: true
auto_trigger: true
triggers:
  - "security review"
  - "check for vulnerabilities"
  - "audit this code"
requires:
  - github
permissions:
  - github.read
subagent: false
---

## Security Review Process

1. Fetch the PR or diff
2. Check for: SQL injection, XSS, path traversal, hardcoded secrets, weak auth
3. Run static analysis tools if available
4. Rate findings: Critical / High / Medium / Low
5. Never approve if Critical or High findings exist

## Output Format

```
## Security Review

### Critical (block merge)
- ...

### Recommendation
APPROVE / CHANGES_REQUIRED
```
```

---

## 5. Hook Scripts

Hooks are simple shell scripts. They receive JSON on stdin and can return JSON on stdout.

**Example: PreToolUse secret scanner** (`hooks/pre-tool-use.sh`):

```bash
#!/bin/bash
INPUT=$(cat)

CONTENT=$(echo "$INPUT" | jq -r '.input.content // empty')
if [ -z "$CONTENT" ]; then exit 0; fi

if echo "$CONTENT" | grep -qiE "sk-[a-zA-Z0-9]{32,}"; then
  echo '{
    "decision": "block",
    "reason": "Potential API key detected. Use environment variables instead."
  }'
  exit 0
fi

exit 0
```

Make the script executable:

```bash
chmod +x hooks/pre-tool-use.sh
```

---

## 6. Subagent Definition

**Example** (`agents/security-auditor.md`):

```markdown
---
name: security-auditor
description: Specialized security reviewer with deep knowledge of OWASP Top 10 and common vulnerability patterns.
tools:
  - Read
  - Bash
mcp_connectors:
  - github
context_files:
  - docs/security-checklist.md
max_turns: 15
---
You are a senior application security engineer...
```

---

## 7. MCP Server Definition Inside a Plugin

**`mcp/server.json`**:

```json
{
  "name": "internal-api",
  "url": "https://mcp.yourcompany.com/mcp",
  "auth": {
    "type": "oauth2",
    "authorizationUrl": "https://mcp.yourcompany.com/auth/authorize"
  }
}
```

---

## 8. Distribution & Installation

### From the official marketplace

```bash
/plugin marketplace add anthropic/security-audit
```

### From any public Git repository

```bash
/plugin marketplace add github.com/you/security-audit-plugin
```

### From a local folder (development)

```bash
/plugin install ./security-audit-plugin
```

### From a private repository (Enterprise)

```bash
/plugin marketplace add gitlab.company.com/security-team/plugin
```

---

## 9. Versioning & Updates

- Plugins follow semantic versioning
- Users can pin versions: `/plugin install security-audit@2.1.0`
- Updates are detected automatically when the repository has new commits
- `/plugin update security-audit` pulls the latest version

---

## 10. Best Practices

- Keep the plugin focused (one domain)
- Document every skill and hook in `README.md`
- Include example usage in the skill frontmatter
- Test hooks in isolation before bundling
- Use the `plugin-name:skill-name` namespace (automatically enforced)
- Declare all required MCP connectors and permissions

---

## 11. Publishing Checklist

- [ ] `plugin.json` is valid JSON
- [ ] All paths in `plugin.json` exist
- [ ] Every skill has a clear `description` and `triggers`
- [ ] Hooks are executable (`chmod +x`)
- [ ] `README.md` explains installation and usage
- [ ] Minimum Claude Code version is declared
- [ ] Repository is public (or Enterprise marketplace configured)

---

**Plugin development is the recommended way to share reusable workflows across teams and with the community.**