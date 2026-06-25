import fs from 'node:fs/promises'
import path from 'node:path'

import { summarizeApiUsage } from '../src/lib/apiContractScanner.js'
import {
  extractFrontendCalls,
  extractBackendEndpoints,
  buildContractReport,
} from '../src/lib/contractGapDetector.js'

const FRONTEND_ROOT = path.resolve(process.cwd(), 'src')
const BACKEND_MODULES_ROOT = path.resolve(process.cwd(), 'server-v4/src/modules')
const REPORT_OUTPUT_PATH = path.resolve(process.cwd(), 'reports/contract-report.json')
const GAP_ANALYSIS_DOC_PATH = path.resolve(process.cwd(), 'docs/gap-analysis.md')
const VALID_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])
const DEFAULT_EXCLUDED_SEGMENTS = new Set([
  `${path.sep}src${path.sep}demo${path.sep}`,
  `${path.sep}src${path.sep}__tests__${path.sep}`,
])
const DEFAULT_EXCLUDED_FILES = new Set([
  path.resolve(process.cwd(), 'src/lib/apiContractScanner.js'),
  path.resolve(process.cwd(), 'src/lib/contractGapDetector.js'),
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

/**
 * Load the module catalog from backend source by importing each .module.ts file.
 * Falls back to static regex extraction if dynamic import is not possible.
 */
async function loadBackendModuleCatalog() {
  const modules = []
  let entries
  try {
    entries = await fs.readdir(BACKEND_MODULES_ROOT, { withFileTypes: true })
  } catch {
    console.warn('[api-contract] backend modules directory not found, skipping backend scan')
    return modules
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const moduleFile = path.join(BACKEND_MODULES_ROOT, entry.name, `${entry.name}.module.ts`)
    let sourceText
    try {
      sourceText = await fs.readFile(moduleFile, 'utf8')
    } catch {
      continue
    }

    const mod = parseModuleSource(sourceText, entry.name)
    if (mod) modules.push(mod)
  }

  return modules
}

/**
 * Parse a domain module source file to extract basePath and routes via regex.
 * This avoids needing to transpile TypeScript at script runtime.
 */
function parseModuleSource(sourceText, moduleId) {
  const basePathMatch = sourceText.match(/basePath:\s*['"]([^'"]+)['"]/)
  if (!basePathMatch) return null
  const basePath = basePathMatch[1]

  const routeGroups = []
  // Match route objects: { method: 'X', path: 'Y', purpose: '...' }
  const routeRegex = /\{\s*method:\s*['"](\w+)['"]\s*,\s*path:\s*['"]([^'"]+)['"]\s*,\s*purpose:/g
  let match
  const routes = []
  while ((match = routeRegex.exec(sourceText)) !== null) {
    routes.push({ method: match[1], path: match[2] })
  }

  if (routes.length === 0) return null

  routeGroups.push({ name: 'all', routes })

  return { id: moduleId, basePath, routeGroups }
}

/**
 * Load the previous contract report if it exists.
 */
async function loadPreviousReport(reportPath) {
  try {
    const content = await fs.readFile(reportPath, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
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

function printContractReport(report) {
  console.log('\n[api-contract] === Contract Gap Report ===')
  console.log(`[api-contract] frontend calls: ${report.totalFrontendCalls}`)
  console.log(`[api-contract] backend endpoints: ${report.totalBackendEndpoints}`)
  console.log(`[api-contract] missing backend (F\\B): ${report.missingBackend.length}`)
  console.log(`[api-contract] unused backend (B\\F): ${report.unusedBackend.length}`)
  console.log(`[api-contract] new gaps since last run: ${report.newGapsSinceLastRun.length}`)

  if (report.missingBackend.length > 0) {
    console.log('\n[api-contract] Missing backend endpoints:')
    for (const gap of report.missingBackend) {
      console.log(`  ${gap.method} ${gap.path} [${gap.pageModule}] (${gap.source})`)
    }
  }

  if (report.unusedBackend.length > 0) {
    console.log('\n[api-contract] Unused backend endpoints:')
    for (const gap of report.unusedBackend) {
      console.log(`  ${gap.method} ${gap.path} [${gap.pageModule}] (${gap.source})`)
    }
  }

  if (report.newGapsSinceLastRun.length > 0) {
    console.log('\n[api-contract] NEW gaps introduced:')
    for (const gap of report.newGapsSinceLastRun) {
      console.log(`  ${gap.type}: ${gap.method} ${gap.path}`)
    }
  }
}

/**
 * Generate a living gap-analysis markdown document from the contract report.
 */
function generateGapAnalysisDoc(report) {
  const lines = [
    '# API Contract Gap Analysis',
    '',
    '> Auto-generated by `scripts/check-frontend-api-contract.mjs`. Do not edit manually.',
    '',
    `**Last updated:** ${report.timestamp}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Frontend API calls | ${report.totalFrontendCalls} |`,
    `| Backend endpoints | ${report.totalBackendEndpoints} |`,
    `| Missing backend (F\\\\B) | ${report.missingBackend.length} |`,
    `| Unused backend (B\\\\F) | ${report.unusedBackend.length} |`,
    `| New gaps since last run | ${report.newGapsSinceLastRun.length} |`,
    '',
  ]

  if (report.missingBackend.length > 0) {
    lines.push('## Missing Backend Endpoints')
    lines.push('')
    lines.push('Frontend calls that have no matching backend endpoint:')
    lines.push('')
    lines.push('| Method | Path | Page Module | Source |')
    lines.push('|--------|------|-------------|--------|')
    for (const gap of report.missingBackend) {
      lines.push(`| ${gap.method} | ${gap.path} | ${gap.pageModule || '-'} | ${gap.source || '-'} |`)
    }
    lines.push('')
  }

  if (report.unusedBackend.length > 0) {
    lines.push('## Unused Backend Endpoints')
    lines.push('')
    lines.push('Backend endpoints with no frontend caller (candidates for deprecation):')
    lines.push('')
    lines.push('| Method | Path | Module |')
    lines.push('|--------|------|--------|')
    for (const gap of report.unusedBackend) {
      lines.push(`| ${gap.method} | ${gap.path} | ${gap.pageModule || '-'} |`)
    }
    lines.push('')
  }

  if (report.newGapsSinceLastRun.length > 0) {
    lines.push('## New Gaps (Regressions)')
    lines.push('')
    lines.push('Gaps introduced since the previous run:')
    lines.push('')
    lines.push('| Type | Method | Path |')
    lines.push('|------|--------|------|')
    for (const gap of report.newGapsSinceLastRun) {
      lines.push(`| ${gap.type} | ${gap.method} | ${gap.path} |`)
    }
    lines.push('')
  }

  if (report.missingBackend.length === 0 && report.unusedBackend.length === 0) {
    lines.push('## Status: All Clear ✓')
    lines.push('')
    lines.push('No contract gaps detected. Frontend and backend are fully aligned.')
    lines.push('')
  }

  return lines.join('\n')
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const failOnLegacy = args.has('--fail-on-legacy')
  const failOnNewGaps = args.has('--fail-on-new-gaps')
  const includeDemo = args.has('--include-demo')
  const jsonOnly = args.has('--json')

  // --- Phase 1: Legacy check (original functionality) ---
  const files = await collectFrontendFiles(FRONTEND_ROOT, includeDemo)
  const entries = await buildFileEntries(files)
  const summary = summarizeApiUsage(entries)

  if (!jsonOnly) {
    printReport(summary)
  }

  if (failOnLegacy && summary.counts.legacy > 0) {
    console.error('[api-contract] fail: legacy routes still in use')
    process.exitCode = 1
  }

  // --- Phase 2: Contract gap detection ---
  const frontendCalls = extractFrontendCalls(entries)
  const moduleCatalog = await loadBackendModuleCatalog()
  const backendEndpoints = extractBackendEndpoints(moduleCatalog)
  const previousReport = await loadPreviousReport(REPORT_OUTPUT_PATH)
  const contractReport = buildContractReport(frontendCalls, backendEndpoints, previousReport)

  if (!jsonOnly) {
    printContractReport(contractReport)
  }

  // --- Phase 3: Write report ---
  const reportDir = path.dirname(REPORT_OUTPUT_PATH)
  await fs.mkdir(reportDir, { recursive: true })
  await fs.writeFile(REPORT_OUTPUT_PATH, JSON.stringify(contractReport, null, 2), 'utf8')

  // --- Phase 3b: Generate living gap-analysis document ---
  const gapAnalysisContent = generateGapAnalysisDoc(contractReport)
  const gapAnalysisDir = path.dirname(GAP_ANALYSIS_DOC_PATH)
  await fs.mkdir(gapAnalysisDir, { recursive: true })
  await fs.writeFile(GAP_ANALYSIS_DOC_PATH, gapAnalysisContent, 'utf8')

  if (!jsonOnly) {
    console.log(`\n[api-contract] report written to: ${REPORT_OUTPUT_PATH}`)
    console.log(`[api-contract] gap-analysis doc written to: ${GAP_ANALYSIS_DOC_PATH}`)
  }

  if (jsonOnly) {
    console.log(JSON.stringify(contractReport, null, 2))
  }

  // --- Phase 4: Fail on new gaps if requested ---
  if (failOnNewGaps && contractReport.newGapsSinceLastRun.length > 0) {
    console.error(`[api-contract] fail: ${contractReport.newGapsSinceLastRun.length} new gap(s) introduced`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('[api-contract] unexpected failure', error)
  process.exitCode = 1
})
