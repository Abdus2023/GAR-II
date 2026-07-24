import { logger } from '../logger'

export interface ExecutionNode {
  id: string
  type: 'tool' | 'agent' | 'decision'
  tool?: string
  agent?: string
  input: Record<string, any>
  dependsOn: string[]
}

export interface ExecutionGraph {
  id: string
  goal: string
  nodes: ExecutionNode[]
  startNodes: string[]
}

/**
 * Planner (Phase 4 skeleton)
 */
export class Planner {
  async createPlan(goal: string, context: any = {}): Promise<ExecutionGraph> {
    logger.info({ goal }, 'Creating execution plan (skeleton)')

    const graph: ExecutionGraph = {
      id: `plan-${Date.now()}`,
      goal,
      nodes: [
        {
          id: 'step-1',
          type: 'tool',
          tool: 'search.query',
          input: { query: goal },
          dependsOn: [],
        },
      ],
      startNodes: ['step-1'],
    }

    return graph
  }

  async executeGraph(graph: ExecutionGraph, ctx: { userId: string }) {
    logger.info({ planId: graph.id }, 'Executing plan')
    const completed = new Set<string>()
    const results: Record<string, any> = {}
    for (const node of graph.nodes) {
      if (node.dependsOn.every(dep => completed.has(dep))) {
        results[node.id] = { executed: node.id }
        completed.add(node.id)
      }
    }
    return {
      success: true,
      planId: graph.id,
      result: results,
      completed: Array.from(completed),
    }
  }
}

export const planner = new Planner()