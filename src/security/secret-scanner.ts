/**
 * PreToolUse Hook: Secret Scanner
 * 
 * Blocks writes that contain potential API keys, tokens, or passwords.
 * This runs before any tool that writes content.
 */

const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{32,}/g, name: 'Anthropic/OpenAI API Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: 'GitHub Personal Access Token' },
  { pattern: /AKIA[A-Z0-9]{16}/g, name: 'AWS Access Key ID' },
  { pattern: /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/g, name: 'Private Key' },
  { pattern: /password\s*=\s*['"][^'"]{8,}/gi, name: 'Hardcoded Password' },
  { pattern: /api[_-]?key\s*=\s*['"][^'"]{16,}/gi, name: 'Hardcoded API Key' },
  { pattern: /secret\s*=\s*['"][^'"]{16,}/gi, name: 'Hardcoded Secret' },
]

export interface ScanResult {
  blocked: boolean
  reason?: string
  pattern?: string
}

export function scanForSecrets(content: string): ScanResult {
  if (!content || typeof content !== 'string') {
    return { blocked: false }
  }

  for (const { pattern, name } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      return {
        blocked: true,
        reason: `Potential secret detected: ${name}. Use environment variables instead (e.g. process.env.API_KEY).`,
        pattern: name,
      }
    }
  }

  return { blocked: false }
}

// Example usage in a PreToolUse hook:
// const result = scanForSecrets(input.content)
// if (result.blocked) {
//   return { decision: 'block', reason: result.reason }
// }