export const API_V4_ROUTES = Object.freeze({
  ai: Object.freeze({
    profile: '/api/v4/ai/profile',
    config: '/api/v4/ai/config',
    cache: '/api/v4/ai/cache',
    providerTest: '/api/v4/ai/providers/test',
    providerPing: '/api/v4/ai/providers/ping',
    dataSnapshot: '/api/v4/ai/data/snapshot',
    chat: '/api/v4/ai/chat',
    history: '/api/v4/ai/history',
    insights: '/api/v4/ai/insights',
    snapshotHistory: '/api/v4/ai/data/snapshot/history',
    insightsSettings: '/api/v4/ai/insights/settings',
    insightsRun: '/api/v4/ai/insights/run',
    insightsFeedback: '/api/v4/ai/insights/feedback',
  }),
  rules: Object.freeze({
    history: '/api/v4/rules/history',
  }),
  dataHealth: Object.freeze({
    summary: '/api/v4/data-health/summary',
  }),
  duplicatePolicy: Object.freeze({
    base: '/api/v4/duplicate-policy',
  }),
  filterPresets: Object.freeze({
    base: '/api/v4/filter-presets',
  }),
  feedbackTraining: Object.freeze({
    trainingResources: '/api/v4/feedback-training/training-resources',
    feedback: '/api/v4/feedback-training/feedback',
    feedbackSummary: '/api/v4/feedback-training/feedback/summary',
  }),
  reporting: Object.freeze({
    exports: '/api/v4/reporting/exports',
    exportsAudit: '/api/v4/reporting/exports/audit',
    adminAuditExport: '/api/v4/reporting/audit/export',
  }),
  alerts: Object.freeze({
    notifications: '/api/v4/alerts/notifications',
    notificationsStream: '/api/v4/alerts/notifications/stream',
  }),
  hqAgencies: Object.freeze({
    history: '/api/v4/hq-agencies/history',
  }),
  backups: Object.freeze({
    summary: '/api/v4/backups/summary',
    files: '/api/v4/backups/files',
    schedule: '/api/v4/backups/schedule',
    run: '/api/v4/backups/run',
    restore: '/api/v4/backups/restore',
  }),
  meta: Object.freeze({
    rollout: '/api/v4/meta/rollout',
  }),
});
