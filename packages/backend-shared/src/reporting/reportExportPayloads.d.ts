export function buildCompactReportExportPayload(
  kind: 'staff' | 'team' | 'allStaff' | 'allTeam',
  payload?: Record<string, unknown>,
  sourceSnapshotInput?: Record<string, unknown>,
): {
  exportPayload: Record<string, unknown>;
  auditPayload: Record<string, unknown>;
} | null;
