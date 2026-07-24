import { z } from 'zod'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { config } from '../../../src/config'
import type { Module, ModuleContext, Tool } from '../../../src/kernel/types'

const BASE_DIR = config.workspaceDir

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
    const baseRoot = resolve(BASE_DIR)
    const fullPath = resolve(baseRoot, relativePath)
    const relativeToBase = relative(baseRoot, fullPath)

    if (relativeToBase === '..' || relativeToBase.startsWith(`..${sep}`) || resolve(relativePath) === fullPath && relativePath.startsWith(sep)) {
      throw new Error('Path escapes the configured workspace directory')
    }

    return fullPath
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
      await mkdir(dirname(fullPath), { recursive: true })
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
            results.push(relative(resolve(BASE_DIR), full))
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