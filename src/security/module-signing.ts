import { createHash, createPublicKey, sign as cryptoSign, verify as cryptoVerify, type KeyLike } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export type ModuleSignatureMode = 'off' | 'warn' | 'enforce'

export interface ModuleSignatureFile {
  algorithm: 'ed25519'
  moduleId: string
  entrypointSha256: string
  manifestSha256?: string
  keyId?: string
  signedAt?: string
  signature: string
}

export interface ModulePreImportVerification {
  status: 'skipped' | 'trusted' | 'missing' | 'failed'
  signature?: ModuleSignatureFile
  warnings: string[]
}

export interface ModuleVerificationOptions {
  moduleRoot: string
  moduleId: string
  entrypoint: string
  mode: ModuleSignatureMode
  publicKeys: string[]
}

export interface CreateModuleSignatureOptions {
  moduleId: string
  entrypointSha256: string
  manifestSha256?: string
  privateKey: KeyLike | string
  keyId?: string
  signedAt?: string
}

const SIGNATURE_FILE_NAME = 'module.sig.json'

function sortJsonValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter(key => key !== 'signature')
        .sort()
        .map(key => [key, sortJsonValue(value[key])])
    )
  }

  return value
}

export function canonicalJson(value: any) {
  return JSON.stringify(sortJsonValue(value))
}

export function sha256Hex(content: string | Buffer) {
  return createHash('sha256').update(content).digest('hex')
}

export async function hashFile(path: string) {
  return sha256Hex(await readFile(path))
}

export function hashManifest(manifest: any) {
  return sha256Hex(canonicalJson(manifest))
}

export function signaturePayload(signature: Omit<ModuleSignatureFile, 'signature'>) {
  return canonicalJson({
    algorithm: signature.algorithm,
    moduleId: signature.moduleId,
    entrypointSha256: signature.entrypointSha256,
    manifestSha256: signature.manifestSha256,
    keyId: signature.keyId,
    signedAt: signature.signedAt,
  })
}

export function createModuleSignature(options: CreateModuleSignatureOptions): ModuleSignatureFile {
  const signatureWithoutValue: Omit<ModuleSignatureFile, 'signature'> = {
    algorithm: 'ed25519',
    moduleId: options.moduleId,
    entrypointSha256: options.entrypointSha256,
    manifestSha256: options.manifestSha256,
    keyId: options.keyId,
    signedAt: options.signedAt || new Date().toISOString(),
  }

  const signature = cryptoSign(
    null,
    Buffer.from(signaturePayload(signatureWithoutValue)),
    options.privateKey
  ).toString('base64')

  return {
    ...signatureWithoutValue,
    signature,
  }
}

export async function readModuleSignature(moduleRoot: string): Promise<ModuleSignatureFile | null> {
  try {
    const content = await readFile(resolve(moduleRoot, SIGNATURE_FILE_NAME), 'utf8')
    return JSON.parse(content) as ModuleSignatureFile
  } catch (error: any) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function verifySignature(signature: ModuleSignatureFile, publicKeys: string[]) {
  const payload = Buffer.from(signaturePayload(signature))
  const signatureBytes = Buffer.from(signature.signature, 'base64')

  return publicKeys.some(publicKey => {
    try {
      return cryptoVerify(null, payload, createPublicKey(publicKey), signatureBytes)
    } catch {
      return false
    }
  })
}

function failOrWarn(mode: ModuleSignatureMode, message: string, warnings: string[]) {
  if (mode === 'enforce') {
    throw new Error(message)
  }

  warnings.push(message)
}

export async function verifyModulePreImport(options: ModuleVerificationOptions): Promise<ModulePreImportVerification> {
  const warnings: string[] = []

  if (options.mode === 'off') {
    return { status: 'skipped', warnings }
  }

  const signature = await readModuleSignature(options.moduleRoot)
  if (!signature) {
    failOrWarn(options.mode, `Module ${options.moduleId} is missing ${SIGNATURE_FILE_NAME}`, warnings)
    return { status: 'missing', warnings }
  }

  if (signature.algorithm !== 'ed25519') {
    failOrWarn(options.mode, `Module ${options.moduleId} uses unsupported signature algorithm: ${signature.algorithm}`, warnings)
    return { status: 'failed', signature, warnings }
  }

  if (signature.moduleId !== options.moduleId) {
    failOrWarn(options.mode, `Module signature id mismatch: expected ${options.moduleId}, got ${signature.moduleId}`, warnings)
    return { status: 'failed', signature, warnings }
  }

  const actualEntrypointHash = await hashFile(options.entrypoint)
  if (signature.entrypointSha256 !== actualEntrypointHash) {
    failOrWarn(options.mode, `Module ${options.moduleId} entrypoint hash does not match signature`, warnings)
    return { status: 'failed', signature, warnings }
  }

  if (options.publicKeys.length === 0) {
    failOrWarn(options.mode, `Module ${options.moduleId} has a signature but no trusted public keys are configured`, warnings)
    return { status: 'failed', signature, warnings }
  }

  if (!verifySignature(signature, options.publicKeys)) {
    failOrWarn(options.mode, `Module ${options.moduleId} signature is not trusted by configured public keys`, warnings)
    return { status: 'failed', signature, warnings }
  }

  return { status: 'trusted', signature, warnings }
}

export function verifyModuleManifest(
  manifest: any,
  preImportVerification: ModulePreImportVerification,
  mode: ModuleSignatureMode
) {
  const warnings: string[] = []
  const signature = preImportVerification.signature

  if (mode === 'off' || !signature?.manifestSha256) {
    return { status: mode === 'off' ? 'skipped' : preImportVerification.status, warnings }
  }

  const actualManifestHash = hashManifest(manifest)
  if (signature.manifestSha256 !== actualManifestHash) {
    failOrWarn(mode, `Module ${manifest?.id || signature.moduleId} manifest hash does not match signature`, warnings)
    return { status: 'failed', warnings }
  }

  return { status: preImportVerification.status, warnings }
}
