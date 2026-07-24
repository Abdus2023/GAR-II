const MAX_CONTEXT = 200_000; // Claude's current limit
const RESERVE_FOR_RESPONSE = 8_000;
const MAX_TOOLS_IN_CONTEXT = 10;
export class ContextBudgetManager {
    usage = {
        systemPrompt: 2000,
        userMessage: 0,
        toolSchemas: 0,
        memoryResults: 0,
        toolResults: 0,
        total: 0,
    };
    // Estimate tokens (rough: 4 chars ≈ 1 token)
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    // Calculate how many tools we can safely expose
    calculateSafeToolCount(availableTools) {
        const baseTokens = this.usage.systemPrompt + RESERVE_FOR_RESPONSE;
        const tokensPerTool = 350; // average tool schema size
        const remaining = MAX_CONTEXT - baseTokens;
        const maxTools = Math.floor(remaining / tokensPerTool);
        return Math.min(maxTools, MAX_TOOLS_IN_CONTEXT, availableTools);
    }
    // Check if we have room for more context
    canAddMemory(tokens) {
        return this.usage.total + tokens < MAX_CONTEXT - RESERVE_FOR_RESPONSE;
    }
    // Record memory usage
    addMemoryUsage(tokens) {
        this.usage.memoryResults += tokens;
        this.recalculateTotal();
    }
    // Record tool result usage
    addToolResult(tokens) {
        this.usage.toolResults += tokens;
        this.recalculateTotal();
    }
    recalculateTotal() {
        this.usage.total =
            this.usage.systemPrompt +
                this.usage.userMessage +
                this.usage.toolSchemas +
                this.usage.memoryResults +
                this.usage.toolResults;
    }
    // Get current budget status
    getStatus() {
        return {
            ...this.usage,
            remaining: MAX_CONTEXT - this.usage.total,
            utilization: ((this.usage.total / MAX_CONTEXT) * 100).toFixed(1) + '%',
        };
    }
    // Reset for new request
    reset(userMessageTokens = 0) {
        this.usage = {
            systemPrompt: 2000,
            userMessage: userMessageTokens,
            toolSchemas: 0,
            memoryResults: 0,
            toolResults: 0,
            total: 2000 + userMessageTokens,
        };
    }
    // Warn if approaching limit
    checkWarnings() {
        const warnings = [];
        const utilization = this.usage.total / MAX_CONTEXT;
        if (utilization > 0.85) {
            warnings.push('Context usage > 85% — consider summarizing older messages');
        }
        if (utilization > 0.95) {
            warnings.push('CRITICAL: Context usage > 95% — aggressive truncation required');
        }
        return warnings;
    }
}
export const contextBudget = new ContextBudgetManager();
