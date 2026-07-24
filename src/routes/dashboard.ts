import { Hono } from 'hono'
import { desc } from 'drizzle-orm'
import { validateAuth } from '../auth/middleware'
import { db, initializeDatabase, toolCalls } from '../database'
import { kernel } from '../kernel'
import { workflowEngine } from '../workflow'
import { skillRuntime } from '../skills/runtime'
import { contextBudget } from '../context/budget'

export const dashboardRouter = new Hono()

dashboardRouter.use('*', validateAuth)

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function getDashboardData() {
  await initializeDatabase()

  const recentToolCalls = await db.query.toolCalls.findMany({
    orderBy: desc(toolCalls.createdAt),
    limit: 25,
  })

  const tools = kernel.getRegisteredToolMetadata()
  const modules = kernel.getLoadedModules()
  const workflows = workflowEngine.list()
  const skills = skillRuntime.listSkills()

  return {
    status: 'ok',
    generated_at: new Date().toISOString(),
    registry_version: kernel.getRegistryVersion(),
    modules,
    module_count: modules.length,
    tools,
    tool_count: tools.length,
    workflows,
    workflow_count: workflows.length,
    skills,
    skill_count: skills.length,
    context_budget: contextBudget.getStatus(),
    recent_tool_calls: recentToolCalls.map(call => ({
      id: call.id,
      user_id: call.userId,
      tool_id: call.toolId,
      action: call.action,
      duration_ms: call.durationMs,
      error: call.error,
      created_at: call.createdAt,
    })),
  }
}

function renderDashboardHtml(data: Awaited<ReturnType<typeof getDashboardData>>) {
  const moduleItems = data.modules.map(moduleId => `<li>${escapeHtml(moduleId)}</li>`).join('')
  const toolRows = data.tools.map(tool => `
    <tr>
      <td><code>${escapeHtml(tool.id)}</code></td>
      <td>${escapeHtml(tool.category)}</td>
      <td>${escapeHtml(tool.cost)}</td>
      <td>${escapeHtml(tool.description)}</td>
    </tr>
  `).join('')
  const callRows = data.recent_tool_calls.map(call => `
    <tr>
      <td><code>${escapeHtml(call.action)}</code></td>
      <td>${call.duration_ms ?? ''}</td>
      <td>${call.error ? `<span class="error">${escapeHtml(call.error)}</span>` : '<span class="ok">ok</span>'}</td>
      <td>${new Date(call.created_at).toISOString()}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Claude Hub Gateway Dashboard</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 2rem; background: #0f172a; color: #e2e8f0; }
    main { max-width: 1180px; margin: 0 auto; }
    h1, h2 { margin: 0 0 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .card { background: #111827; border: 1px solid #334155; border-radius: 12px; padding: 1rem; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
    .metric { font-size: 2rem; font-weight: 700; }
    .label { color: #94a3b8; font-size: .9rem; }
    table { width: 100%; border-collapse: collapse; margin-top: .75rem; }
    th, td { border-bottom: 1px solid #334155; padding: .6rem; text-align: left; vertical-align: top; }
    th { color: #cbd5e1; }
    code { color: #93c5fd; }
    .ok { color: #86efac; }
    .error { color: #fca5a5; }
    a { color: #93c5fd; }
  </style>
</head>
<body>
  <main>
    <h1>Claude Hub Gateway Dashboard</h1>
    <p class="label">Generated at ${escapeHtml(data.generated_at)} · Registry version ${data.registry_version}</p>
    <p><a href="/dashboard/data">View JSON data</a></p>

    <section class="grid" aria-label="gateway metrics">
      <div class="card"><div class="metric">${data.module_count}</div><div class="label">Loaded modules</div></div>
      <div class="card"><div class="metric">${data.tool_count}</div><div class="label">Registered tools</div></div>
      <div class="card"><div class="metric">${data.workflow_count}</div><div class="label">Workflows</div></div>
      <div class="card"><div class="metric">${data.skill_count}</div><div class="label">Skills</div></div>
      <div class="card"><div class="metric">${escapeHtml(data.context_budget.utilization)}</div><div class="label">Context utilization</div></div>
    </section>

    <section class="card">
      <h2>Modules</h2>
      <ul>${moduleItems}</ul>
    </section>

    <section class="card">
      <h2>Registered Tools</h2>
      <table>
        <thead><tr><th>Tool</th><th>Category</th><th>Cost</th><th>Description</th></tr></thead>
        <tbody>${toolRows}</tbody>
      </table>
    </section>

    <section class="card">
      <h2>Recent Tool Calls</h2>
      <table>
        <thead><tr><th>Action</th><th>Duration (ms)</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>${callRows || '<tr><td colspan="4">No tool calls recorded yet.</td></tr>'}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`
}

async function renderDashboard(c: any) {
  const data = await getDashboardData()
  return c.html(renderDashboardHtml(data))
}

dashboardRouter.get('/', renderDashboard)
dashboardRouter.get('', renderDashboard)

dashboardRouter.get('/data', async (c) => {
  return c.json(await getDashboardData())
})
