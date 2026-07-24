import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  createModuleSignature,
  hashFile,
  hashManifest,
  type ModuleSignatureFile,
} from './module-signing'

interface SignModuleOptions {
  modulePath: string
  privateKeyPath: string
  entrypoint?: string
  output?: string
  keyId?: string
  signedAt?: string
}

const ENTRYPOINT_CANDIDATES = [
  'src/index.ts',
  'src/index.js',
  'src/index.mjs',
  'index.ts',
  'index.js',
  'index.mjs',
]

function printHelp() {
  console.log(`
Sign a Claude Hub capability module.

Usage:
  npm run module:sign -- --module <module-dir> --private-key <private-key.pem> [options]

Options:
  --module <dir>        Module directory to sign, e.g. modules/github or dist/modules/github
  --private-key <file>  Ed25519 private key PEM file
  --entrypoint <file>   Optional explicit entrypoint path
  --output <file>       Optional output signature path (default: <module>/module.sig.json)
  --key-id <id>         Optional trusted key identifier
  --signed-at <iso>     Optional timestamp override
  --help                Show this help

Notes:
  - Sign the same tree you intend to load. If production loads dist/modules/*, sign dist/modules/* after build.
  - The signature covers the module entrypoint hash and runtime manifest hash.
`)
}

async function pathExists(path: string) {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

async function findEntrypoint(modulePath: string) {
  for (const candidate of ENTRYPOINT_CANDIDATES) {
    const fullPath = resolve(modulePath, candidate)
    if (await pathExists(fullPath)) return fullPath
  }

  throw new Error(`No module entrypoint found in ${modulePath}`)
}

async function loadModuleManifest(entrypoint: string) {
  const imported = await import(pathToFileURL(entrypoint).href)
  const ModuleCtor = imported.default

  if (typeof ModuleCtor !== 'function') {
    throw new Error(`Module entrypoint does not export a default class/function: ${entrypoint}`)
  }

  const instance = new ModuleCtor()
  const manifest = instance.manifest?.()

  if (!manifest?.id) {
    throw new Error(`Module manifest is missing required id: ${entrypoint}`)
  }

  return manifest
}

export async function signModuleDirectory(options: SignModuleOptions): Promise<{
  moduleId: string
  entrypoint: string
  output: string
  signature: ModuleSignatureFile
}> {
  const modulePath = resolve(options.modulePath)
  const entrypoint = options.entrypoint
    ? resolve(options.entrypoint)
    : await findEntrypoint(modulePath)
  const output = resolve(options.output || modulePath, options.output ? '' : 'module.sig.json')
  const privateKey = await readFile(resolve(options.privateKeyPath), 'utf8')
  const manifest = await loadModuleManifest(entrypoint)
  const signature = createModuleSignature({
    moduleId: manifest.id,
    entrypointSha256: await hashFile(entrypoint),
    manifestSha256: hashManifest(manifest),
    privateKey,
    keyId: options.keyId,
    signedAt: options.signedAt,
  })

  await writeFile(output, `${JSON.stringify(signature, null, 2)}\n`)

  return {
    moduleId: manifest.id,
    entrypoint,
    output,
    signature,
  }
}

function parseArgs(argv: string[]): SignModuleOptions | null {
  const options: Partial<SignModuleOptions> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      printHelp()
      return null
    }

    if (arg === '--module') options.modulePath = argv[++index]
    else if (arg === '--private-key') options.privateKeyPath = argv[++index]
    else if (arg === '--entrypoint') options.entrypoint = argv[++index]
    else if (arg === '--output') options.output = argv[++index]
    else if (arg === '--key-id') options.keyId = argv[++index]
    else if (arg === '--signed-at') options.signedAt = argv[++index]
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.modulePath || !options.privateKeyPath) {
    throw new Error('Missing required --module or --private-key argument')
  }

  return options as SignModuleOptions
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options) return

  const result = await signModuleDirectory(options)
  console.log(JSON.stringify({
    module_id: result.moduleId,
    entrypoint: result.entrypoint,
    output: result.output,
    key_id: result.signature.keyId,
    signed_at: result.signature.signedAt,
  }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: any) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
