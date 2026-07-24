import { z } from 'zod'
import { Octokit } from 'octokit'
import { config } from '../../../src/config'
import type { Module, ModuleContext, Tool } from '../../../src/kernel/types'

interface GitHubClient {
  rest: any
  request?: (...args: any[]) => Promise<any>
  paginate?: (...args: any[]) => Promise<any[]>
}

interface RepoCoordinates {
  owner: string
  repo: string
}

const repoFields = {
  owner: z.string().min(1).optional(),
  repo: z.string().min(1).optional(),
  repository: z.string().min(1).optional().describe('Repository in owner/repo format'),
}

function requireRepository(input: { owner?: string; repo?: string; repository?: string }, ctx: z.RefinementCtx) {
  if (input.repository) {
    const [owner, repo, extra] = input.repository.split('/')
    if (!owner || !repo || extra) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['repository'],
        message: 'repository must use owner/repo format',
      })
    }
    return
  }

  if (!input.owner || !input.repo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['repository'],
      message: 'provide either repository or both owner and repo',
    })
  }
}

const SearchRepoInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
  sort: z.enum(['stars', 'forks', 'help-wanted-issues', 'updated']).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
})

const ReadFileInput = z.object({
  ...repoFields,
  path: z.string().min(1),
  ref: z.string().min(1).optional(),
  max_bytes: z.number().int().min(1_000).max(1_000_000).default(100_000),
}).superRefine(requireRepository)

const ReviewPrInput = z.object({
  ...repoFields,
  pr_number: z.number().int().positive().optional(),
  pull_number: z.number().int().positive().optional(),
  include_diff: z.boolean().default(true),
  max_diff_chars: z.number().int().min(1_000).max(500_000).default(50_000),
  max_files: z.number().int().min(1).max(300).default(100),
}).superRefine((input, ctx) => {
  requireRepository(input, ctx)

  if (!input.pr_number && !input.pull_number) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pr_number'],
      message: 'provide pr_number or pull_number',
    })
  }
})

const CreateIssueInput = z.object({
  ...repoFields,
  title: z.string().min(1),
  body: z.string().default(''),
  labels: z.array(z.string()).default([]),
  assignees: z.array(z.string()).default([]),
}).superRefine(requireRepository)

function createDefaultClient(): GitHubClient {
  return new Octokit(config.githubToken ? { auth: config.githubToken } : {}) as unknown as GitHubClient
}

function normalizeRepo(input: { owner?: string; repo?: string; repository?: string }): RepoCoordinates {
  if (input.repository) {
    const [owner, repo] = input.repository.split('/')
    return { owner, repo }
  }

  return { owner: input.owner!, repo: input.repo! }
}

function decodeContent(data: any): string {
  if (data.encoding === 'base64') {
    return Buffer.from(String(data.content || '').replace(/\n/g, ''), 'base64').toString('utf8')
  }

  return String(data.content || '')
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) {
    return { text, truncated: false }
  }

  return {
    text: `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} characters]`,
    truncated: true,
  }
}

export default class GitHubModule implements Module {
  private ctx!: ModuleContext
  private readonly client: GitHubClient

  constructor(client: GitHubClient = createDefaultClient()) {
    this.client = client
  }

  manifest() {
    return {
      id: 'github',
      version: '1.0.0',
      permissions: ['github.read', 'github.write'],
      dependencies: ['auth'],
    }
  }

  async initialize(ctx: ModuleContext) {
    this.ctx = ctx
    this.ctx.logger.info(
      { authenticated: Boolean(config.githubToken) },
      'GitHub module initialized'
    )
  }

  tools(): Tool[] {
    return [
      {
        id: 'search_repo',
        description: 'Search GitHub repositories by keyword, topic, language, or owner',
        inputSchema: SearchRepoInput,
        execute: this.searchRepo.bind(this),
      },
      {
        id: 'read_file',
        description: 'Read a file or directory listing from a GitHub repository',
        inputSchema: ReadFileInput,
        execute: this.readFile.bind(this),
      },
      {
        id: 'review_pr',
        description: 'Fetch pull request metadata, changed files, reviews, and diff for code review',
        inputSchema: ReviewPrInput,
        execute: this.reviewPr.bind(this),
      },
      {
        id: 'create_issue',
        description: 'Create a GitHub issue (requires confirmation)',
        inputSchema: CreateIssueInput,
        execute: this.createIssue.bind(this),
      },
    ]
  }

  private async searchRepo(input: z.infer<typeof SearchRepoInput>) {
    const limit = input.limit ?? 10
    const order = input.order ?? 'desc'

    const response = await this.client.rest.search.repos({
      q: input.query,
      per_page: limit,
      sort: input.sort,
      order,
    })

    const repositories = (response.data.items || []).map((repo: any) => ({
      full_name: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      default_branch: repo.default_branch,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      open_issues: repo.open_issues_count,
      updated_at: repo.updated_at,
    }))

    this.ctx.events.emit('github:search_performed', {
      query: input.query,
      results: repositories.length,
    })

    return {
      success: true,
      query: input.query,
      total_count: response.data.total_count,
      incomplete_results: response.data.incomplete_results,
      repositories,
    }
  }

  private async readFile(input: z.infer<typeof ReadFileInput>) {
    const { owner, repo } = normalizeRepo(input)
    const response = await this.client.rest.repos.getContent({
      owner,
      repo,
      path: input.path,
      ref: input.ref,
    })

    const data = response.data

    this.ctx.events.emit('github:file_read', {
      owner,
      repo,
      path: input.path,
      ref: input.ref,
    })

    if (Array.isArray(data)) {
      return {
        success: true,
        owner,
        repo,
        path: input.path,
        ref: input.ref,
        type: 'directory',
        entries: data.map((entry: any) => ({
          name: entry.name,
          path: entry.path,
          type: entry.type,
          size: entry.size,
          sha: entry.sha,
          url: entry.html_url,
        })),
      }
    }

    if (data.type !== 'file') {
      return {
        success: true,
        owner,
        repo,
        path: input.path,
        ref: input.ref,
        type: data.type,
        sha: data.sha,
        size: data.size,
        url: data.html_url,
      }
    }

    const decoded = decodeContent(data)
    const truncated = truncateText(decoded, input.max_bytes ?? 100_000)

    return {
      success: true,
      owner,
      repo,
      path: input.path,
      ref: input.ref,
      type: 'file',
      sha: data.sha,
      size: data.size,
      encoding: data.encoding,
      url: data.html_url,
      content: truncated.text,
      truncated: truncated.truncated,
    }
  }

  private async reviewPr(input: z.infer<typeof ReviewPrInput>) {
    const { owner, repo } = normalizeRepo(input)
    const pullNumber = input.pr_number || input.pull_number!

    const [pullResponse, files] = await Promise.all([
      this.client.rest.pulls.get({ owner, repo, pull_number: pullNumber }),
      this.paginatePullFiles(owner, repo, pullNumber, input.max_files ?? 100),
    ])

    const pull = pullResponse.data
    const diff = input.include_diff ?? true
      ? await this.fetchPullDiff(owner, repo, pullNumber, input.max_diff_chars ?? 50_000)
      : { text: undefined, truncated: false }

    this.ctx.events.emit('github:pr_reviewed', {
      owner,
      repo,
      pr_number: pullNumber,
      changed_files: files.length,
    })

    return {
      success: true,
      owner,
      repo,
      pr_number: pullNumber,
      pull_request: {
        title: pull.title,
        state: pull.state,
        draft: pull.draft,
        url: pull.html_url,
        user: pull.user?.login,
        body: pull.body,
        base: pull.base?.ref,
        head: pull.head?.ref,
        created_at: pull.created_at,
        updated_at: pull.updated_at,
        merged_at: pull.merged_at,
        additions: pull.additions,
        deletions: pull.deletions,
        changed_files: pull.changed_files,
      },
      files: files.map((file: any) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        raw_url: file.raw_url,
        blob_url: file.blob_url,
      })),
      diff: diff.text,
      diff_truncated: diff.truncated,
    }
  }

  private async createIssue(input: z.infer<typeof CreateIssueInput>) {
    const { owner, repo } = normalizeRepo(input)
    const response = await this.client.rest.issues.create({
      owner,
      repo,
      title: input.title,
      body: input.body || undefined,
      labels: input.labels?.length ? input.labels : undefined,
      assignees: input.assignees?.length ? input.assignees : undefined,
    })

    const issue = response.data
    this.ctx.events.emit('github:issue_created', {
      owner,
      repo,
      issue_number: issue.number,
      title: issue.title,
    })

    return {
      success: true,
      owner,
      repo,
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        user: issue.user?.login,
        labels: (issue.labels || []).map((label: any) => typeof label === 'string' ? label : label.name),
        assignees: (issue.assignees || []).map((assignee: any) => assignee.login),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
      },
    }
  }

  private async paginatePullFiles(owner: string, repo: string, pullNumber: number, maxFiles: number) {
    if (typeof this.client.paginate === 'function') {
      const files = await this.client.paginate(this.client.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: Math.min(maxFiles, 100),
      })
      return files.slice(0, maxFiles)
    }

    const response = await this.client.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: Math.min(maxFiles, 100),
    })
    return (response.data || []).slice(0, maxFiles)
  }

  private async fetchPullDiff(owner: string, repo: string, pullNumber: number, maxDiffChars: number) {
    if (typeof this.client.request !== 'function') {
      return { text: undefined, truncated: false }
    }

    const response = await this.client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: pullNumber,
      headers: {
        accept: 'application/vnd.github.v3.diff',
      },
    })

    const diff = typeof response.data === 'string' ? response.data : String(response.data || '')
    return truncateText(diff, maxDiffChars)
  }

  async shutdown() {
    this.ctx.logger.info('GitHub module shutting down')
  }
}
