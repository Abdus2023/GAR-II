# Changelog

All notable changes to this project will be documented in this file.

---

## [0.1.0] — 2026-07-23

### Added
- Complete 5-phase architecture implementation
- Single Hub Gateway (`workspace` tool)
- 6 capability modules: github, filesystem, notes, search, browser, calendar
- 4 Skills with progressive disclosure (pr-review, incident-response, deploy-check, research)
- Full Intelligence Layer:
  - Planner (execution graph generation)
  - Executor (DAG execution with dependency resolution)
  - Agent Runtime (Researcher, Coder, Reviewer, Executor)
  - Workflow Engine (reusable, version-controlled workflows)
- Plugin SDK foundation
- CLI (`claude-hub` command)
- Context Budget Manager with dynamic tool limiting
- Tool Search (`_search_tools`)
- L3 Semantic Memory (LanceDB)
- Hybrid Memory Search
- Server Cards (MCP 2026-07-28 spec compliant)
- Security features: Rate limiting, Secret scanner, JWT audience validation
- Comprehensive documentation (18+ files)

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)

---

*Initial release of the Claude Hub Gateway.*