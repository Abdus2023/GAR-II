import { Hono } from 'hono'
import { validateAuth } from '../auth/middleware'
import { client, initializeDatabase } from '../database'
import { kernel } from '../kernel'
import { contextBudget } from '../context/budget'
import { telemetry } from '../telemetry'

export const metricsRouter = new Hono()

metricsRouter.use('*', validateAuth)

function metricHelp(name: string, help: string, type: 'gauge' | 'counter') {
  return [`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`]
}

function labelValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function labels(values: Record<string, string | number | boolean | undefined>) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return ''

  return `{${entries.map(([key, value]) => `${key}="${labelValue(String(value))}"`).join(',')}}`
}

async function toolCallMetrics() {
  await initializeDatabase()

  const summary = await client.execute(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS errors
    FROM tool_calls
  `)
  const byTool = await client.execute(`
    SELECT
      tool_id,
      COUNT(*) AS total,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS errors,
      AVG(duration_ms) AS avg_duration_ms
    FROM tool_calls
    GROUP BY tool_id
    ORDER BY total DESC
    LIMIT 100
  `)

  const row = summary.rows[0] as any | undefined
  return {
    total: Number(row?.total || 0),
    errors: Number(row?.errors || 0),
    byTool: byTool.rows.map((toolRow: any) => ({
      toolId: String(toolRow.tool_id),
      total: Number(toolRow.total || 0),
      errors: Number(toolRow.errors || 0),
      avgDurationMs: Number(toolRow.avg_duration_ms || 0),
    })),
  }
}

export async function renderPrometheusMetrics() {
  const lines: string[] = []
  const toolMetrics = await toolCallMetrics()
  const contextStatus = contextBudget.getStatus()

  lines.push(...metricHelp('claude_hub_modules_loaded', 'Number of currently loaded capability modules.', 'gauge'))
  lines.push(`claude_hub_modules_loaded ${kernel.getLoadedModules().length}`)

  lines.push(...metricHelp('claude_hub_tools_registered', 'Number of registered kernel tools.', 'gauge'))
  lines.push(`claude_hub_tools_registered ${kernel.getRegisteredTools().length}`)

  lines.push(...metricHelp('claude_hub_registry_version', 'Kernel registry version incremented on tool registry changes.', 'gauge'))
  lines.push(`claude_hub_registry_version ${kernel.getRegistryVersion()}`)

  lines.push(...metricHelp('claude_hub_context_remaining_tokens', 'Estimated remaining context budget tokens.', 'gauge'))
  lines.push(`claude_hub_context_remaining_tokens ${contextStatus.remaining}`)

  lines.push(...metricHelp('claude_hub_tool_calls_total', 'Total number of audited tool calls.', 'counter'))
  lines.push(`claude_hub_tool_calls_total ${toolMetrics.total}`)

  lines.push(...metricHelp('claude_hub_tool_call_errors_total', 'Total number of audited failed tool calls.', 'counter'))
  lines.push(`claude_hub_tool_call_errors_total ${toolMetrics.errors}`)

  lines.push(...metricHelp('claude_hub_tool_calls_by_tool_total', 'Total number of audited tool calls by tool.', 'counter'))
  for (const tool of toolMetrics.byTool) {
    lines.push(`claude_hub_tool_calls_by_tool_total${labels({ tool_id: tool.toolId })} ${tool.total}`)
  }

  lines.push(...metricHelp('claude_hub_tool_call_errors_by_tool_total', 'Total number of audited failed tool calls by tool.', 'counter'))
  for (const tool of toolMetrics.byTool) {
    lines.push(`claude_hub_tool_call_errors_by_tool_total${labels({ tool_id: tool.toolId })} ${tool.errors}`)
  }

  lines.push(...metricHelp('claude_hub_tool_call_duration_average_ms', 'Average audited tool-call duration by tool in milliseconds.', 'gauge'))
  for (const tool of toolMetrics.byTool) {
    lines.push(`claude_hub_tool_call_duration_average_ms${labels({ tool_id: tool.toolId })} ${tool.avgDurationMs}`)
  }

  lines.push(...metricHelp('claude_hub_telemetry_pending_spans', 'Number of queued telemetry spans awaiting export.', 'gauge'))
  lines.push(`claude_hub_telemetry_pending_spans ${telemetry.pendingSpanCount()}`)

  if (typeof process.uptime === 'function') {
    lines.push(...metricHelp('claude_hub_process_uptime_seconds', 'Node.js process uptime in seconds.', 'gauge'))
    lines.push(`claude_hub_process_uptime_seconds ${process.uptime()}`)
  }

  return `${lines.join('\n')}\n`
}

metricsRouter.get('/', async (c) => {
  const body = await renderPrometheusMetrics()
  return c.text(body, 200, {
    'content-type': 'text/plain; version=0.0.4; charset=utf-8',
  })
})
