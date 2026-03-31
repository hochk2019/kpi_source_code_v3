import type { DomainModule } from './domain-module.js';
import { alertsModule } from '../modules/alerts/alerts.module.js';
import { authModule } from '../modules/auth/auth.module.js';
import { backupModule } from '../modules/backup/backup.module.js';
import { dataHealthModule } from '../modules/data-health/data-health.module.js';
import { declarationsModule } from '../modules/declarations/declarations.module.js';
import { duplicatePolicyModule } from '../modules/duplicate-policy/duplicate-policy.module.js';
import { feedbackTrainingModule } from '../modules/feedback-training/feedback-training.module.js';
import { filterPresetsModule } from '../modules/filter-presets/filter-presets.module.js';
import { hqAgenciesModule } from '../modules/hq-agencies/hq-agencies.module.js';
import { kpiAdjustmentsModule } from '../modules/kpi-adjustments/kpi-adjustments.module.js';
import { kpiRulesModule } from '../modules/kpi-rules/kpi-rules.module.js';
import { mstAssignmentsModule } from '../modules/mst-assignments/mst-assignments.module.js';
import { reportingModule } from '../modules/reporting/reporting.module.js';
import { teamsModule } from '../modules/teams/teams.module.js';

export const moduleCatalog: readonly DomainModule[] = Object.freeze([
  alertsModule,
  authModule,
  backupModule,
  dataHealthModule,
  duplicatePolicyModule,
  feedbackTrainingModule,
  filterPresetsModule,
  declarationsModule,
  mstAssignmentsModule,
  teamsModule,
  hqAgenciesModule,
  kpiRulesModule,
  kpiAdjustmentsModule,
  reportingModule,
]);
