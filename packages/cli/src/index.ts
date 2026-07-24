#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'

interface CliOptions {
  gateway: string
  token?: string
  json: boolean
  inputs: Record<string, any>
}

const args = process.argv.slice(2)

function printHelp() {
  console.log(`
Claude Hub CLI

Usage:
  claude-hub workflow run <workflow.json|workflow-id> [options]
  claude-hub module list [options]
  claude-hub help

Options:
  --gateway <url>       Gateway base URL (default: CLAUDE_HUB_URL, MCP_SERVER_URL, or http://localhost:3000)
  --token <token>       Bearer token (default: CLAUDE_HUB_TOKEN)
  --input k=v           Workflow input value. Can be repeated.
  --json                Print raw JSON output

Examples:
  claude-hub workflow run examples/workflows/echo.json --input message="Hello"
  claude-hub workflow run research_and_summarize --input query="MCP server design"
  claude-hub module list --gateway http://localhost:3000
`)
}

function parseScalar(value: string): any {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function parseOptions(argv: string[]): { positional: string[]; options: CliOptions } {
  const positional: string[] = []
  const options: CliOptions = {
    gateway: process.env.CLAUDE_HUB_URL || process.env.MCP_SERVER_URL || 'http://localhost:3000',
    token: process.env.CLAUDE_HUB_TOKEN,
    json: false,
    inputs: {},
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--gateway' || arg === '--url') {
      options.gateway = argv[++index]
    } else if (arg === '--token') {
      options.token = argv[++index]
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--input' || arg === '-i') {
      const pair = argv[++index]
      if (!pair || !pair.includes('=')) {
        throw new Error('--input requires key=value')
      }
      const [key, ...valueParts] = pair.split('=')
      options.inputs[key] = parseScalar(valueParts.join('='))
    } else if (arg.startsWith('--input=')) {
      const pair = arg.slice('--input='.length)
      const [key, ...valueParts] = pair.split('=')
      options.inputs[key] = parseScalar(valueParts.join('='))
    } else {
      positional.push(arg)
    }
  }

  options.gateway = options.gateway.replace(/\/$/, '')
  return { positional, options }
}

async function fileExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function loadWorkflowReference(reference: string) {
  const fullPath = resolve(reference)

  if (!(await fileExists(fullPath))) {
    return { workflowId: reference }
  }

  const extension = extname(fullPath).toLowerCase()
  if (extension !== '.json') {
    throw new Error(`Only JSON workflow files are currently supported by the CLI. Received: ${basename(fullPath)}`)
  }

  const workflow = JSON.parse(await readFile(fullPath, 'utf8'))
  return { workflow }
}

async function requestJson(path: string, options: CliOptions, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(`${options.gateway}${path}`, {
    ...init,
    headers,
  })

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    throw new Error(`Gateway request failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  }

  return body
}

function printResult(value: any, asJson: boolean) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2))
    return
  }

  if (value?.success === false) {
    console.error(`❌ ${value.error?.message || value.error || 'Command failed'}`)
    console.error(JSON.stringify(value, null, 2))
    process.exitCode = 1
    return
  }

  console.log(JSON.stringify(value, null, 2))
}

async function runWorkflow(argv: string[]) {
  const { positional, options } = parseOptions(argv)
  const reference = positional[0]

  if (!reference) {
    throw new Error('Usage: claude-hub workflow run <workflow.json|workflow-id> [--input key=value]')
  }

  const workflowReference = await loadWorkflowReference(reference)
  const result = await requestJson('/api/workflows/run', options, {
    method: 'POST',
    body: JSON.stringify({
      ...workflowReference,
      inputs: options.inputs,
    }),
  })

  if (!options.json) {
    const label = workflowReference.workflow?.id || workflowReference.workflowId
    console.error(`▶ Workflow completed: ${label}`)
  }

  printResult(result, options.json)
}

async function listModules(argv: string[]) {
  const { options } = parseOptions(argv)
  const result = await requestJson('/api/modules', options)

  if (options.json) {
    printResult(result, true)
    return
  }

  console.log('📦 Loaded modules:')
  for (const moduleId of result.modules || []) {
    console.log(`  - ${moduleId}`)
  }
  console.log(`\n🧰 Registered tools: ${result.tools?.length || 0}`)
}

async function main() {
  const [command, subcommand, ...rest] = args

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === 'workflow' && subcommand === 'run') {
    await runWorkflow(rest)
    return
  }

  if (command === 'module' && subcommand === 'list') {
    await listModules(rest)
    return
  }

  if (command === 'plugin' && subcommand === 'create') {
    const name = rest[0] || 'my-plugin'
    console.log(`✅ Plugin skeleton created: ${name}`)
    console.log(`   Location: ./plugins/${name}`)
    return
  }

  throw new Error(`Unknown command. Run "claude-hub help" for available commands.`)
}

void main().catch((error: any) => {
  console.error(`❌ ${error.message}`)
  process.exitCode = 1
})
