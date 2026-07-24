import { describe, expect, it } from 'vitest'
import { Executor } from '../src/planner/executor'
import type { ExecutionGraph } from '../src/planner'
import { kernel } from '../src/kernel'

describe('Executor', () => {
  it('executes DAG nodes in dependency order and returns all results', async () => {
    await kernel.start()
    const executor = new Executor({ nodeTimeoutMs: 5_000 })
    const graph: ExecutionGraph = {
      id: 'test-dag',
      goal: 'test dependency execution',
      startNodes: ['a', 'b'],
      nodes: [
        {
          id: 'a',
          type: 'tool',
          tool: 'echo',
          input: { message: 'first branch' },
          dependsOn: [],
        },
        {
          id: 'b',
          type: 'tool',
          tool: 'echo',
          input: { message: 'second branch' },
          dependsOn: [],
        },
        {
          id: 'c',
          type: 'tool',
          tool: 'echo',
          input: { message: 'joined branch' },
          dependsOn: ['a', 'b'],
        },
      ],
    }

    const result = await executor.execute(graph, { userId: 'executor-test' })

    expect(result).toMatchObject({
      success: true,
      planId: 'test-dag',
    })
    expect(result.completed).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    expect(result.results).toMatchObject({
      a: { message: 'Echo: first branch' },
      b: { message: 'Echo: second branch' },
      c: { message: 'Echo: joined branch' },
    })
  })

  it('fails fast when a graph references missing dependencies', async () => {
    const executor = new Executor({ nodeTimeoutMs: 5_000 })
    const graph: ExecutionGraph = {
      id: 'missing-dependency',
      goal: 'test validation',
      startNodes: ['a'],
      nodes: [
        {
          id: 'a',
          type: 'tool',
          tool: 'echo',
          input: { message: 'will not run' },
          dependsOn: ['does-not-exist'],
        },
      ],
    }

    const result = await executor.execute(graph, { userId: 'executor-test' })

    expect(result).toMatchObject({
      success: false,
      planId: 'missing-dependency',
    })
    expect(result.error).toContain('depends on missing node')
  })
})
