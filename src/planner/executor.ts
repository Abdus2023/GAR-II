import { logger } from '../logger'
import { kernel } from '../kernel'
import type { ExecutionGraph, ExecutionNode } from './index'

export class Executor {
  private results = new Map<string, any>()
  private status = new Map<string, 'pending' | 'running' | 'done' | 'failed'>()

  async execute(graph: ExecutionGraph, ctx: { userId: string }) {
    logger.info({ planId: graph.id, nodes: graph.nodes.length }, 'Starting execution')

    // Initialize status
    for (const node of graph.nodes) {
      this.status.set(node.id, 'pending')
    }

    try {
      await this.executeNodes(graph.startNodes, graph, ctx)

      return {
        success: true,
        planId: graph.id,
        results: Object.fromEntries(this.results),
      }
    } catch (error: any) {
      logger.error({ planId: graph.id, error: error.message }, 'Execution failed')
      return {
        success: false,
        planId: graph.id,
        error: error.message,
      }
    }
  }

  private async executeNodes(nodeIds: string[], graph: ExecutionGraph, ctx: { userId: string }) {
    await Promise.all(nodeIds.map(id => this.executeNode(id, graph, ctx)))
  }

  private async executeNode(nodeId: string, graph: ExecutionGraph, ctx: { userId: string }) {
    const node = graph.nodes.find(n => n.id === nodeId)!
    if (!node) return

    // Wait for dependencies
    await Promise.all(
      node.dependsOn.map(depId => this.waitForNode(depId))
    )

    this.status.set(nodeId, 'running')

    try {
      let result: any

      if (node.type === 'tool' && node.tool) {
        result = await kernel.invoke(node.tool, node.input, ctx)
      } else if (node.type === 'agent' && node.agent) {
        // Placeholder for agent execution
        result = { agent: node.agent, input: node.input, output: 'Agent result (skeleton)' }
      } else {
        result = { status: 'skipped', reason: 'Unknown node type' }
      }

      this.results.set(nodeId, result)
      this.status.set(nodeId, 'done')

      // Find newly unlocked nodes
      const unlocked = graph.nodes.filter(n =>
        n.dependsOn.includes(nodeId) &&
        n.dependsOn.every(d => this.status.get(d) === 'done')
      )

      if (unlocked.length > 0) {
        await this.executeNodes(unlocked.map(n => n.id), graph, ctx)
      }
    } catch (error: any) {
      this.status.set(nodeId, 'failed')
      logger.error({ nodeId, error: error.message }, 'Node execution failed')
      throw error
    }
  }

  private waitForNode(nodeId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const s = this.status.get(nodeId)
        if (s === 'done') resolve()
        else if (s === 'failed') reject(new Error(`Dependency ${nodeId} failed`))
        else setTimeout(check, 50)
      }
      check()
    })
  }
}

export const executor = new Executor()