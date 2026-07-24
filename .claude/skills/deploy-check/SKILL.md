---
name: deploy-check
description: >
  Pre-deployment checklist and safety verification. Use before any production
  deployment to catch common issues and ensure proper process is followed.
slash_command: true
auto_trigger: true
triggers:
  - "deploy"
  - "deploy to production"
  - "release"
  - "ship this"
requires:
  - github
version: 1.0
---

## Pre-Deployment Checklist

### Before Every Deployment

#### 1. Code Quality
- [ ] All tests passing locally
- [ ] No critical linting errors
- [ ] No console.log or debug statements left in code
- [ ] TypeScript compiles without errors

#### 2. Security
- [ ] No hardcoded secrets or credentials
- [ ] Dependencies scanned for vulnerabilities
- [ ] No sensitive data in environment files committed

#### 3. Documentation
- [ ] README updated if needed
- [ ] API changes documented
- [ ] Breaking changes noted

#### 4. Testing
- [ ] Manual testing of changed features completed
- [ ] Edge cases considered and tested
- [ ] Rollback plan defined

#### 5. Communication
- [ ] Stakeholders notified of deployment window
- [ ] Monitoring alerts configured
- [ ] On-call engineer aware

### Deployment Process

1. **Create deployment branch** from main
2. **Run full test suite**
3. **Build and verify** in staging environment
4. **Get approval** from at least one other engineer (for P1/P2 services)
5. **Deploy during approved window**
6. **Monitor** for 30 minutes after deployment
7. **Document** any issues in incident log

### Rollback Criteria

Automatically roll back if:
- Error rate increases > 3x baseline
- P99 latency increases > 2x baseline
- Any critical user flow is broken

### Post-Deployment

- [ ] Verify key metrics are healthy
- [ ] Confirm no new errors in logs
- [ ] Update status page if applicable
- [ ] Celebrate successful deployment 🎉

## Trigger Phrases
- "I'm about to deploy"
- "Deploy checklist"
- "Release to production"
- "Ship this feature"