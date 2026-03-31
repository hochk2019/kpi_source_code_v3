export const API_V4_ROUTES = Object.freeze({
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

export const API_LEGACY_ROUTES = Object.freeze({
  dataHealthSummary: '/api/data-health/summary',
  duplicatePolicy: '/api/duplicate-policy',
  filterPresets: '/api/filter-presets',
  trainingResources: '/api/training-resources',
  feedback: '/api/feedback',
  feedbackSummary: '/api/feedback/summary',
  auditExport: '/api/admin/audit/export',
});
