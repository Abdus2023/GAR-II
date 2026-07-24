---
name: research
description: >
  Conducts thorough research on a topic by searching multiple sources, synthesizing
  information, and providing well-cited results. Use when the user asks to research,
  investigate, or gather information on any topic.
slash_command: true
auto_trigger: true
triggers:
  - "research"
  - "investigate"
  - "gather information about"
  - "what do we know about"
requires:
  - search
  - github
version: 1.0
---

## Research Workflow

### Step 1: Clarify the Research Question
- Ask for clarification if the topic is too broad
- Define scope and time period if relevant
- Identify key aspects to investigate

### Step 2: Multi-Source Search
Use the following sources in parallel when appropriate:

1. **Web Search** — General knowledge and recent developments
2. **GitHub** — Code examples, open source projects, discussions
3. **Internal Documentation** — Company/project-specific context

### Step 3: Synthesis
- Identify common themes across sources
- Note conflicting information
- Highlight the most credible/recent sources
- Include direct quotes or citations where helpful

### Step 4: Structured Output

```
## Research: [Topic]

### Summary
[2-4 sentence overview]

### Key Findings
1. [Finding with source]
2. [Finding with source]
3. [Finding with source]

### Sources
- [Source 1] - [Brief description]
- [Source 2] - [Brief description]

### Recommendations / Next Steps
- [Actionable recommendation]
- [Further research suggestion]
```

### Step 5: Ask for Follow-up
After presenting results, ask:
- "Would you like me to dive deeper into any area?"
- "Should I research related topics?"
- "Would you like sources for implementation?"

## Quality Standards
- Always cite sources
- Distinguish between facts and opinions
- Note the date/recency of information
- Acknowledge limitations of the research

## Trigger Phrases
- "Research authentication best practices"
- "Investigate the latest developments in..."
- "What do we know about..."
- "Help me understand..."