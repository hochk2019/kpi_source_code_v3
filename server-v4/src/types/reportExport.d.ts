declare module '../../../../server/reportExport.js' {
  type WatermarkPayload = {
    shortSignature?: string | null;
    formattedIssuedAt?: string | null;
    issuedAt?: string | Date | null;
    filterSummary?: string | null;
    requestId?: string | null;
  };

  type ReportExportResult = {
    buffer: Buffer;
    filename: string;
    signature?: string | null;
    watermark?: WatermarkPayload | null;
  };

  export function generateReport(
    kind: string,
    payload?: unknown,
    options?: unknown,
  ): Promise<ReportExportResult>;
}

declare module '../../../../server/reportExportPayloads.js' {
  type CompactReportExportPayload = {
    exportPayload: Record<string, unknown>;
    auditPayload: Record<string, unknown>;
  };

  export function buildCompactReportExportPayload(
    kind: string,
    payload?: Record<string, unknown>,
    sourceSnapshotInput?: Record<string, unknown>,
  ): CompactReportExportPayload | null;
}
