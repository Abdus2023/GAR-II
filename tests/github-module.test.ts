import { describe, expect, it, vi } from 'vitest'
import GitHubModule from '../modules/github/src/index'

const moduleContext = () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
  events: { emit: vi.fn() },
  config: {},
  cache: new Map(),
  invoke: vi.fn(),
})

describe('GitHubModule', () => {
  it('searches repositories through Octokit-compatible clients', async () => {
    const fakeClient = {
      rest: {
        search: {
          repos: vi.fn().mockResolvedValue({
            data: {
              total_count: 1,
              incomplete_results: false,
              items: [{
                full_name: 'owner/repo',
                description: 'Example repository',
                html_url: 'https://github.com/owner/repo',
                default_branch: 'main',
                language: 'TypeScript',
                stargazers_count: 42,
                forks_count: 7,
                open_issues_count: 3,
                updated_at: '2026-07-24T00:00:00Z',
              }],
            },
          }),
        },
      },
    }
    const github = new GitHubModule(fakeClient as any)
    const ctx = moduleContext()

    await github.initialize(ctx)
    const searchTool = github.tools().find(tool => tool.id === 'search_repo')!
    const result = await searchTool.execute({ query: 'language:typescript claude', limit: 1 }, { userId: 'test-user' })

    expect(fakeClient.rest.search.repos).toHaveBeenCalledWith({
      q: 'language:typescript claude',
      per_page: 1,
      sort: undefined,
      order: 'desc',
    })
    expect(result.repositories).toEqual([
      expect.objectContaining({ full_name: 'owner/repo', stars: 42 }),
    ])
    expect(ctx.events.emit).toHaveBeenCalledWith('github:search_performed', {
      query: 'language:typescript claude',
      results: 1,
    })
  })

  it('decodes repository file content', async () => {
    const fakeClient = {
      rest: {
        repos: {
          getContent: vi.fn().mockResolvedValue({
            data: {
              type: 'file',
              sha: 'abc123',
              size: 11,
              encoding: 'base64',
              html_url: 'https://github.com/owner/repo/blob/main/README.md',
              content: Buffer.from('hello world', 'utf8').toString('base64'),
            },
          }),
        },
      },
    }
    const github = new GitHubModule(fakeClient as any)

    await github.initialize(moduleContext())
    const readTool = github.tools().find(tool => tool.id === 'read_file')!
    const result = await readTool.execute({ repository: 'owner/repo', path: 'README.md' }, { userId: 'test-user' })

    expect(fakeClient.rest.repos.getContent).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      path: 'README.md',
      ref: undefined,
    })
    expect(result).toMatchObject({
      success: true,
      owner: 'owner',
      repo: 'repo',
      path: 'README.md',
      type: 'file',
      content: 'hello world',
      truncated: false,
    })
  })

  it('creates GitHub issues through Octokit-compatible clients', async () => {
    const fakeClient = {
      rest: {
        issues: {
          create: vi.fn().mockResolvedValue({
            data: {
              id: 123,
              number: 7,
              title: 'Bug report',
              state: 'open',
              html_url: 'https://github.com/owner/repo/issues/7',
              user: { login: 'reporter' },
              labels: [{ name: 'bug' }],
              assignees: [{ login: 'maintainer' }],
              created_at: '2026-07-24T00:00:00Z',
              updated_at: '2026-07-24T00:00:00Z',
            },
          }),
        },
      },
    }
    const github = new GitHubModule(fakeClient as any)
    const ctx = moduleContext()

    await github.initialize(ctx)
    const createTool = github.tools().find(tool => tool.id === 'create_issue')!
    const result = await createTool.execute({
      repository: 'owner/repo',
      title: 'Bug report',
      body: 'Something is broken',
      labels: ['bug'],
      assignees: ['maintainer'],
    }, { userId: 'test-user' })

    expect(fakeClient.rest.issues.create).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      title: 'Bug report',
      body: 'Something is broken',
      labels: ['bug'],
      assignees: ['maintainer'],
    })
    expect(ctx.events.emit).toHaveBeenCalledWith('github:issue_created', {
      owner: 'owner',
      repo: 'repo',
      issue_number: 7,
      title: 'Bug report',
    })
    expect(result).toMatchObject({
      success: true,
      issue: {
        number: 7,
        title: 'Bug report',
        labels: ['bug'],
        assignees: ['maintainer'],
      },
    })
  })
})
