import { createRequire } from 'node:module'

/**
 * PreToolUse Hook: Secret Scanner
 *
 * Blocks writes that contain potential API keys, tokens, or passwords.
 * This runs before any tool that writes content.
 */

interface SecretPattern {
  pattern: RegExp
  name: string
}

const SECRET_PATTERNS: SecretPattern[] = [
  { pattern: /sk-[a-zA-Z0-9]{32,}/, name: 'Anthropic/OpenAI API Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Personal Access Token' },
  { pattern: /github_pat_[a-zA-Z0-9_]{40,}/, name: 'GitHub Fine-Grained Personal Access Token' },
  { pattern: /AKIA[A-Z0-9]{16}/, name: 'AWS Access Key ID' },
  { pattern: /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/, name: 'Private Key' },
  { pattern: /password\s*=\s*['"][^'"]{8,}/i, name: 'Hardcoded Password' },
  { pattern: /api[_-]?key\s*=\s*['"][^'"]{16,}/i, name: 'Hardcoded API Key' },
  { pattern: /secret\s*=\s*['"][^'"]{16,}/i, name: 'Hardcoded Secret' },
]

const SENSITIVE_IDENTIFIER_PATTERN = /(?:password|passwd|pwd|api[_-]?key|secret|token|private[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)/i
const MIN_LITERAL_SECRET_LENGTH = 8
const require = createRequire(import.meta.url)
let tsModule: any | null | undefined

export interface ScanResult {
  blocked: boolean
  reason?: string
  pattern?: string
}

interface AstFinding {
  name: string
  identifier: string
}

function getTypeScript() {
  if (tsModule !== undefined) return tsModule

  try {
    tsModule = require('typescript')
  } catch {
    tsModule = null
  }

  return tsModule
}

function formatBlockedResult(name: string): ScanResult {
  return {
    blocked: true,
    reason: `Potential secret detected: ${name}. Use environment variables instead (e.g. process.env.API_KEY).`,
    pattern: name,
  }
}

function isSensitiveIdentifier(identifier: string) {
  return SENSITIVE_IDENTIFIER_PATTERN.test(identifier)
}

function isLikelySecretLiteral(value: string) {
  const trimmed = value.trim()

  if (trimmed.length < MIN_LITERAL_SECRET_LENGTH) return false
  if (/^(true|false|null|undefined)$/i.test(trimmed)) return false
  if (/^(changeme|change-me|example|placeholder|your[_-]?(secret|token|key)|todo)$/i.test(trimmed)) return false
  if (/^process\.env\./.test(trimmed)) return false

  return true
}

function literalValue(node: any, ts: any): string | null {
  if (ts.isStringLiteral?.(node) || ts.isNoSubstitutionTemplateLiteral?.(node)) {
    return node.text
  }

  return null
}

function propertyNameText(name: any, ts: any): string | null {
  if (!name) return null

  if (ts.isIdentifier?.(name) || ts.isStringLiteral?.(name) || ts.isNumericLiteral?.(name)) {
    return name.text
  }

  return null
}

function inspectAssignment(identifier: string | null, initializer: any, ts: any): AstFinding | null {
  if (!identifier || !isSensitiveIdentifier(identifier)) return null

  const value = literalValue(initializer, ts)
  if (value === null || !isLikelySecretLiteral(value)) return null

  return {
    name: `Hardcoded secret assigned to "${identifier}"`,
    identifier,
  }
}

function scanCodeAst(content: string): AstFinding | null {
  const ts = getTypeScript()
  if (!ts) return null

  const sourceFile = ts.createSourceFile(
    'scan-target.tsx',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  let finding: AstFinding | null = null

  const visit = (node: any) => {
    if (finding) return

    if (ts.isVariableDeclaration?.(node)) {
      const identifier = propertyNameText(node.name, ts)
      finding = inspectAssignment(identifier, node.initializer, ts)
    } else if (ts.isPropertyAssignment?.(node)) {
      const identifier = propertyNameText(node.name, ts)
      finding = inspectAssignment(identifier, node.initializer, ts)
    } else if (ts.isPropertyDeclaration?.(node)) {
      const identifier = propertyNameText(node.name, ts)
      finding = inspectAssignment(identifier, node.initializer, ts)
    } else if (ts.isBinaryExpression?.(node)) {
      const assignmentOperators = new Set([
        ts.SyntaxKind.EqualsToken,
        ts.SyntaxKind.PlusEqualsToken,
      ])

      if (assignmentOperators.has(node.operatorToken?.kind)) {
        const left = node.left
        const identifier = ts.isIdentifier?.(left)
          ? left.text
          : ts.isPropertyAccessExpression?.(left)
            ? left.name?.text
            : null
        finding = inspectAssignment(identifier, node.right, ts)
      }
    }

    if (!finding) {
      ts.forEachChild(node, visit)
    }
  }

  visit(sourceFile)
  return finding
}

export function scanForSecrets(content: string): ScanResult {
  if (!content || typeof content !== 'string') {
    return { blocked: false }
  }

  for (const { pattern, name } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      return formatBlockedResult(name)
    }
  }

  const astFinding = scanCodeAst(content)
  if (astFinding) {
    return formatBlockedResult(astFinding.name)
  }

  return { blocked: false }
}

// Example usage in a PreToolUse hook:
// const result = scanForSecrets(input.content)
// if (result.blocked) {
//   return { decision: 'block', reason: result.reason }
// }
