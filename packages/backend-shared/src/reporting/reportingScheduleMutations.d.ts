export const REPORT_SCHEDULE_STORAGE_KEY: string;

export function normalizeReportingScheduleMutationEntry(
  input: unknown,
  fallback?: Record<string, unknown> | null,
  options?: { fromDate?: Date },
): Record<string, unknown>;

export function upsertReportingSchedule(
  entriesInput: unknown,
  entry: Record<string, unknown>,
  options?: { fromDate?: Date },
): {
  saved: Record<string, unknown>;
  items: Record<string, unknown>[];
};

export function removeReportingSchedule(
  entriesInput: unknown,
  id: string,
): {
  deleted: boolean;
  items: Record<string, unknown>[];
};
