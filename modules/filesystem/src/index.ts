import { z } from 'zod'
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Module, ModuleContext, Tool } from '../../../src/kernel/types'

const BASE_DIR = process.env.WORKSPACE_DIR || './workspace'

export default class FilesystemModule implements Module {
  private ctx!: ModuleContext

  manifest() {
    return {
      id: 'filesystem',
      version: '1.0.0',
      permissions: ['filesystem.read', 'filesystem.write'],
      dependencies: ['auth'],
    }
  }

  async initialize(ctx: ModuleContext) {
    this.ctx = ctx
    this.ctx.logger.info('Filesystem module initialized')
  }

  tools(): Tool[] {
    return [
      {
        id: 'read_file',
        description: 'Read the contents of a file',
        inputSchema: z.object({
          path: z.string(),
        }),
        execute: this.readFile.bind(this),
      },
      {
        id: 'write_file',
        description: 'Write or overwrite a file (requires confirmation for destructive writes)',
        inputSchema: z.object({
          path: z.string(),
          content: z.string(),
        }),
        execute: this.writeFile.bind(this),
      },
      {
        id: 'list_directory',
        description: 'List files and folders in a directory',
        inputSchema: z.object({
          path: z.string().default('.'),
        }),
        execute: this.listDirectory.bind(this),
      },
      {
        id: 'search_files',
        description: 'Search for files by name pattern',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: this.searchFiles.bind(this),
      },
    ]
  }

  private resolvePath(relativePath: string): string {
    const safePath = relativePath.replace(/\.\./g, '') // basic path traversal protection
    return resolve(BASE_DIR, safePath)
  }

  private async readFile({ path }: { path: string }) {
    try {
      const fullPath = this.resolvePath(path)
      const content = await readFile(fullPath, 'utf-8')
      return {
        success: true,
        path,
        content,
      }
    } catch (error: any) {
      return {
        success: false,
        error: 'read_error',
        message: error.message,
      }
    }
  }

  private async writeFile({ path, content }: { path: string; content: string }) {
    try {
      const fullPath = this.resolvePath(path)
      await writeFile(fullPath, content, 'utf-8')
      
      this.ctx.events.emit('filesystem:file_written', { path })
      
      return {
        success: true,
        path,
        bytes_written: content.length,
      }
    } catch (error: any) {
      return {
        success: false,
        error: 'write_error',
        message: error.message,
      }
    }
  }

  private async listDirectory({ path = '.' }: { path: string }) {
    try {
      const fullPath = this.resolvePath(path)
      const entries = await readdir(fullPath, { withFileTypes: true })

      return {
        success: true,
        path,
        entries: entries.map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
        })),
      }
    } catch (error: any) {
      return {
        success: false,
        error: 'list_error',
        message: error.message,
      }
    }
  }

  private async searchFiles({ query }: { query: string }) {
    // Simple recursive name search (can be improved later)
    try {
      const results: string[] = []
      const searchDir = async (dir: string) => {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = join(dir, entry.name)
          if (entry.name.includes(query)) {
            results.push(full.replace(BASE_DIR, ''))
          }
          if (entry.isDirectory()) {
            await searchDir(full)
          }
        }
      }
      await searchDir(BASE_DIR)
      return {
        success: true,
        query,
        matches: results,
      }
    } catch (error: any) {
      return {
        success: false,
        error: 'search_error',
        message: error.message,
      }
    }
  }

  async shutdown() {
    this.ctx.logger.info('Filesystem module shutting down')
  }
}