import { describe, it, expect } from 'vitest'
import { Planner } from '../src/planner'

describe('Planner', () => {
  it('should create a basic plan', async () => {
    const planner = new Planner()
    const plan = await planner.createPlan('test goal')
    expect(plan.goal).toBe('test goal')
    expect(plan.nodes.length).toBeGreaterThan(0)
  })
})
