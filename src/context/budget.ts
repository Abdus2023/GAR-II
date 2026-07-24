import { logger } from '../logger'

interface ContextUsage {
  systemPrompt: number
  userMessage: number
  toolSchemas: number
  memoryResults: number
  toolResults: number
  total: number
}

const MAX_CONTEXT = 200_000
const RESERVE_FOR_RESPONSE = 8_000
const MAX_TOOLS_IN_CONTEXT = 10
const AVG_TOOL_SCHEMA_TOKENS = 350

export class ContextBudgetManager {
  private usage: ContextUsage = this.getInitialUsage()

  private getInitialUsage(): ContextUsage {
    return {
      systemPrompt: 2000,
      userMessage: 0,
      toolSchemas: 0,
      memoryResults: 0,
      toolResults: 0,
      total: 2000,
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * Returns the maximum number of tools that can safely be shown
   */
  getMaxToolsForContext(availableTools: number): number {
    const baseTokens = this.usage.systemPrompt + RESERVE_FOR_RESPONSE
    const remaining = MAX_CONTEXT - baseTokens
    const maxByTokens = Math.floor(remaining / AVG_TOOL_SCHEMA_TOKENS)

    return Math.min(maxByTokens, MAX_TOOLS_IN_CONTEXT, availableTools)
  }

  /**
   * Selects the most relevant tools to expose.
   *
   * This intentionally stays lightweight: it ranks by lexical overlap across tool id,
   * description, and optional category/cost metadata. A future embedding model can
   * replace the scorer without changing callers.
   */
  selectToolsForContext<T extends { id: string; description: string; category?: string; cost?: string }>(
    tools: T[],
    maxTools: number = MAX_TOOLS_IN_CONTEXT,
    query?: string
  ): T[] {
    if (!query?.trim()) {
      return tools.slice(0, maxTools)
    }

    const normalizedQuery = query.toLowerCase()
    const terms = normalizedQuery
      .split(/[^a-z0-9_.-]+/)
      .map(term => term.trim())
      .filter(term => term.length > 2)

    const scored = tools.map((tool, index) => {
      const id = tool.id.toLowerCase()
      const description = tool.description.toLowerCase()
      const category = tool.category?.toLowerCase() || ''
      let score = 0

      if (id === normalizedQuery) score += 10
      if (id.includes(normalizedQuery)) score += 6
      if (description.includes(normalizedQuery)) score += 4
      if (category.includes(normalizedQuery)) score += 2

      for (const term of terms) {
        if (id.includes(term)) score += 3
        if (description.includes(term)) score += 2
        if (category.includes(term)) score += 1
      }

      if (tool.cost === 'low') score += 0.25

      return { tool, score, index }
    })

    return scored
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, maxTools)
      .map(entry => entry.tool)
  }

  /**
   * Records the token cost of the selected tool schemas
   */
  setToolSchemaCost(toolCount: number) {
    this.usage.toolSchemas = toolCount * AVG_TOOL_SCHEMA_TOKENS
    this.recalculateTotal()
  }

  addMemoryUsage(tokens: number) {
    this.usage.memoryResults += tokens
    this.recalculateTotal()
  }

  addToolResult(tokens: number) {
    this.usage.toolResults += tokens
    this.recalculateTotal()
  }

  private recalculateTotal() {
    this.usage.total =
      this.usage.systemPrompt +
      this.usage.userMessage +
      this.usage.toolSchemas +
      this.usage.memoryResults +
      this.usage.toolResults
  }

  reset(userMessageTokens: number = 0) {
    this.usage = {
      systemPrompt: 2000,
      userMessage: userMessageTokens,
      toolSchemas: 0,
      memoryResults: 0,
      toolResults: 0,
      total: 2000 + userMessageTokens,
    }
  }

  getStatus() {
    const utilization = ((this.usage.total / MAX_CONTEXT) * 100).toFixed(1)
    return {
      ...this.usage,
      remaining: MAX_CONTEXT - this.usage.total,
      utilization: `${utilization}%`,
      maxTools: this.getMaxToolsForContext(999),
    }
  }

  checkWarnings(): string[] {
    const warnings: string[] = []
    const utilization = this.usage.total / MAX_CONTEXT

    if (utilization > 0.85) {
      warnings.push('Context usage > 85% — consider summarizing older messages')
    }
    if (utilization > 0.95) {
      warnings.push('CRITICAL: Context usage > 95% — aggressive truncation required')
    }
    return warnings
  }
}

export const contextBudget = new ContextBudgetManager()