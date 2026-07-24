# Security Architecture – Claude OS / Agentic-Native Runtime

## Threat Model

### Primary Threats

1. **Confused Deputy Attack** (MCP spec risk)
2. **Prompt Injection via Tool Descriptions**
3. **Privilege Escalation**
4. **Data Exfiltration**
5. **Unauthorized Tool Execution**
6. **Supply-Chain Attacks** (malicious modules)

---

## Core Security Principles

- **Capability-based access control** (least privilege)
- **Explicit user consent** for every sensitive action
- **Per-client OAuth consent isolation**
- **Input sanitization & schema validation**
- **Audit everything**
- **Secrets never in environment variables**

---

## 1. Authentication & Authorization

### OAuth2 + Dynamic Client Registration (DCR)

- Claude uses the official 6/18 auth spec
- Each client receives its own consent record
- Consent cookies are **never shared** across clients
- State parameter is validated before any redirect

### Capability-Based Permissions

Instead of broad roles, every tool declares exactly what it needs:

```yaml
permissions:
  - github.read
  - github.write
  - filesystem.read
  - email.send
```

The Permission Engine checks before every execution.

---

## 2. Tool Execution Pipeline (Security Gates)

Every tool call passes through these layers:

1. **Authentication** – Valid session + client ID
2. **Authorization** – Capability check
3. **Schema Validation** – Zod validation of input
4. **Rate Limiting** – Per-user / per-session
5. **Confirmation Gate** – Destructive actions require explicit user confirmation
6. **Execution**
7. **Audit Logging** – Full record of who, what, when, result

---

## 3. Prompt Injection Mitigation

- All tool descriptions are **sanitized** before being sent to the model
- Tool descriptions are treated as **untrusted input**
- No tool is allowed to inject system-level instructions
- Context Budget Manager limits how many tools are visible at once

---

## 4. Secrets Management

**Never** store secrets in `.env` files or environment variables in production.

Recommended approach:

- Cloudflare Secrets / Vault (production)
- Encrypted secrets store with short-lived tokens
- Runtime fetches secrets at startup via secure channel

---

## 5. Module Security

### Module Signing (Future)

Planned: All modules must be signed before the kernel will load them.

### Sandboxing (Future)

Consider running untrusted modules in isolated workers or WebAssembly when third-party marketplace is enabled.

---

## 6. Data Protection

- All sensitive data at rest is encrypted (Turso + R2 encryption)
- Memory engine supports per-project isolation
- Vector store can be configured with tenant isolation

---

## 7. Audit & Observability

Every capability invocation records:

- User / Session ID
- Capability requested
- Input (sanitized)
- Result (success/failure)
- Timestamp
- Model used
- Token usage

These logs feed into security dashboards and anomaly detection.

---

## 8. Security Checklist for Production

- [ ] Per-client OAuth consent storage implemented
- [ ] State parameter validation before redirect
- [ ] Tool description sanitization active
- [ ] Confirmation gate for `delete`, `send`, `write` operations
- [ ] Secrets stored in Vault / Cloudflare Secrets
- [ ] Rate limiting enabled per session
- [ ] Full audit logging enabled
- [ ] Input schema validation (Zod) on all tools
- [ ] Module signing pipeline ready (Phase 5)
- [ ] Regular security reviews scheduled

---

## 9. Incident Response

In case of a detected breach or abuse:

1. Immediately revoke the affected client’s consent
2. Disable the compromised capability/module
3. Review audit logs for the affected time window
4. Rotate any potentially exposed secrets
5. Notify affected users (if applicable)

---

*Security is not a feature — it is a foundational layer of the entire runtime.*