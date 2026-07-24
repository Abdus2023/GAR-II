import { generateKeyPairSync } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  createModuleSignature,
  hashFile,
  hashManifest,
  verifyModuleManifest,
  verifyModulePreImport,
} from '../src/security/module-signing'

async function createSignedModule() {
  const root = await mkdtemp(join(tmpdir(), 'gar-ii-signed-module-'))
  const moduleRoot = join(root, 'example')
  const entrypoint = join(moduleRoot, 'index.js')
  const manifest = {
    id: 'example',
    version: '1.0.0',
    permissions: [],
    dependencies: [],
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

  await mkdir(moduleRoot, { recursive: true })
  await writeFile(entrypoint, 'export default class ExampleModule {}\n')

  const signature = createModuleSignature({
    moduleId: 'example',
    entrypointSha256: await hashFile(entrypoint),
    manifestSha256: hashManifest(manifest),
    privateKey,
    keyId: 'test-key',
    signedAt: '2026-07-24T00:00:00.000Z',
  })
  await writeFile(join(moduleRoot, 'module.sig.json'), JSON.stringify(signature, null, 2))

  return { root, moduleRoot, entrypoint, manifest, publicKeyPem }
}

describe('module signing verification', () => {
  it('verifies signed module entrypoint and manifest hashes', async () => {
    const fixture = await createSignedModule()

    try {
      const preImport = await verifyModulePreImport({
        moduleRoot: fixture.moduleRoot,
        moduleId: 'example',
        entrypoint: fixture.entrypoint,
        mode: 'enforce',
        publicKeys: [fixture.publicKeyPem],
      })
      const manifestVerification = verifyModuleManifest(fixture.manifest, preImport, 'enforce')

      expect(preImport.status).toBe('trusted')
      expect(manifestVerification.status).toBe('trusted')
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  })

  it('rejects tampered module entrypoints in enforce mode', async () => {
    const fixture = await createSignedModule()

    try {
      await writeFile(fixture.entrypoint, 'export default class TamperedModule {}\n')
      await expect(verifyModulePreImport({
        moduleRoot: fixture.moduleRoot,
        moduleId: 'example',
        entrypoint: fixture.entrypoint,
        mode: 'enforce',
        publicKeys: [fixture.publicKeyPem],
      })).rejects.toThrow('entrypoint hash does not match')
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  })

  it('warns but does not reject unsigned modules in warn mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gar-ii-unsigned-module-'))
    const moduleRoot = join(root, 'unsigned')
    const entrypoint = join(moduleRoot, 'index.js')

    try {
      await mkdir(moduleRoot, { recursive: true })
      await writeFile(entrypoint, 'export default class UnsignedModule {}\n')
      const result = await verifyModulePreImport({
        moduleRoot,
        moduleId: 'unsigned',
        entrypoint,
        mode: 'warn',
        publicKeys: [],
      })

      expect(result.status).toBe('missing')
      expect(result.warnings[0]).toContain('missing module.sig.json')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
