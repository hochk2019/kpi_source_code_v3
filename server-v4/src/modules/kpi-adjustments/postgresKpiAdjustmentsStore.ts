import type { Pool } from 'pg';

import {
  cloneAdjustmentSettings,
  createDefaultAdjustmentSettings,
  normalizeAdjustmentSettings,
  type KpiAdjustmentSettingsDocument,
  type KpiAdjustmentStoredRecord,
  type KpiAdjustmentsStore,
} from './kpiAdjustmentsStore.js';

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
  approved_by?: unknown;
  rejected_at?: unknown;
  rejected_by?: unknown;
  history_jsonb?: unknown;
  version?: unknown;
};

type ConfigDocumentRow = {
  document?: unknown;
};

const SETTINGS_KEY = 'kpi_adjustment_settings_v1';

const CREATE_KPI_ADJUSTMENTS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS kpi_adjustments (' +
  'id TEXT PRIMARY KEY, ' +
  'month_start DATE NOT NULL, ' +
  'category TEXT NOT NULL, ' +
  'mode TEXT NULL, ' +
  'license_code TEXT NULL, ' +
  'staff_member_id TEXT NULL, ' +
  'team_id TEXT NULL, ' +
  "staff_name_snapshot TEXT NOT NULL DEFAULT '', " +
  "team_name_snapshot TEXT NOT NULL DEFAULT '', " +
  'tax_code TEXT NULL, ' +
  'company_name TEXT NULL, ' +
  'quantity NUMERIC(12,2) NOT NULL DEFAULT 0, ' +
  'unit_points NUMERIC(12,2) NOT NULL DEFAULT 0, ' +
  'extra_quantity NUMERIC(12,2) NULL, ' +
  'extra_unit_points NUMERIC(12,2) NULL, ' +
  'total_points NUMERIC(12,2) NOT NULL DEFAULT 0, ' +
  `"references" TEXT[] NOT NULL DEFAULT ARRAY[]::text[], ` +
  "note TEXT NOT NULL DEFAULT '', " +
  "status TEXT NOT NULL DEFAULT 'pending', " +
  'created_at TIMESTAMPTZ NOT NULL, ' +
  'created_by_account_id TEXT NULL, ' +
  'updated_at TIMESTAMPTZ NOT NULL, ' +
  'updated_by_account_id TEXT NULL, ' +
  'approved_at TIMESTAMPTZ NULL, ' +
  'approved_by_account_id TEXT NULL, ' +
  'rejected_at TIMESTAMPTZ NULL, ' +
  'rejected_by_account_id TEXT NULL, ' +
  `history_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb` +
  ')';

const CREATE_KPI_ADJUSTMENTS_MONTH_STATUS_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_kpi_adjustments_month_status ON kpi_adjustments(month_start, status)';

const ENSURE_VERSION_COLUMN_SQL =
  'ALTER TABLE kpi_adjustments ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1';

const CREATE_CONFIG_DOCUMENTS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS config_documents (' +
  'config_key TEXT PRIMARY KEY, ' +
  `document JSONB NOT NULL DEFAULT '{}'::jsonb, ` +
  'updated_at TIMESTAMPTZ NOT NULL, ' +
  'updated_by_account_id TEXT NULL' +
  ')';

const READ_ADJUSTMENT_BY_ID_SQL =
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
  'approved_by_account_id, ' +
  'rejected_at, ' +
  'rejected_by_account_id, ' +
  "COALESCE(history_jsonb, '[]'::jsonb) AS history_jsonb, " +
  'COALESCE(version, 1) AS version ' +
  'FROM kpi_adjustments ' +
  'WHERE id = $1';

const UPSERT_ADJUSTMENT_SQL =
  'INSERT INTO kpi_adjustments (' +
  'id, month_start, category, mode, license_code, staff_member_id, team_id, staff_name_snapshot, team_name_snapshot, ' +
  'tax_code, company_name, quantity, unit_points, extra_quantity, extra_unit_points, total_points, "references", note, ' +
  'status, created_at, created_by_account_id, updated_at, updated_by_account_id, approved_at, approved_by_account_id, ' +
  'rejected_at, rejected_by_account_id, history_jsonb, version' +
  ') VALUES (' +
  '$1, $2::date, $3, $4, $5, $6, $7, $8, $9, ' +
  '$10, $11, $12, $13, $14, $15, $16, $17::text[], $18, ' +
  '$19, $20::timestamptz, $21, $22::timestamptz, $23, $24::timestamptz, $25, ' +
  '$26::timestamptz, $27, $28::jsonb, $29' +
  ') ON CONFLICT (id) DO UPDATE SET ' +
  'month_start = EXCLUDED.month_start, ' +
  'category = EXCLUDED.category, ' +
  'mode = EXCLUDED.mode, ' +
  'license_code = EXCLUDED.license_code, ' +
  'staff_member_id = EXCLUDED.staff_member_id, ' +
  'team_id = EXCLUDED.team_id, ' +
  'staff_name_snapshot = EXCLUDED.staff_name_snapshot, ' +
  'team_name_snapshot = EXCLUDED.team_name_snapshot, ' +
  'tax_code = EXCLUDED.tax_code, ' +
  'company_name = EXCLUDED.company_name, ' +
  'quantity = EXCLUDED.quantity, ' +
  'unit_points = EXCLUDED.unit_points, ' +
  'extra_quantity = EXCLUDED.extra_quantity, ' +
  'extra_unit_points = EXCLUDED.extra_unit_points, ' +
  'total_points = EXCLUDED.total_points, ' +
  `"references" = EXCLUDED."references", ` +
  'note = EXCLUDED.note, ' +
  'status = EXCLUDED.status, ' +
  'updated_at = EXCLUDED.updated_at, ' +
  'updated_by_account_id = EXCLUDED.updated_by_account_id, ' +
  'approved_at = EXCLUDED.approved_at, ' +
  'approved_by_account_id = EXCLUDED.approved_by_account_id, ' +
  'rejected_at = EXCLUDED.rejected_at, ' +
  'rejected_by_account_id = EXCLUDED.rejected_by_account_id, ' +
  'history_jsonb = EXCLUDED.history_jsonb, ' +
  'version = EXCLUDED.version ' +
  'WHERE kpi_adjustments.version = $29 - 1';

const READ_SETTINGS_SQL =
  'SELECT document ' +
  'FROM config_documents ' +
  'WHERE config_key = $1';

const UPSERT_SETTINGS_SQL =
  'INSERT INTO config_documents (config_key, document, updated_at, updated_by_account_id) ' +
  'VALUES ($1, $2::jsonb, $3::timestamptz, $4) ' +
  'ON CONFLICT (config_key) DO UPDATE SET ' +
  'document = EXCLUDED.document, ' +
  'updated_at = EXCLUDED.updated_at, ' +
  'updated_by_account_id = EXCLUDED.updated_by_account_id';

export class PostgresKpiAdjustmentsStore implements KpiAdjustmentsStore {
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly pool: PoolLike) {}

  async readAdjustmentById(id: string): Promise<KpiAdjustmentStoredRecord | null> {
    const normalizedId = `${id ?? ''}`.trim();
    if (!normalizedId) {
      return null;
    }

    await this.ensureInitialized();
    const result = await this.pool.query<CanonicalAdjustmentRow>(READ_ADJUSTMENT_BY_ID_SQL, [normalizedId]);
    return normalizeCanonicalAdjustment(result.rows[0]);
  }

  async createAdjustment(record: KpiAdjustmentStoredRecord): Promise<KpiAdjustmentStoredRecord> {
    await this.ensureInitialized();
    await this.pool.query(UPSERT_ADJUSTMENT_SQL, toUpsertParams(record));
    return cloneRecord(record);
  }

  async updateAdjustment(record: KpiAdjustmentStoredRecord): Promise<KpiAdjustmentStoredRecord> {
    await this.ensureInitialized();
    const result = await this.pool.query(UPSERT_ADJUSTMENT_SQL, toUpsertParams(record));
    if (result.rowCount === 0) {
      throw new Error('version_conflict');
    }
    return cloneRecord(record);
  }

  async readSettings(): Promise<KpiAdjustmentSettingsDocument> {
    await this.ensureInitialized();
    const result = await this.pool.query<ConfigDocumentRow>(READ_SETTINGS_SQL, [SETTINGS_KEY]);
    if (!result.rows[0]) {
      return cloneAdjustmentSettings(createDefaultAdjustmentSettings());
    }

    return normalizeAdjustmentSettings(result.rows[0].document);
  }

  async writeSettings(settings: KpiAdjustmentSettingsDocument): Promise<KpiAdjustmentSettingsDocument> {
    const normalized = cloneAdjustmentSettings(settings);
    await this.ensureInitialized();
    await this.pool.query(UPSERT_SETTINGS_SQL, [
      SETTINGS_KEY,
      JSON.stringify(normalized),
      normalized.updatedAt ?? new Date().toISOString(),
      null,
    ]);

    return cloneAdjustmentSettings(normalized);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = initializeKpiAdjustmentsStorage(this.pool).catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }

    await this.initializationPromise;
  }
}

async function initializeKpiAdjustmentsStorage(pool: PoolLike): Promise<void> {
  await pool.query(CREATE_KPI_ADJUSTMENTS_TABLE_SQL);
  await pool.query(CREATE_KPI_ADJUSTMENTS_MONTH_STATUS_INDEX_SQL);
  await pool.query(ENSURE_VERSION_COLUMN_SQL);
  await pool.query(CREATE_CONFIG_DOCUMENTS_TABLE_SQL);
}

function toUpsertParams(record: KpiAdjustmentStoredRecord): unknown[] {
  return [
    record.id,
    `${record.month}-01`,
    record.category,
    record.mode ?? null,
    record.licenseCode ?? null,
    null,
    null,
    record.staffName,
    record.teamName,
    record.taxCode ?? null,
    record.companyName ?? null,
    record.quantity,
    record.unitPoints,
    record.extraQuantity ?? null,
    record.extraUnitPoints ?? null,
    record.totalPoints,
    Array.isArray(record.references) ? record.references.slice() : [],
    record.note,
    record.status,
    record.createdAt,
    null,
    record.updatedAt,
    null,
    record.approvedAt ?? null,
    record.approvedBy ?? null,
    record.rejectedAt ?? null,
    record.rejectedBy ?? null,
    JSON.stringify(Array.isArray(record.history) ? record.history : []),
    record.version ?? 1,
  ];
}

function normalizeCanonicalAdjustment(row: CanonicalAdjustmentRow | undefined): KpiAdjustmentStoredRecord | null {
  if (!row) {
    return null;
  }

  const id = normalizeText(row.id);
  const category = normalizeText(row.category);
  const month = normalizeText(row.month);
  if (!id || !category || !month) {
    return null;
  }

  return {
    id,
    category,
    month,
    status: normalizeStatus(row.status),
    staffName: normalizeText(row.staff_name),
    teamName: normalizeText(row.team_name),
    quantity: normalizeNumber(row.quantity),
    unitPoints: normalizeNumber(row.unit_points),
    totalPoints: normalizeNumber(row.total_points),
    references: normalizeStringArray(row.references),
    note: normalizeText(row.note),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    history: normalizeHistory(row.history_jsonb),
    mode: normalizeOptionalText(row.mode),
    licenseCode: normalizeOptionalText(row.license_code),
    companyName: normalizeOptionalText(row.company_name),
    taxCode: normalizeOptionalText(row.tax_code),
    extraQuantity: normalizeOptionalNumber(row.extra_quantity),
    extraUnitPoints: normalizeOptionalNumber(row.extra_unit_points),
    approvedAt: normalizeOptionalText(row.approved_at),
    approvedBy: normalizeOptionalText(row.approved_by),
    rejectedAt: normalizeOptionalText(row.rejected_at),
    rejectedBy: normalizeOptionalText(row.rejected_by),
    version: normalizeNumber(row.version) || 1,
  };
}

function cloneRecord(record: KpiAdjustmentStoredRecord): KpiAdjustmentStoredRecord {
  return {
    ...record,
    references: Array.isArray(record.references) ? record.references.slice() : [],
    history: Array.isArray(record.history) ? record.history.slice() : [],
  };
}

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim();
}

function normalizeOptionalText(value: unknown): string | undefined {
  const normalized = normalizeText(value);
  return normalized || undefined;
}

function normalizeTimestamp(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) {
    return '';
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeNumber(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((entry) => normalizeText(entry)).filter(Boolean) : [];
  } catch {
    return [];
  }
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

function normalizeStatus(value: unknown): KpiAdjustmentStoredRecord['status'] {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'approved' || normalized === 'rejected') {
    return normalized;
  }
  return 'pending';
}
