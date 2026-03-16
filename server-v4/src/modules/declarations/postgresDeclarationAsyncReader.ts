import type { Pool } from 'pg';

import type { BusinessSnapshotSourceKind } from '../../persistence/businessSnapshotReader.js';
import type { DeclarationAsyncReader } from './declarationAsyncReader.js';

type PoolLike = Pick<Pool, 'query'>;

type CanonicalDeclarationRow = {
  declaration_id?: unknown;
  declaration_no?: unknown;
  declaration_no_raw?: unknown;
  branch_code?: unknown;
  declared_at?: unknown;
  tax_code?: unknown;
  company_name?: unknown;
  customs_type_code?: unknown;
  item_count?: unknown;
  license_count?: unknown;
  staff_name_snapshot?: unknown;
  team_name_snapshot?: unknown;
  agency_text?: unknown;
  is_export?: unknown;
  co_line_count?: unknown;
  reviewed?: unknown;
  reviewed_at?: unknown;
  reviewed_by?: unknown;
  license_codes?: unknown;
  license_source_codes?: unknown;
  license_excluded_codes?: unknown;
};

const READ_CANONICAL_DECLARATION_ROWS_SQL =
  'SELECT ' +
  "d.id::text AS declaration_id, " +
  "COALESCE(d.declaration_no, '') AS declaration_no, " +
  "COALESCE(d.declaration_no_raw, '') AS declaration_no_raw, " +
  "COALESCE(d.branch_code, '') AS branch_code, " +
  "COALESCE(to_char(d.declared_at, 'YYYY-MM-DD'), '') AS declared_at, " +
  "COALESCE(d.tax_code, '') AS tax_code, " +
  "COALESCE(d.company_name, '') AS company_name, " +
  "COALESCE(d.customs_type_code, '') AS customs_type_code, " +
  'd.item_count, ' +
  'd.license_count, ' +
  "COALESCE(d.staff_name_snapshot, '') AS staff_name_snapshot, " +
  "COALESCE(d.team_name_snapshot, '') AS team_name_snapshot, " +
  "COALESCE(d.agency_text, '') AS agency_text, " +
  'd.is_export, ' +
  'd.co_line_count, ' +
  'd.reviewed, ' +
  'd.reviewed_at::text AS reviewed_at, ' +
  "COALESCE(d.reviewed_by, '') AS reviewed_by, " +
  `COALESCE(
     array_agg(DISTINCT dlc.code) FILTER (WHERE dlc.code IS NOT NULL AND dlc.code <> '' AND NOT dlc.is_excluded),
     ARRAY[]::text[]
   ) AS license_codes, ` +
  `COALESCE(
     array_agg(DISTINCT dlc.code) FILTER (WHERE dlc.code IS NOT NULL AND dlc.code <> ''),
     ARRAY[]::text[]
   ) AS license_source_codes, ` +
  `COALESCE(
     array_agg(DISTINCT dlc.code) FILTER (WHERE dlc.code IS NOT NULL AND dlc.code <> '' AND dlc.is_excluded),
     ARRAY[]::text[]
   ) AS license_excluded_codes ` +
  'FROM declarations d ' +
  'LEFT JOIN declaration_license_codes dlc ON dlc.declaration_id = d.id ' +
  'WHERE d.deleted_at IS NULL ' +
  'GROUP BY d.id, d.declaration_no, d.declaration_no_raw, d.branch_code, d.declared_at, d.tax_code, d.company_name, d.customs_type_code, d.item_count, d.license_count, d.staff_name_snapshot, d.team_name_snapshot, d.agency_text, d.is_export, d.co_line_count, d.reviewed, d.reviewed_at, d.reviewed_by ' +
  'ORDER BY d.declared_at DESC, d.declaration_no DESC, d.branch_code DESC';

export class PostgresDeclarationAsyncReader implements DeclarationAsyncReader {
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    private readonly fallbackReader: DeclarationAsyncReader,
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

  async readDeclarationRows(): Promise<unknown[]> {
    try {
      const canonicalResult = await this.pool.query<CanonicalDeclarationRow>(READ_CANONICAL_DECLARATION_ROWS_SQL);
      const canonicalRows = Array.isArray(canonicalResult.rows)
        ? canonicalResult.rows.map((row) => buildCanonicalDeclaration(row))
        : [];

      if (canonicalRows.length > 0) {
        return canonicalRows;
      }
    } catch {
      // Fall back to the compatibility reader when canonical Postgres declaration rows are unavailable.
    }

    return this.fallbackReader.readDeclarationRows();
  }
}

function buildCanonicalDeclaration(row: CanonicalDeclarationRow): Record<string, unknown> {
  const branch = normalizeText(row?.branch_code);
  const declaredAt = normalizeText(row?.declared_at);
  const companyName = normalizeText(row?.company_name);
  const agencyText = normalizeText(row?.agency_text);
  const coLineCount = toFiniteNumber(row?.co_line_count);

  return {
    declaration_id: normalizeText(row?.declaration_id),
    declaration_no: normalizeText(row?.declaration_no),
    so_tk: normalizeText(row?.declaration_no),
    declaration_no_raw: normalizeText(row?.declaration_no_raw),
    so_tk_full: normalizeText(row?.declaration_no_raw) || normalizeText(row?.declaration_no),
    branch_code: branch,
    branch,
    nhanh: branch,
    declared_at: declaredAt,
    date: declaredAt,
    tax_code: normalizeText(row?.tax_code),
    mst: normalizeText(row?.tax_code),
    company_name: companyName,
    cong_ty: companyName,
    customs_type_code: normalizeText(row?.customs_type_code),
    ma_loai_hinh: normalizeText(row?.customs_type_code),
    loai_hinh: normalizeText(row?.customs_type_code),
    item_count: toFiniteNumber(row?.item_count),
    num_items: toFiniteNumber(row?.item_count),
    muc_hang: toFiniteNumber(row?.item_count),
    license_count: toFiniteNumber(row?.license_count),
    licenses: toFiniteNumber(row?.license_count),
    so_luong_gp: toFiniteNumber(row?.license_count),
    staff_name_snapshot: normalizeText(row?.staff_name_snapshot),
    nhan_vien: normalizeText(row?.staff_name_snapshot),
    team_name_snapshot: normalizeText(row?.team_name_snapshot),
    team: normalizeText(row?.team_name_snapshot),
    agency_text: agencyText,
    agency: agencyText,
    dai_ly: agencyText,
    is_export: toBoolean(row?.is_export),
    isExport: toBoolean(row?.is_export),
    co_line_count: coLineCount,
    has_co: coLineCount > 0,
    reviewed: toBoolean(row?.reviewed),
    reviewed_at: normalizeText(row?.reviewed_at),
    reviewed_by: normalizeText(row?.reviewed_by),
    licenseCodes: normalizeStringArray(row?.license_codes),
    licenseSourceCodes: normalizeStringArray(row?.license_source_codes),
    licenseExcludedCodes: normalizeStringArray(row?.license_excluded_codes),
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

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 't';
  }

  return false;
}
