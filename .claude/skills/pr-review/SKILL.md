---
name: pr-review
description: >
  Reviews a GitHub pull request for security, logic, style, and maintainability issues.
  Use when the user asks to review, check, audit, or give feedback on a pull request.
slash_command: true
auto_trigger: true
triggers:
  - "review this pr"
  - "review pr"
  - "check this pull request"
  - "security review"
requires:
  - github
permissions:
  - github.read
version: 1.0
---

## Pull Request Review Process

### Step 1: Gather Information
- Ask for the PR number and repository if not provided
- Use the `github` action with `review_pr` to fetch the PR details and diff

### Step 2: Analyze the Changes
For each changed file, examine:

- **Logic & Correctness**: Does the change do what it claims?
- **Security**: Look for SQL injection, XSS, path traversal, auth bypass, hardcoded secrets
- **Performance**: N+1 queries, missing indexes, unnecessary allocations
- **Error Handling**: Are errors properly caught? Edge cases handled?
- **Tests**: Are there tests for the new code?
- **Style & Maintainability**: Is the code readable and consistent?

### Step 3: Structure Your Review

```
## Summary
[2-3 sentence overview of what the PR does]

## Findings

### 🔴 Critical (must fix before merge)
- [Finding] in `file.ts:line`

### 🟡 Major (should fix)
- ...

### 🟢 Minor / Suggestions
- ...

## Overall Recommendation
APPROVE / REQUEST CHANGES / NEEDS DISCUSSION
```

### Step 4: Ask Before Posting
Always ask the user for confirmation before posting any review comment to GitHub.

## Common Mistakes to Avoid
- Do not approve PRs with critical security findings
- Do not comment on formatting if a linter is configured
- Do not assume tests are comprehensive just because they exist
- Always check for hardcoded secrets and credentials

## Example Trigger Phrases
- "Review PR #42 in myorg/myrepo"
- "Do a security review of this pull request"
- "Check this PR for issues"