export function buildLegacyReportData(
  rowsInput: unknown[],
  options?: {
    roster?: unknown;
    rules?: unknown;
    from?: string;
    to?: string;
    adjustments?: unknown[];
    [key: string]: unknown;
  },
): Record<string, unknown>;

export function aggregateLegacyCompanies(
  rowsInput: unknown[],
  options?: {
    includeStaff?: boolean;
    includeTeam?: boolean;
  },
): Record<string, unknown>[];
