# Contributing to Claude Hub Gateway

Thank you for your interest in contributing! This project follows a strict modular, secure, and model-agnostic philosophy.

---

## Code of Conduct

- Be respectful and inclusive.
- Focus on architecture and security first.
- Never submit code that bypasses the permission system or audit logging.

---

## How to Contribute

### 1. Reporting Bugs

Open an issue with:
- Clear reproduction steps
- Expected vs actual behavior
- Environment (Bun version, deployment target)
- Relevant logs (redact secrets)

### 2. Suggesting Features

Open a discussion first. We prioritize:
- Context efficiency improvements
- Security hardening
- Developer experience (CLI, testing, docs)
- New capability modules that follow the design-first principle

### 3. Submitting Code

1. Fork the repository
2. Create a feature branch from `main`
3. Follow the module development guide (`docs/MODULE_DEVELOPMENT_GUIDE.md`)
4. Write tests for every new tool
5. Ensure `bun test` passes
6. Open a Pull Request with a clear description

### Pull Request Requirements

- [ ] All tests pass
- [ ] New tools use Zod schemas
- [ ] Errors are structured (never raw stack traces)
- [ ] Permissions are declared in `manifest.yaml`
- [ ] Events are emitted instead of direct imports
- [ ] Documentation updated if behavior changes

---

## Development Setup

```bash
git clone https://github.com/you/claude-hub
cd claude-hub
bun install
bun run dev
```

See `docs/GETTING_STARTED.md` and `docs/DEPLOYMENT_GUIDE.md` for full instructions.

---

## Commit Message Convention

```
type(scope): short description

[optional body]

Fixes #123
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

---

Thank you for helping build a production-grade, secure, and extensible AI runtime.