import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { logger } from '../logger'

interface SkillMetadata {
  name: string
  description: string
  triggers: string[]
  requires: string[]
  version: string
  alwaysLoad: boolean
  autoTrigger: boolean
}

interface Skill {
  metadata: SkillMetadata
  content: string
  contentTokens: number
}

export class SkillRuntime {
  private skills = new Map<string, Skill>()
  private triggerIndex = new Map<string, string>() // trigger phrase → skill name

  async loadFromDirectory(skillsDir: string) {
    try {
      const entries = await readdir(skillsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const skillPath = join(skillsDir, entry.name, 'SKILL.md')
        try {
          const content = await readFile(skillPath, 'utf-8')
          const skill = this.parseSkill(content, entry.name)

          this.skills.set(skill.metadata.name, skill)

          // Index trigger phrases
          for (const trigger of skill.metadata.triggers || []) {
            this.triggerIndex.set(trigger.toLowerCase(), skill.metadata.name)
          }

          logger.info({ skill: skill.metadata.name }, 'Skill loaded')
        } catch (err) {
          logger.warn({ skill: entry.name }, 'Failed to load skill')
        }
      }
    } catch (err) {
      logger.info('No skills directory found')
    }
  }

  private parseSkill(content: string, folderName: string): Skill {
    // Simple frontmatter parser
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let metadata: SkillMetadata = {
      name: folderName,
      description: '',
      triggers: [],
      requires: [],
      version: '1.0',
      alwaysLoad: false,
      autoTrigger: true,
    }

    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1]
      const lines = yaml.split('\n')
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':')
        if (!key) continue
        const value = valueParts.join(':').trim()

        if (key === 'name') metadata.name = value
        if (key === 'description') metadata.description = value.replace(/^>\s*/, '')
        if (key === 'triggers') metadata.triggers = value.split(',').map(t => t.trim())
        if (key === 'requires') metadata.requires = value.split(',').map(r => r.trim())
        if (key === 'version') metadata.version = value
        if (key === 'always_load') metadata.alwaysLoad = value === 'true'
        if (key === 'auto_trigger') metadata.autoTrigger = value !== 'false'
      }
    }

    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '').trim()
    const tokenEstimate = Math.ceil(contentWithoutFrontmatter.length / 4)

    return {
      metadata,
      content: contentWithoutFrontmatter,
      contentTokens: tokenEstimate,
    }
  }

  // Find skill by trigger phrase in user message
  matchTrigger(userMessage: string): Skill | null {
    const lower = userMessage.toLowerCase()
    for (const [trigger, skillName] of this.triggerIndex) {
      if (lower.includes(trigger)) {
        return this.skills.get(skillName) || null
      }
    }
    return null
  }

  getSkillContent(name: string): string | null {
    return this.skills.get(name)?.content || null
  }

  listSkills() {
    return Array.from(this.skills.values()).map(s => ({
      name: s.metadata.name,
      description: s.metadata.description,
      triggers: s.metadata.triggers,
      tokens: s.contentTokens,
    }))
  }

  // Expose as MCP Resources
  toMCPResources() {
    return Array.from(this.skills.values()).map(skill => ({
      uri: `skills://${skill.metadata.name}`,
      name: skill.metadata.name,
      description: skill.metadata.description,
      mimeType: 'text/markdown',
    }))
  }

  async readResource(uri: string) {
    const name = uri.replace('skills://', '')
    const skill = this.skills.get(name)
    if (!skill) throw new Error(`Skill not found: ${name}`)

    return {
      uri,
      mimeType: 'text/markdown',
      text: skill.content,
    }
  }
}

export const skillRuntime = new SkillRuntime()