import { logger } from '../logger'

interface ToolMetadata {
  id: string
  description: string
  category: string
  cost: 'low' | 'medium' | 'high'
}

/**
 * Simple Tool Search (Phase 2 starting point)
 * 
 * In production this would use embeddings + vector similarity.
 * For now we use keyword matching + basic heuristics.
 */
export class ToolSearch {
  private tools: ToolMetadata[] = []

  registerTools(tools: ToolMetadata[]) {
    this.tools = tools
    logger.info({ count: tools.length }, 'Tools registered for search')
  }

  /**
   * Returns the top N most relevant tools for a query
   */
  search(query: string, limit: number = 8): ToolMetadata[] {
    const q = query.toLowerCase()

    const scored = this.tools.map(tool => {
      let score = 0
      const desc = tool.description.toLowerCase()

      // Simple keyword matching
      if (desc.includes(q)) score += 3
      if (tool.id.toLowerCase().includes(q)) score += 2
      if (tool.category.toLowerCase().includes(q)) score += 1

      // Boost low-cost tools
      if (tool.cost === 'low') score += 0.5

      return { tool, score }
    })

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.tool)
  }
}

export const toolSearch = new ToolSearch()