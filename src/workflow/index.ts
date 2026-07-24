import { logger } from '../logger'
import { executor } from '../planner'
import type { ExecutionGraph } from '../planner'

export interface WorkflowStep {
  id: string
  tool?: string
  agent?: string
  input: Record<string, any>
  dependsOn?: string[]
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
}

function interpolateValue(value: any, inputs: Record<string, any>): any {
  if (typeof value === 'string') {
    const exactMatch = value.match(/^{{\s*([\w.-]+)\s*}}$/)
    if (exactMatch) {
      return inputs[exactMatch[1]] ?? value
    }

    return value.replace(/{{\s*([\w.-]+)\s*}}/g, (match, key) => {
      const replacement = inputs[key]
      return replacement === undefined ? match : String(replacement)
    })
  }

  if (Array.isArray(value)) {
    return value.map(item => interpolateValue(item, inputs))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, interpolateValue(entryValue, inputs)])
    )
  }

  return value
}

function resolveStepInput(step: WorkflowStep, inputs: Record<string, any>) {
  return {
    ...interpolateValue(step.input || {}, inputs),
    ...inputs,
  }
}

/**
 * Workflow Engine
 *
 * Allows defining reusable, version-controlled workflows and executing them as
 * dependency-aware planner graphs.
 */
export class WorkflowEngine {
  private workflows = new Map<string, WorkflowDefinition>()

  register(workflow: WorkflowDefinition) {
    this.workflows.set(workflow.id, workflow)
    logger.info({ workflow: workflow.id }, 'Workflow registered')
  }

  get(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id)
  }

  list(): WorkflowDefinition[] {
    return Array.from(this.workflows.values())
  }

  createExecutionGraph(
    workflow: WorkflowDefinition,
    inputs: Record<string, any> = {},
    graphId = `wf-${workflow.id}-${Date.now()}`
  ): ExecutionGraph {
    const nodes = workflow.steps.map(step => ({
      id: step.id,
      type: (step.tool ? 'tool' : 'agent') as 'tool' | 'agent',
      tool: step.tool,
      agent: step.agent,
      input: resolveStepInput(step, inputs),
      dependsOn: step.dependsOn || [],
    }))

    return {
      id: graphId,
      goal: workflow.name,
      nodes,
      startNodes: nodes.filter(node => node.dependsOn.length === 0).map(node => node.id),
    }
  }

  async runDefinition(
    workflow: WorkflowDefinition,
    inputs: Record<string, any> = {},
    ctx: { userId: string }
  ) {
    logger.info({ workflowId: workflow.id }, 'Running workflow definition')
    const graph = this.createExecutionGraph(workflow, inputs)
    return executor.execute(graph, ctx)
  }

  /**
   * Convert a registered workflow definition into an executable graph and run it.
   */
  async run(workflowId: string, inputs: Record<string, any> = {}, ctx: { userId: string }) {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      return { success: false, error: 'Workflow not found' }
    }

    logger.info({ workflowId }, 'Running workflow')
    return this.runDefinition(workflow, inputs, ctx)
  }
}

export const workflowEngine = new WorkflowEngine()

// Register a few example workflows
workflowEngine.register({
  id: 'research_and_summarize',
  name: 'Research and Summarize',
  description: 'Search for information and create a summary',
  steps: [
    { id: 'search', tool: 'search.query', input: { query: '{{query}}' } },
    { id: 'summarize', agent: 'researcher', input: { task: 'Summarize the search results for {{query}}' }, dependsOn: ['search'] },
  ],
})

workflowEngine.register({
  id: 'code_review_workflow',
  name: 'Code Review Workflow',
  description: 'Full PR review using multiple agents',
  steps: [
    { id: 'fetch', tool: 'github.review_pr', input: { owner: '{{owner}}', repo: '{{repo}}', pr_number: '{{pr_number}}' } },
    { id: 'review', agent: 'reviewer', input: { task: 'Review PR #{{pr_number}} in {{owner}}/{{repo}}' }, dependsOn: ['fetch'] },
  ],
})
