export function buildReportingReadModels(
  rowsInput: unknown[],
  options?: {
    roster?: unknown;
    rules?: unknown;
    from?: string;
    to?: string;
    adjustments?: unknown[];
    limit?: number;
  },
): {
  summary: Record<string, unknown>;
  staff: { range: Record<string, unknown>; ruleSet: Record<string, unknown>; total: number; keysHash: string; items: Record<string, unknown>[] };
  teams: { range: Record<string, unknown>; ruleSet: Record<string, unknown>; total: number; keysHash: string; items: Record<string, unknown>[] };
};

export function buildMonthlyReportingAggregates(
  rowsInput: unknown[],
  options?: {
    roster?: unknown;
    rules?: unknown;
    from?: string;
    to?: string;
    adjustments?: unknown[];
    limit?: number;
    generatedAt?: Date;
  },
): Record<string, unknown>;

export function buildMonthlyAggregateQueryKey(query?: {
  from?: string;
  to?: string;
  limit?: number;
}): string;

export function buildDefaultMonthlyAggregateQuery(rowsInput: unknown[]): {
  from: string;
  to: string;
};

export function listReportingSchedules(
  entriesInput: unknown,
  options?: { asOf?: unknown },
): {
  total: number;
  items: Record<string, unknown>[];
};
