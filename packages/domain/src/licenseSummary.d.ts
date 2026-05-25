export function normalizeLicenseCode(value: unknown): string;
export function normalizeAgencyKey(value: unknown): string;
export function extractAgencyKeys(row: Record<string, unknown>): string[];

export interface LicenseSnapshot {
  sourceCodes: string[];
  includedCodes: string[];
  excludedCodes: string[];
  sourceCount: number;
  includedCount: number;
  excludedCount: number;
  manualCount: number | null;
}

export function computeLicenseSnapshot(
  row: Record<string, unknown> | null | undefined,
  rules?: Record<string, unknown> | null,
): LicenseSnapshot;

export default computeLicenseSnapshot;
