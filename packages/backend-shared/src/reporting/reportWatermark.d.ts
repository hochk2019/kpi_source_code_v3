export function computeWatermarkSignature(metadata?: {
  issuedAt?: Date;
  actor?: string;
  kind?: string;
  filtersSummary?: string;
  requestId?: string;
  secret?: string;
}): string;

export function applyWorkbookWatermark(
  workbook: unknown,
  metadata?: {
    issuedAt?: Date;
    actor?: string;
    actorName?: string;
    kind?: string;
    ipAddress?: string;
    filters?: Record<string, unknown>;
    requestId?: string;
    secret?: string;
    sheetName?: string;
  },
): {
  signature: string;
  shortSignature: string;
  issuedAt: Date;
  formattedIssuedAt: string;
  filterSummary: string;
  filters: Record<string, unknown>;
  actor: string;
  actorName: string;
  displayName: string;
  kind: string;
  ipAddress: string;
  requestId: string;
};

export function sanitizeExportFilters(filters: unknown): unknown;
