import { describe, expect, it } from 'vitest'

import {
  makeEndpointKey,
  inferHttpMethod,
  inferPageModule,
  extractFrontendCalls,
  extractBackendEndpoints,
  computeGaps,
  findNewGaps,
  buildContractReport,
} from '@/lib/contractGapDetector.js'

describe('contractGapDetector', () => {
  describe('makeEndpointKey', () => {
    it('normalizes param segments to :param', () => {
      expect(makeEndpointKey('GET', '/api/v4/teams/:teamId')).toBe('GET /api/v4/teams/:param')
    })

    it('uppercases method', () => {
      expect(makeEndpointKey('get', '/api/v4/auth/session')).toBe('GET /api/v4/auth/session')
    })

    it('strips trailing slashes', () => {
      expect(makeEndpointKey('GET', '/api/v4/teams/')).toBe('GET /api/v4/teams')
    })

    it('preserves root path as /', () => {
      expect(makeEndpointKey('GET', '/')).toBe('GET /')
    })

    it('normalizes multiple param segments', () => {
      expect(makeEndpointKey('GET', '/api/v4/teams/:teamId/members/:memberId'))
        .toBe('GET /api/v4/teams/:param/members/:param')
    })
  })

  describe('inferHttpMethod', () => {
    it('detects method from explicit property in same statement', () => {
      const src = `const response = await fetchWithAuth("/api/v4/backups/run", { method: 'POST', headers: {} })`
      const pathIdx = src.indexOf('/api/v4/backups/run')
      expect(inferHttpMethod(src, pathIdx)).toBe('POST')
    })

    it('detects PUT from method property before the path in same call', () => {
      const src = `fetch("/api/v4/teams", { method: "PUT", body: JSON.stringify(data) })`
      const pathIdx = src.indexOf('/api/v4/teams')
      expect(inferHttpMethod(src, pathIdx)).toBe('PUT')
    })

    it('defaults to GET when no method context found', () => {
      const src = `const url = "/api/v4/data-health/summary"; const resp = await fetch(url)`
      const pathIdx = src.indexOf('/api/v4/')
      expect(inferHttpMethod(src, pathIdx)).toBe('GET')
    })
  })

  describe('inferPageModule', () => {
    it('detects DataImporter from path', () => {
      expect(inferPageModule('src/components/dataImporter/Preview.tsx')).toBe('DataImporter')
    })

    it('detects AuditLog from component name', () => {
      expect(inferPageModule('src/components/AuditLog.tsx')).toBe('AuditLog')
    })

    it('detects AuditLog from subdirectory', () => {
      expect(inferPageModule('src/components/audit-log/useAuditLogData.ts')).toBe('AuditLog')
    })

    it('detects DataHealthDashboard from component', () => {
      expect(inferPageModule('src/components/DataHealthDashboard.tsx')).toBe('DataHealthDashboard')
    })

    it('returns Unknown for unrecognized paths', () => {
      expect(inferPageModule('src/lib/utils.ts')).toBe('Unknown')
    })

    it('handles Windows-style paths', () => {
      expect(inferPageModule('src\\components\\team-manager\\TeamList.tsx')).toBe('TeamManager')
    })
  })

  describe('extractFrontendCalls', () => {
    it('extracts canonical API calls with methods', () => {
      const entries = [{
        filePath: 'src/components/AuditLog.tsx',
        sourceText: `
          const response = await fetchWithAuth("/api/v4/backups/summary", { cache: "no-store" });
          const r2 = await fetchWithAuth("/api/v4/backups/run", { method: "POST", body: JSON.stringify({}) });
        `,
      }]

      const calls = extractFrontendCalls(entries)
      expect(calls).toHaveLength(2)
      expect(calls[0]).toMatchObject({ method: 'GET', path: '/api/v4/backups/summary', pageModule: 'AuditLog' })
      expect(calls[1]).toMatchObject({ method: 'POST', path: '/api/v4/backups/run', pageModule: 'AuditLog' })
    })

    it('skips non-canonical legacy paths', () => {
      const entries = [{
        filePath: 'src/components/DataImporter.tsx',
        sourceText: `fetch("/api/import/ecus/preview")`,
      }]
      const calls = extractFrontendCalls(entries)
      expect(calls).toHaveLength(0)
    })

    it('normalizes template expressions to :param', () => {
      const entries = [{
        filePath: 'src/components/TeamManager.tsx',
        sourceText: `fetch(\`/api/v4/teams/\${teamId}/members\`)`,
      }]
      const calls = extractFrontendCalls(entries)
      expect(calls[0].path).toBe('/api/v4/teams/:param/members')
    })

    it('deduplicates same method+path+file', () => {
      const entries = [{
        filePath: 'src/components/AuditLog.tsx',
        sourceText: `
          fetch("/api/v4/backups/summary");
          fetch("/api/v4/backups/summary");
        `,
      }]
      const calls = extractFrontendCalls(entries)
      expect(calls).toHaveLength(1)
    })
  })

  describe('extractBackendEndpoints', () => {
    it('builds full paths from basePath + route path', () => {
      const modules = [{
        id: 'teams',
        basePath: '/api/v4/teams',
        routeGroups: [{
          name: 'teams',
          routes: [
            { method: 'GET', path: '/' },
            { method: 'POST', path: '/:teamId/members' },
          ],
        }],
      }]

      const endpoints = extractBackendEndpoints(modules)
      expect(endpoints).toHaveLength(2)
      expect(endpoints[0]).toMatchObject({ method: 'GET', path: '/api/v4/teams/' })
      expect(endpoints[1]).toMatchObject({ method: 'POST', path: '/api/v4/teams/:teamId/members' })
    })

    it('skips __meta routes', () => {
      const modules = [{
        id: 'teams',
        basePath: '/api/v4/teams',
        routeGroups: [{
          name: 'teams',
          routes: [
            { method: 'GET', path: '/__meta' },
            { method: 'GET', path: '/' },
          ],
        }],
      }]

      const endpoints = extractBackendEndpoints(modules)
      expect(endpoints).toHaveLength(1)
      expect(endpoints[0].path).toBe('/api/v4/teams/')
    })
  })

  describe('computeGaps', () => {
    it('detects missingBackend when frontend calls have no matching backend', () => {
      const frontendCalls = [
        { pageModule: 'AuditLog', method: 'GET', path: '/api/v4/backups/summary', source: 'src/AuditLog.tsx' },
        { pageModule: 'AuditLog', method: 'POST', path: '/api/v4/backups/missing', source: 'src/AuditLog.tsx' },
      ]
      const backendEndpoints = [
        { moduleId: 'backup', method: 'GET', path: '/api/v4/backups/summary', source: 'server-v4/backup.ts' },
      ]

      const { missingBackend } = computeGaps(frontendCalls, backendEndpoints)
      expect(missingBackend).toHaveLength(1)
      expect(missingBackend[0]).toMatchObject({
        type: 'missing-backend',
        method: 'POST',
        path: '/api/v4/backups/missing',
        pageModule: 'AuditLog',
      })
    })

    it('detects unusedBackend when backend endpoints have no frontend caller', () => {
      const frontendCalls = [
        { pageModule: 'AuditLog', method: 'GET', path: '/api/v4/backups/summary', source: 'src/AuditLog.tsx' },
      ]
      const backendEndpoints = [
        { moduleId: 'backup', method: 'GET', path: '/api/v4/backups/summary', source: 'server-v4/backup.ts' },
        { moduleId: 'backup', method: 'POST', path: '/api/v4/backups/run', source: 'server-v4/backup.ts' },
      ]

      const { unusedBackend } = computeGaps(frontendCalls, backendEndpoints)
      expect(unusedBackend).toHaveLength(1)
      expect(unusedBackend[0]).toMatchObject({
        type: 'unused-backend',
        method: 'POST',
        path: '/api/v4/backups/run',
        pageModule: 'backup',
      })
    })

    it('handles param normalization for matching', () => {
      const frontendCalls = [
        { pageModule: 'TeamManager', method: 'PATCH', path: '/api/v4/teams/:param', source: 'src/TeamManager.tsx' },
      ]
      const backendEndpoints = [
        { moduleId: 'teams', method: 'PATCH', path: '/api/v4/teams/:teamId', source: 'server-v4/teams.ts' },
      ]

      const { missingBackend, unusedBackend } = computeGaps(frontendCalls, backendEndpoints)
      expect(missingBackend).toHaveLength(0)
      expect(unusedBackend).toHaveLength(0)
    })

    it('returns empty arrays when sets are equal', () => {
      const frontendCalls = [
        { pageModule: 'Auth', method: 'GET', path: '/api/v4/auth/session', source: 'src/auth.ts' },
      ]
      const backendEndpoints = [
        { moduleId: 'auth', method: 'GET', path: '/api/v4/auth/session', source: 'server-v4/auth.ts' },
      ]

      const { missingBackend, unusedBackend } = computeGaps(frontendCalls, backendEndpoints)
      expect(missingBackend).toHaveLength(0)
      expect(unusedBackend).toHaveLength(0)
    })
  })

  describe('findNewGaps', () => {
    it('identifies gaps not present in previous report', () => {
      const current = [
        { type: 'missing-backend', method: 'GET', path: '/api/v4/new-endpoint' },
        { type: 'missing-backend', method: 'GET', path: '/api/v4/old-endpoint' },
      ]
      const previous = [
        { type: 'missing-backend', method: 'GET', path: '/api/v4/old-endpoint' },
      ]

      const newGaps = findNewGaps(current, previous)
      expect(newGaps).toHaveLength(1)
      expect(newGaps[0].path).toBe('/api/v4/new-endpoint')
    })

    it('returns all gaps when no previous report exists', () => {
      const current = [
        { type: 'unused-backend', method: 'POST', path: '/api/v4/x' },
      ]
      const newGaps = findNewGaps(current, [])
      expect(newGaps).toHaveLength(1)
    })
  })

  describe('buildContractReport', () => {
    it('produces a full ContractReport structure', () => {
      const frontendCalls = [
        { pageModule: 'AuditLog', method: 'GET', path: '/api/v4/backups/summary', source: 'src/AuditLog.tsx' },
      ]
      const backendEndpoints = [
        { moduleId: 'backup', method: 'GET', path: '/api/v4/backups/summary', source: 'server-v4/backup.ts' },
        { moduleId: 'backup', method: 'POST', path: '/api/v4/backups/run', source: 'server-v4/backup.ts' },
      ]

      const report = buildContractReport(frontendCalls, backendEndpoints, null)

      expect(report).toMatchObject({
        totalFrontendCalls: 1,
        totalBackendEndpoints: 2,
      })
      expect(report.timestamp).toBeDefined()
      expect(report.missingBackend).toHaveLength(0)
      expect(report.unusedBackend).toHaveLength(1)
      expect(report.newGapsSinceLastRun).toHaveLength(1) // all gaps are new (no previous)
    })

    it('compares with previous report for newGapsSinceLastRun', () => {
      const frontendCalls = [
        { pageModule: 'AuditLog', method: 'GET', path: '/api/v4/backups/summary', source: 'src/AuditLog.tsx' },
      ]
      const backendEndpoints = [
        { moduleId: 'backup', method: 'GET', path: '/api/v4/backups/summary', source: 'server-v4/backup.ts' },
        { moduleId: 'backup', method: 'POST', path: '/api/v4/backups/run', source: 'server-v4/backup.ts' },
      ]

      const previousReport = {
        missingBackend: [],
        unusedBackend: [{ type: 'unused-backend', method: 'POST', path: '/api/v4/backups/run' }],
      }

      const report = buildContractReport(frontendCalls, backendEndpoints, previousReport)
      expect(report.newGapsSinceLastRun).toHaveLength(0)
    })
  })
})
