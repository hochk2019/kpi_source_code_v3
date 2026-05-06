export function searchDeclarationSnapshot(
  database: unknown,
  rawFilters?: Record<string, unknown>,
  options?: {
    snapshotKey?: string;
    page?: number;
    pageSize?: number;
  },
): {
  total: number;
  page: number;
  pageSize: number;
  rows: Record<string, unknown>[];
} | null;
