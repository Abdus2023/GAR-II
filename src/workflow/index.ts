import { logger } from '../logger'
import { planner, executor } from '../planner'
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

/**
 * Workflow Engine (Phase 4 skeleton)
 * 
 * Allows defining reusable, version-controlled workflows.
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

  /**
   * Convert a workflow definition into an executable graph
   */
  async run(workflowId: string, inputs: Record<string, any> = {}, ctx: { userId: string }) {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      return { success: false, error: 'Workflow not found' }
    }

    logger.info({ workflowId }, 'Running workflow')

    // Convert steps to ExecutionGraph format
    const nodes = workflow.steps.map(step => ({
      id: step.id,
      type: (step.tool ? 'tool' : 'agent') as 'tool' | 'agent',
      tool: step.tool,
      agent: step.agent,
      input: { ...step.input, ...inputs },
      dependsOn: step.dependsOn || [],
    }))

    const graph: ExecutionGraph = {
      id: `wf-${workflowId}-${Date.now()}`,
      goal: workflow.name,
      nodes,
      startNodes: nodes.filter(n => n.dependsOn.length === 0).map(n => n.id),
    }

    return executor.execute(graph, ctx)
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
    { id: 'summarize', agent: 'researcher', input: { task: 'Summarize the search results' }, dependsOn: ['search'] },
  ],
})

workflowEngine.register({
  id: 'code_review_workflow',
  name: 'Code Review Workflow',
  description: 'Full PR review using multiple agents',
  steps: [
    { id: 'fetch', tool: 'github.review_pr', input: { owner: '{{owner}}', repo: '{{repo}}', pr_number: '{{pr_number}}' } },
    { id: 'review', agent: 'reviewer', input: { task: 'Review the PR' }, dependsOn: ['fetch'] },
  ],
})