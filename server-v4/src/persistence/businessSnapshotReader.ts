export const LEGACY_BUSINESS_HOT_PATH_KEYS = [
  'decl_rows_v1',
  'mst_rows_v2',
  'team_roster_v1',
  'kpi_rules_v2',
  'kpi_adjustments_v1',
  'kpi_report_schedule_v1',
] as const;

export type BusinessHotPathKey = (typeof LEGACY_BUSINESS_HOT_PATH_KEYS)[number];
export type BusinessSnapshotSourceKind = 'legacy-kv-store' | 'dual-write' | 'relational-store';

export interface BusinessSnapshotReader {
  getSourceKind(): BusinessSnapshotSourceKind;
  getHotPathKeys(): readonly BusinessHotPathKey[];
  getLegacyDbFile(): string | null;
  readDeclarationRows(): unknown[];
  readMstAssignmentRows(): unknown[];
  readTeamRoster(): unknown;
  readRuleCollection(): unknown;
  readAdjustmentRows(): unknown[];
  readReportSchedules(): unknown[];
  readMonthlyAggregateSnapshot(): unknown;
  readDefaultMonthlyAggregateSnapshot(): unknown;
}
