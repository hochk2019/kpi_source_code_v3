import { describe, expect, it } from 'vitest'

import {
  classifyApiPath,
  extractApiPathsFromSource,
  normalizeApiPath,
  summarizeApiUsage,
} from '@/lib/apiContractScanner.js'

describe('apiContractScanner', () => {
  it('extracts api paths from string literals', () => {
    const sourceText = `
      const a = "/api/v4/auth/session"
      const b = '/api/filter-presets'
      const c = \`/api/reports/export?from=2024-01-01\`
      const d = \`\${base}/api/v4/shared-sync/storage/\${encodeURIComponent(key)}\`
      const notApi = "/static/assets/logo.svg"
    `
    expect(extractApiPathsFromSource(sourceText)).toEqual([
      '/api/v4/auth/session',
      '/api/filter-presets',
      '/api/reports/export?from=2024-01-01',
      '/api/v4/shared-sync/storage/${encodeURIComponent',
    ])
  })

  it('normalizes query strings and template placeholders', () => {
    expect(normalizeApiPath('/api/filter-presets/${presetId}?scope=main')).toBe('/api/filter-presets/:param')
  })

  it('classifies canonical and legacy api paths', () => {
    expect(classifyApiPath('/api/v4/hq-agencies/history')).toBe('canonical')
    expect(classifyApiPath('/api/duplicate-policy')).toBe('legacy')
    expect(classifyApiPath('/assets/app.css')).toBe('non-api')
  })

  it('summarizes canonical vs legacy usage across files', () => {
    const summary = summarizeApiUsage([
      {
        filePath: 'src/a.js',
        sourceText: `const a = "/api/v4/auth/session"; const b = "/api/duplicate-policy";`,
      },
      {
        filePath: 'src/b.js',
        sourceText: `const c = '/api/v4/backups/summary'`,
      },
    ])

    expect(summary.counts).toEqual({ canonical: 2, legacy: 1 })
    expect(summary.legacy[0]).toMatchObject({
      filePath: 'src/a.js',
      normalizedPath: '/api/duplicate-policy',
    })
  })
})
