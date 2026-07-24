import { Hono } from 'hono'
import { z } from 'zod'
import { validateAuth } from '../auth/middleware'
import { jsonBodyLimit } from '../middleware/body-size-limit'
import { serializeGatewayError } from '../errors'
import { kernel } from '../kernel'
import { workflowEngine } from '../workflow'

export const apiRouter = new Hono()

apiRouter.use('*', jsonBodyLimit)
apiRouter.use('*', validateAuth)

const WorkspaceInvokeInput = z.object({
  action: z.string().min(1),
  params: z.record(z.any()).default({}),
})

const WorkflowStepInput = z.object({
  id: z.string().min(1),
  tool: z.string().min(1).optional(),
  agent: z.string().min(1).optional(),
  input: z.record(z.any()).default({}),
  dependsOn: z.array(z.string()).default([]),
}).refine(step => step.tool || step.agent, {
  message: 'Each workflow step must define either tool or agent',
})

const WorkflowDefinitionInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  steps: z.array(WorkflowStepInput).min(1),
})

const WorkflowRunInput = z.object({
  workflowId: z.string().min(1).optional(),
  workflow: WorkflowDefinitionInput.optional(),
  inputs: z.record(z.any()).default({}),
}).refine(input => input.workflowId || input.workflow, {
  message: 'Provide workflowId or workflow',
})

async function readJson(c: any) {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

function userIdFromContext(c: any) {
  return c.get('userId') || 'api-user'
}

apiRouter.get('/modules', (c) => {
  return c.json({
    modules: kernel.getLoadedModules(),
    tools: kernel.getRegisteredToolMetadata(),
    registry_version: kernel.getRegistryVersion(),
  })
})

apiRouter.get('/workflows', (c) => {
  return c.json({
    workflows: workflowEngine.list(),
  })
})

apiRouter.post('/workspace', async (c) => {
  const parsed = WorkspaceInvokeInput.safeParse(await readJson(c))

  if (!parsed.success) {
    return c.json({ error: 'invalid_request', details: parsed.error.issues }, 400)
  }

  try {
    const result = await kernel.invoke(parsed.data.action, parsed.data.params, {
      userId: userIdFromContext(c),
    })

    return c.json({ success: true, result })
  } catch (error) {
    const serializedError = serializeGatewayError(error)
    return c.json({ success: false, error: serializedError }, serializedError.status as any)
  }
})

apiRouter.post('/workflows/run', async (c) => {
  const parsed = WorkflowRunInput.safeParse(await readJson(c))

  if (!parsed.success) {
    return c.json({ error: 'invalid_request', details: parsed.error.issues }, 400)
  }

  const { workflowId, workflow, inputs } = parsed.data
  const ctx = { userId: userIdFromContext(c) }
  const result = workflow
    ? await workflowEngine.runDefinition(workflow, inputs, ctx)
    : await workflowEngine.run(workflowId!, inputs, ctx)

  return c.json(result)
})
