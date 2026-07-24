---
name: incident-response
description: >
  Guides through production incident response: triage, communication, mitigation,
  and post-incident review. Use when the user reports an outage, error spike,
  or production issue.
slash_command: true
auto_trigger: true
triggers:
  - "we have an incident"
  - "production is down"
  - "investigate the outage"
  - "incident response"
requires:
  - github
  - search
version: 1.0
---

## Incident Response Playbook

### Phase 1: Triage (First 5 minutes)
1. **Acknowledge** the report immediately
2. **Assess severity**:
   - P1: Complete outage affecting all users
   - P2: Major feature broken for many users
   - P3: Minor issue or limited impact
3. **Create incident channel** (Slack / Teams) if not already created

### Phase 2: Investigation
- Check recent deployments
- Look at error rates and logs
- Identify affected components
- Use `github` to check recent commits if needed

### Phase 3: Communication
- Post status update every 15-30 minutes
- Be honest about what you know and don't know
- Give estimated time to resolution when possible

### Phase 4: Mitigation
- Roll back if recent deployment caused the issue
- Implement temporary workaround if possible
- Document the mitigation

### Phase 5: Resolution
- Confirm the issue is fully resolved
- Communicate resolution to users
- Schedule post-mortem

### Post-Mortem Template
```
## Incident: [Title]
**Date**: 
**Severity**: P1 / P2 / P3
**Duration**: 

## Summary
[What happened in 2-3 sentences]

## Root Cause
[Technical explanation]

## Timeline
- HH:MM - First report
- HH:MM - Investigation started
- HH:MM - Mitigation applied
- HH:MM - Resolved

## Action Items
- [ ] Fix the root cause
- [ ] Improve monitoring
- [ ] Update runbooks

## Lessons Learned
- What went well
- What could be improved
```

## Important Rules
- Never speculate publicly about causes
- Never blame individuals
- Always focus on systems and processes
- Update stakeholders proactively

## Trigger Phrases
- "We have a production incident"
- "Users can't log in"
- "The site is down"
- "Help with this outage"