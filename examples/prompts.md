# Ready-to-Use Prompts for Claude

Copy and paste these prompts when testing the Claude Hub Gateway.

---

## 1. Basic Connectivity Test

```
Use the workspace tool with action "echo" and message "Hello from my gateway!"
```

**Expected**: Claude should return "Echo: Hello from my gateway!"

---

## 2. Memory Test (Cross-Conversation)

**First conversation:**

```
Remember that my project is called "Claude Hub" and it uses TypeScript + Bun.
```

**New conversation:**

```
What is the name of my project and what tech stack does it use?
```

**Expected**: Claude uses `memory.get` and correctly recalls the information.

---

## 3. GitHub Tool Test

```
Search GitHub for "typescript http server framework" and show me the top 3 results.
```

**Expected**: Claude calls `github.search_repo` and displays relevant repositories.

---

## 4. Skill Trigger Test (PR Review)

```
Review PR #42 in anthropics/claude for security issues.
```

**Expected**: Claude detects the trigger and loads the `pr-review` skill.

---

## 5. Multi-Module Workflow

```
1. Search my notes for "authentication"
2. Then search GitHub for recent changes related to auth
3. Finally, create a summary note with your findings
```

**Expected**: Claude uses multiple modules in sequence.

---

## 6. Planning Test (Phase 4)

```
Create a plan to research the latest authentication best practices and summarize them.
```

Then:

```
Execute that plan.
```

**Expected**: Claude uses the Planner and Executor.

---

## 7. Workflow Test

```
Run the workflow called "research_and_summarize" with query "MCP 2026 updates".
```

**Expected**: Claude runs the predefined workflow.

---

## 8. Context Budget Awareness

```
What is the current context budget status?
```

**Expected**: Claude reads `workspace://schema` and shows token usage.

---

**Tip**: After each test, check the gateway logs to see tool calls and events.