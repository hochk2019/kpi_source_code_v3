import { describe, expect, it } from 'vitest'

import { API_LEGACY_ROUTES, API_V4_ROUTES } from '@/lib/apiRoutes.js'

function collectRouteValues(node, bucket = []) {
  if (!node || typeof node !== 'object') {
    return bucket
  }
  for (const value of Object.values(node)) {
    if (typeof value === 'string') {
      bucket.push(value)
      continue
    }
    collectRouteValues(value, bucket)
  }
  return bucket
}

describe('apiRoutes', () => {
  it('exposes canonical v4 routes for hq history and backups', () => {
    expect(API_V4_ROUTES.hqAgencies.history).toBe('/api/v4/hq-agencies/history')
    expect(API_V4_ROUTES.backups.summary).toBe('/api/v4/backups/summary')
    expect(API_V4_ROUTES.backups.files).toBe('/api/v4/backups/files')
    expect(API_V4_ROUTES.backups.schedule).toBe('/api/v4/backups/schedule')
    expect(API_V4_ROUTES.backups.run).toBe('/api/v4/backups/run')
    expect(API_V4_ROUTES.backups.restore).toBe('/api/v4/backups/restore')
    expect(API_V4_ROUTES.meta.rollout).toBe('/api/v4/meta/rollout')
  })

  it('keeps v4 namespace consistent for canonical routes', () => {
    const routes = collectRouteValues(API_V4_ROUTES)
    expect(routes.length).toBeGreaterThan(0)
    for (const route of routes) {
      expect(route.startsWith('/api/v4/')).toBe(true)
    }
  })

  it('tracks explicit legacy route usage separately', () => {
    expect(API_LEGACY_ROUTES.auditExport).toBe('/api/admin/audit/export')
    expect(API_LEGACY_ROUTES.dataHealthSummary).toBe('/api/data-health/summary')
    expect(API_LEGACY_ROUTES.duplicatePolicy).toBe('/api/duplicate-policy')
    expect(API_LEGACY_ROUTES.filterPresets).toBe('/api/filter-presets')
    expect(API_LEGACY_ROUTES.trainingResources).toBe('/api/training-resources')
    expect(API_LEGACY_ROUTES.feedback).toBe('/api/feedback')
    expect(API_LEGACY_ROUTES.feedbackSummary).toBe('/api/feedback/summary')
  })
})
