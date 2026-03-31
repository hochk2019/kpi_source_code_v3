import { describe, expect, it } from 'vitest'

import { API_V4_ROUTES } from '@/lib/apiRoutes.js'

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
  it('exposes canonical v4 routes for ai, alerts, rules, reporting, health, feedback, hq history, and backups', () => {
    expect(API_V4_ROUTES.ai.profile).toBe('/api/v4/ai/profile')
    expect(API_V4_ROUTES.ai.config).toBe('/api/v4/ai/config')
    expect(API_V4_ROUTES.ai.cache).toBe('/api/v4/ai/cache')
    expect(API_V4_ROUTES.ai.providerTest).toBe('/api/v4/ai/providers/test')
    expect(API_V4_ROUTES.ai.providerPing).toBe('/api/v4/ai/providers/ping')
    expect(API_V4_ROUTES.ai.dataSnapshot).toBe('/api/v4/ai/data/snapshot')
    expect(API_V4_ROUTES.ai.chat).toBe('/api/v4/ai/chat')
    expect(API_V4_ROUTES.ai.history).toBe('/api/v4/ai/history')
    expect(API_V4_ROUTES.ai.insights).toBe('/api/v4/ai/insights')
    expect(API_V4_ROUTES.ai.snapshotHistory).toBe('/api/v4/ai/data/snapshot/history')
    expect(API_V4_ROUTES.ai.insightsSettings).toBe('/api/v4/ai/insights/settings')
    expect(API_V4_ROUTES.ai.insightsRun).toBe('/api/v4/ai/insights/run')
    expect(API_V4_ROUTES.ai.insightsFeedback).toBe('/api/v4/ai/insights/feedback')
    expect(API_V4_ROUTES.rules.history).toBe('/api/v4/rules/history')
    expect(API_V4_ROUTES.dataHealth.summary).toBe('/api/v4/data-health/summary')
    expect(API_V4_ROUTES.duplicatePolicy.base).toBe('/api/v4/duplicate-policy')
    expect(API_V4_ROUTES.filterPresets.base).toBe('/api/v4/filter-presets')
    expect(API_V4_ROUTES.feedbackTraining.trainingResources).toBe('/api/v4/feedback-training/training-resources')
    expect(API_V4_ROUTES.feedbackTraining.feedback).toBe('/api/v4/feedback-training/feedback')
    expect(API_V4_ROUTES.feedbackTraining.feedbackSummary).toBe('/api/v4/feedback-training/feedback/summary')
    expect(API_V4_ROUTES.reporting.exports).toBe('/api/v4/reporting/exports')
    expect(API_V4_ROUTES.reporting.exportsAudit).toBe('/api/v4/reporting/exports/audit')
    expect(API_V4_ROUTES.reporting.adminAuditExport).toBe('/api/v4/reporting/audit/export')
    expect(API_V4_ROUTES.alerts.notifications).toBe('/api/v4/alerts/notifications')
    expect(API_V4_ROUTES.alerts.notificationsStream).toBe('/api/v4/alerts/notifications/stream')
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
})
