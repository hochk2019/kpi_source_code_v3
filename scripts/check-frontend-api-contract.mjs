import fs from 'node:fs/promises'
import path from 'node:path'

import { summarizeApiUsage } from '../src/lib/apiContractScanner.js'

const FRONTEND_ROOT = path.resolve(process.cwd(), 'src')
const VALID_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])
const DEFAULT_EXCLUDED_SEGMENTS = new Set([
  `${path.sep}src${path.sep}demo${path.sep}`,
  `${path.sep}src${path.sep}__tests__${path.sep}`,
])
const DEFAULT_EXCLUDED_FILES = new Set([
  path.resolve(process.cwd(), 'src/lib/apiContractScanner.js'),
])

function shouldIncludeFile(filePath, includeDemo) {
  const extension = path.extname(filePath)
  if (!VALID_EXTENSIONS.has(extension)) {
    return false
  }
  if (!includeDemo) {
    for (const segment of DEFAULT_EXCLUDED_SEGMENTS) {
      if (filePath.includes(segment)) {
        return false
      }
    }
  }
  if (DEFAULT_EXCLUDED_FILES.has(filePath)) {
    return false
  }
  return true
}

async function collectFrontendFiles(rootDir, includeDemo) {
  const queue = [rootDir]
  const files = []

  while (queue.length > 0) {
    const current = queue.pop()
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(target)
        continue
      }
      if (shouldIncludeFile(target, includeDemo)) {
        files.push(target)
      }
    }
  }

  return files
}

async function buildFileEntries(filePaths) {
  const entries = []
  for (const filePath of filePaths) {
    const sourceText = await fs.readFile(filePath, 'utf8')
    entries.push({ filePath, sourceText })
  }
  return entries
}

function printReport(summary) {
  console.log('[api-contract] canonical routes:', summary.counts.canonical)
  console.log('[api-contract] legacy routes:', summary.counts.legacy)

  if (summary.legacy.length > 0) {
    console.log('[api-contract] legacy usages:')
    for (const record of summary.legacy) {
      console.log(`- ${record.filePath}: ${record.normalizedPath}`)
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const failOnLegacy = args.has('--fail-on-legacy')
  const includeDemo = args.has('--include-demo')

  const files = await collectFrontendFiles(FRONTEND_ROOT, includeDemo)
  const entries = await buildFileEntries(files)
  const summary = summarizeApiUsage(entries)

  printReport(summary)

  if (failOnLegacy && summary.counts.legacy > 0) {
    console.error('[api-contract] fail: legacy routes still in use')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('[api-contract] unexpected failure', error)
  process.exitCode = 1
})
