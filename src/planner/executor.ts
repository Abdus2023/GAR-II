import { logger } from '../logger'
import { kernel } from '../kernel'
import { config } from '../config'
import type { ExecutionGraph, ExecutionNode } from './index'

export interface ExecutorOptions {
  /** Maximum time allowed for a single node execution before failing the plan. */
  nodeTimeoutMs?: number
}

interface ExecutionState {
  results: Map<string, any>
  completed: Set<string>
  pending: Set<string>
}

const DEFAULT_NODE_TIMEOUT_MS = config.executorNodeTimeoutMs

export class Executor {
  private readonly nodeTimeoutMs: number

  constructor(options: ExecutorOptions = {}) {
    this.nodeTimeoutMs = options.nodeTimeoutMs ?? DEFAULT_NODE_TIMEOUT_MS
  }

  async execute(graph: ExecutionGraph, ctx: { userId: string }) {
    logger.info({ planId: graph.id, nodes: graph.nodes.length }, 'Starting execution')

    try {
      this.validateGraph(graph)

      const state: ExecutionState = {
        results: new Map<string, any>(),
        completed: new Set<string>(),
        pending: new Set(graph.nodes.map(node => node.id)),
      }
      const nodeById = new Map(graph.nodes.map(node => [node.id, node]))

      while (state.pending.size > 0) {
        const readyNodes = Array.from(state.pending)
          .map(nodeId => nodeById.get(nodeId)!)
          .filter(node => node.dependsOn.every(depId => state.completed.has(depId)))

        if (readyNodes.length === 0) {
          const blocked = Array.from(state.pending).map(nodeId => {
            const node = nodeById.get(nodeId)!
            const waitingOn = node.dependsOn.filter(depId => !state.completed.has(depId))
            return { nodeId, waitingOn }
          })
          throw new Error(`Execution graph is blocked by a dependency cycle or failed dependency: ${JSON.stringify(blocked)}`)
        }

        await Promise.all(readyNodes.map(node => this.executeReadyNode(node, state, ctx)))
      }

      return {
        success: true,
        planId: graph.id,
        results: Object.fromEntries(state.results),
        completed: Array.from(state.completed),
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

  private validateGraph(graph: ExecutionGraph) {
    const nodeIds = new Set<string>()

    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate execution node id: ${node.id}`)
      }
      nodeIds.add(node.id)
    }

    for (const node of graph.nodes) {
      const missingDeps = node.dependsOn.filter(depId => !nodeIds.has(depId))
      if (missingDeps.length > 0) {
        throw new Error(`Node ${node.id} depends on missing node(s): ${missingDeps.join(', ')}`)
      }
    }

    const missingStartNodes = graph.startNodes.filter(nodeId => !nodeIds.has(nodeId))
    if (missingStartNodes.length > 0) {
      throw new Error(`Graph references missing start node(s): ${missingStartNodes.join(', ')}`)
    }
  }

  private async executeReadyNode(node: ExecutionNode, state: ExecutionState, ctx: { userId: string }) {
    state.pending.delete(node.id)
    logger.info({ nodeId: node.id, type: node.type }, 'Executing node')

    try {
      const result = await this.withTimeout(
        this.runNode(node, ctx),
        `Node ${node.id} timed out after ${this.nodeTimeoutMs}ms`
      )

      state.results.set(node.id, result)
      state.completed.add(node.id)
      logger.info({ nodeId: node.id }, 'Node execution completed')
    } catch (error: any) {
      logger.error({ nodeId: node.id, error: error.message }, 'Node execution failed')
      throw error
    }
  }

  private async runNode(node: ExecutionNode, ctx: { userId: string }) {
    if (node.type === 'tool' && node.tool) {
      return kernel.invoke(node.tool, node.input, ctx)
    }

    if (node.type === 'agent' && node.agent) {
      // Placeholder for agent execution until agent runtime wiring is completed.
      return { agent: node.agent, input: node.input, output: 'Agent result (skeleton)' }
    }

    if (node.type === 'decision') {
      // Placeholder decision node. Future versions can branch the graph here.
      return { decision: true, input: node.input }
    }

    return { status: 'skipped', reason: 'Unknown node type' }
  }

  private async withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
    let timeout: NodeJS.Timeout | undefined

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(message)), this.nodeTimeoutMs)
        }),
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }
}

export const executor = new Executor()
