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
   * Selects the most relevant tools to expose (placeholder for future semantic ranking)
   */
  selectToolsForContext<T extends { id: string; description: string }>(
    tools: T[],
    maxTools: number = MAX_TOOLS_IN_CONTEXT
  ): T[] {
    // For now: simple strategy — take the first N tools
    // Future: implement semantic similarity ranking based on user message
    return tools.slice(0, maxTools)
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