import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'

const distRoot = resolve(process.cwd(), 'dist')

const jsFiles = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      walk(fullPath)
    } else if (stats.isFile() && fullPath.endsWith('.js')) {
      jsFiles.push(fullPath)
    }
  }
}

function hasExplicitExtension(specifier) {
  const lastSegment = specifier.split('/').pop() || ''
  return extname(lastSegment) !== ''
}

function resolveSpecifier(filePath, specifier) {
  if (!specifier.startsWith('.') || hasExplicitExtension(specifier)) {
    return specifier
  }

  const baseDir = dirname(filePath)

  if (existsSync(resolve(baseDir, `${specifier}.js`))) {
    return `${specifier}.js`
  }

  if (existsSync(resolve(baseDir, specifier, 'index.js'))) {
    return `${specifier}/index.js`
  }

  return specifier
}

function rewriteImports(filePath, source) {
  const replacer = (match, prefix, specifier, suffix) => {
    return `${prefix}${resolveSpecifier(filePath, specifier)}${suffix}`
  }

  return source
    .replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, replacer)
    .replace(/(import\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, replacer)
    .replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g, replacer)
}

if (existsSync(distRoot)) {
  walk(distRoot)

  for (const filePath of jsFiles) {
    const source = readFileSync(filePath, 'utf8')
    const updated = rewriteImports(filePath, source)

    if (updated !== source) {
      writeFileSync(filePath, updated)
    }
  }

  console.log(`Fixed ESM import specifiers in ${jsFiles.length} compiled files.`)
}
