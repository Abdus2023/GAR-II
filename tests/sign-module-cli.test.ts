import { generateKeyPairSync } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { signModuleDirectory } from '../src/security/sign-module'
import { verifyModuleManifest, verifyModulePreImport } from '../src/security/module-signing'

describe('signModuleDirectory', () => {
  it('writes a verifiable module signature sidecar file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gar-ii-sign-cli-'))
    const moduleRoot = join(root, 'example')
    const entrypoint = join(moduleRoot, 'index.mjs')
    const privateKeyPath = join(root, 'ed25519-private.pem')
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

    try {
      await mkdir(moduleRoot, { recursive: true })
      await writeFile(entrypoint, `
        export default class ExampleModule {
          manifest() {
            return { id: 'example', version: '1.0.0', permissions: [], dependencies: [] }
          }
        }
      `)
      await writeFile(privateKeyPath, privateKeyPem)

      const result = await signModuleDirectory({
        modulePath: moduleRoot,
        privateKeyPath,
        keyId: 'test-key',
        signedAt: '2026-07-24T00:00:00.000Z',
      })
      const writtenSignature = JSON.parse(await readFile(join(moduleRoot, 'module.sig.json'), 'utf8'))

      expect(result.moduleId).toBe('example')
      expect(writtenSignature).toMatchObject({
        algorithm: 'ed25519',
        moduleId: 'example',
        keyId: 'test-key',
      })

      const preImport = await verifyModulePreImport({
        moduleRoot,
        moduleId: 'example',
        entrypoint,
        mode: 'enforce',
        publicKeys: [publicKeyPem],
      })
      const manifestResult = verifyModuleManifest(
        { id: 'example', version: '1.0.0', permissions: [], dependencies: [] },
        preImport,
        'enforce'
      )

      expect(preImport.status).toBe('trusted')
      expect(manifestResult.status).toBe('trusted')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
