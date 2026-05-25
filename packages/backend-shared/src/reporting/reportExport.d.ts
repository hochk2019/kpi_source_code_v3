export interface ReportExportResult {
  buffer: Buffer;
  filename: string;
  watermark: Record<string, unknown> | null;
  signature: string | null;
}

export interface ReportExportOptions {
  watermark?: Record<string, unknown>;
}

export function clearReportCache(): void;

export function generateStaffReport(
  payload?: Record<string, unknown>,
  options?: ReportExportOptions,
): Promise<ReportExportResult>;

export function generateTeamReport(
  payload?: Record<string, unknown>,
  options?: ReportExportOptions,
): Promise<ReportExportResult>;

export function generateAllStaffReport(
  payload?: Record<string, unknown>,
  options?: ReportExportOptions,
): Promise<ReportExportResult>;

export function generateAllTeamReport(
  payload?: Record<string, unknown>,
  options?: ReportExportOptions,
): Promise<ReportExportResult>;

export function generateReport(
  kind: 'staff' | 'team' | 'allStaff' | 'allTeam',
  payload: Record<string, unknown>,
  options?: ReportExportOptions,
): Promise<ReportExportResult>;

declare const _default: {
  generateReport: typeof generateReport;
  generateStaffReport: typeof generateStaffReport;
  generateTeamReport: typeof generateTeamReport;
  generateAllStaffReport: typeof generateAllStaffReport;
  generateAllTeamReport: typeof generateAllTeamReport;
  clearReportCache: typeof clearReportCache;
};

export default _default;
