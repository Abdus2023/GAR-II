import { describe, expect, it } from 'vitest'
import { ContextBudgetManager } from '../src/context/budget'

describe('ContextBudgetManager', () => {
  it('ranks tools by query relevance while respecting the max tool limit', () => {
    const budget = new ContextBudgetManager()
    const tools = [
      {
        id: 'memory.get',
        description: 'Retrieve a previously stored value',
        category: 'memory',
        cost: 'low',
      },
      {
        id: 'github.review_pr',
        description: 'Fetch pull request details and diff for code review',
        category: 'developer',
        cost: 'medium',
      },
      {
        id: 'notes.create',
        description: 'Create a new personal note',
        category: 'notes',
        cost: 'low',
      },
    ]

    const selected = budget.selectToolsForContext(tools, 1, 'review pull request')

    expect(selected).toEqual([
      expect.objectContaining({ id: 'github.review_pr' }),
    ])
  })

  it('preserves registration order when no query is provided', () => {
    const budget = new ContextBudgetManager()
    const tools = [
      { id: 'a', description: 'first' },
      { id: 'b', description: 'second' },
      { id: 'c', description: 'third' },
    ]

    expect(budget.selectToolsForContext(tools, 2).map(tool => tool.id)).toEqual(['a', 'b'])
  })
})
