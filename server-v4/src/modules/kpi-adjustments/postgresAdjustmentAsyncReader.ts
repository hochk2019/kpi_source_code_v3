import type { Pool } from 'pg';

import type { BusinessSnapshotSourceKind } from '../../persistence/businessSnapshotReader.js';
import type { AdjustmentAsyncReader } from './adjustmentAsyncReader.js';

type PoolLike = Pick<Pool, 'query'>;

type CanonicalAdjustmentRow = {
  id?: unknown;
  month?: unknown;
  category?: unknown;
  mode?: unknown;
  license_code?: unknown;
  staff_name?: unknown;
  team_name?: unknown;
  tax_code?: unknown;
  company_name?: unknown;
  quantity?: unknown;
  unit_points?: unknown;
  extra_quantity?: unknown;
  extra_unit_points?: unknown;
  total_points?: unknown;
  references?: unknown;
  note?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  approved_at?: unknown;
  rejected_at?: unknown;
  history_jsonb?: unknown;
};

const READ_CANONICAL_ADJUSTMENTS_SQL =
  'SELECT ' +
  'id::text AS id, ' +
  "COALESCE(to_char(month_start, 'YYYY-MM'), '') AS month, " +
  "COALESCE(category, '') AS category, " +
  "COALESCE(mode, '') AS mode, " +
  "COALESCE(license_code, '') AS license_code, " +
  "COALESCE(staff_name_snapshot, '') AS staff_name, " +
  "COALESCE(team_name_snapshot, '') AS team_name, " +
  "COALESCE(tax_code, '') AS tax_code, " +
  "COALESCE(company_name, '') AS company_name, " +
  'quantity, ' +
  'unit_points, ' +
  'extra_quantity, ' +
  'extra_unit_points, ' +
  'total_points, ' +
  'COALESCE("references", ARRAY[]::text[]) AS "references", ' +
  "COALESCE(note, '') AS note, " +
  "COALESCE(status, '') AS status, " +
  'created_at, ' +
  'updated_at, ' +
  'approved_at, ' +
  'rejected_at, ' +
  "COALESCE(history_jsonb, '[]'::jsonb) AS history_jsonb " +
  'FROM kpi_adjustments ' +
  'ORDER BY month_start ASC, created_at ASC, id ASC';

export class PostgresAdjustmentAsyncReader implements AdjustmentAsyncReader {
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    private readonly fallbackReader: AdjustmentAsyncReader,
    private readonly pool: PoolLike,
    options: {
      sourceKind?: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;
    } = {},
  ) {
    this.sourceKind = options.sourceKind ?? 'dual-write';
  }

  getSourceKind() {
    return this.sourceKind;
  }

  getHotPathKeys() {
    return this.fallbackReader.getHotPathKeys();
  }

  getLegacyDbFile(): string | null {
    return this.fallbackReader.getLegacyDbFile();
  }

  async readAdjustmentRows(): Promise<unknown[]> {
    try {
      const canonicalResult = await this.pool.query<CanonicalAdjustmentRow>(READ_CANONICAL_ADJUSTMENTS_SQL);
      const canonicalRows = Array.isArray(canonicalResult.rows)
        ? canonicalResult.rows.map((row) => buildCanonicalAdjustment(row))
        : [];

      if (canonicalRows.length > 0) {
        return canonicalRows;
      }
    } catch {
      // Fall back to the compatibility reader when canonical Postgres adjustment rows are unavailable.
    }

    return this.fallbackReader.readAdjustmentRows();
  }
}

function buildCanonicalAdjustment(row: CanonicalAdjustmentRow): Record<string, unknown> {
  return {
    id: normalizeText(row?.id),
    month: normalizeText(row?.month),
    category: normalizeText(row?.category),
    mode: normalizeText(row?.mode),
    licenseCode: normalizeText(row?.license_code),
    staffName: normalizeText(row?.staff_name),
    teamName: normalizeText(row?.team_name),
    taxCode: normalizeText(row?.tax_code),
    companyName: normalizeText(row?.company_name),
    quantity: toFiniteNumber(row?.quantity),
    unitPoints: toFiniteNumber(row?.unit_points),
    extraQuantity: toFiniteNumber(row?.extra_quantity),
    extraUnitPoints: toFiniteNumber(row?.extra_unit_points),
    totalPoints: toFiniteNumber(row?.total_points),
    references: normalizeStringArray(row?.references),
    note: normalizeText(row?.note),
    status: normalizeText(row?.status),
    createdAt: normalizeTimestamp(row?.created_at),
    updatedAt: normalizeTimestamp(row?.updated_at),
    approvedAt: normalizeTimestamp(row?.approved_at),
    rejectedAt: normalizeTimestamp(row?.rejected_at),
    history: normalizeHistory(row?.history_jsonb),
  };
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toFiniteNumber(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function normalizeTimestamp(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHistory(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.slice();
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
