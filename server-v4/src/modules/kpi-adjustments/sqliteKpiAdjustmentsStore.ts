import Database from 'better-sqlite3';
import {
  ensureSqliteKvStore,
  readAdjustmentRowsSnapshot,
  writeAdjustmentRowsSnapshot,
} from '@kpi/backend-shared/persistence';

import {
  cloneAdjustmentSettings,
  createDefaultAdjustmentSettings,
  normalizeAdjustmentSettings,
  type KpiAdjustmentSettingsDocument,
  type KpiAdjustmentStoredRecord,
  type KpiAdjustmentsStore,
} from './kpiAdjustmentsStore.js';

const LEGACY_ADJUSTMENTS_KEY = 'kpi_adjustments_v1';
const LEGACY_SETTINGS_KEY = 'kpi_adjustment_settings_v1';

export class SqliteKpiAdjustmentsStore implements KpiAdjustmentsStore {
  constructor(private readonly dbFile: string) {}

  async readAdjustmentById(id: string): Promise<KpiAdjustmentStoredRecord | null> {
    const normalizedId = `${id ?? ''}`.trim();
    if (!normalizedId) {
      return null;
    }

    return this.withDatabase((database) => {
      const rows = this.readAdjustmentRows(database);
      return rows.find((entry) => entry.id === normalizedId) ?? null;
    });
  }

  async createAdjustment(record: KpiAdjustmentStoredRecord): Promise<KpiAdjustmentStoredRecord> {
    return this.withDatabase((database) => {
      const rows = this.readAdjustmentRows(database);
      rows.unshift(cloneRecord(record));
      this.writeAdjustmentRows(database, rows);
      return cloneRecord(record);
    });
  }

  async updateAdjustment(record: KpiAdjustmentStoredRecord): Promise<KpiAdjustmentStoredRecord> {
    return this.withDatabase((database) => {
      const rows = this.readAdjustmentRows(database);
      const index = rows.findIndex((entry) => entry.id === record.id);
      if (index < 0) {
        throw new Error(`KPI adjustment "${record.id}" was not found in sqlite store.`);
      }

      const expectedVersion = record.version ?? 1;
      const currentVersion = rows[index].version ?? 1;
      if (currentVersion !== expectedVersion) {
        throw new Error('version_conflict');
      }

      rows[index] = cloneRecord(record);
      this.writeAdjustmentRows(database, rows);
      return cloneRecord(record);
    });
  }

  async readSettings(): Promise<KpiAdjustmentSettingsDocument> {
    return this.withDatabase((database) => {
      this.ensureKvStore(database);
      const row = database.prepare('SELECT value FROM kv_store WHERE key = ?').get(LEGACY_SETTINGS_KEY) as
        | { value?: string | null }
        | undefined;
      if (!row?.value) {
        return cloneAdjustmentSettings(createDefaultAdjustmentSettings());
      }

      try {
        return normalizeAdjustmentSettings(JSON.parse(row.value));
      } catch {
        return cloneAdjustmentSettings(createDefaultAdjustmentSettings());
      }
    });
  }

  async writeSettings(settings: KpiAdjustmentSettingsDocument): Promise<KpiAdjustmentSettingsDocument> {
    const normalized = cloneAdjustmentSettings(settings);

    return this.withDatabase((database) => {
      this.ensureKvStore(database);
      database
        .prepare(
          'INSERT INTO kv_store (key, value) VALUES (?, ?) ' +
            'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        )
        .run(LEGACY_SETTINGS_KEY, JSON.stringify(normalized));

      return cloneAdjustmentSettings(normalized);
    });
  }

  private readAdjustmentRows(database: Database): KpiAdjustmentStoredRecord[] {
    const rows = readAdjustmentRowsSnapshot(database);
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .map((entry) => normalizeStoredRecord(entry))
      .filter((entry): entry is KpiAdjustmentStoredRecord => Boolean(entry));
  }

  private writeAdjustmentRows(database: Database, rows: readonly KpiAdjustmentStoredRecord[]): void {
    const snapshot = rows.map((entry) => cloneRecord(entry));
    const updatedAt = new Date().toISOString();

    writeAdjustmentRowsSnapshot(database, snapshot, { updatedAt });
    this.ensureKvStore(database);
    database
      .prepare(
        'INSERT INTO kv_store (key, value) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(LEGACY_ADJUSTMENTS_KEY, JSON.stringify(snapshot));
  }

  private ensureKvStore(database: Database): void {
    ensureSqliteKvStore(database);
  }

  private withDatabase<T>(work: (database: Database) => T): T {
    const database = new Database(this.dbFile);

    try {
      return work(database);
    } finally {
      database.close();
    }
  }
}

function normalizeStoredRecord(value: unknown): KpiAdjustmentStoredRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id);
  const category = normalizeText(record.category);
  const month = normalizeText(record.month);
  const status = normalizeStatus(record.status);

  if (!id || !category || !month) {
    return null;
  }

  return {
    ...record,
    id,
    category,
    month,
    status,
    staffName: normalizeText(record.staffName ?? record.staff_name ?? record.staff),
    teamName: normalizeText(record.teamName ?? record.team_name ?? record.team),
    quantity: normalizeNumber(record.quantity, 0),
    unitPoints: normalizeNumber(record.unitPoints ?? record.unit_points, 0),
    totalPoints: normalizeNumber(record.totalPoints ?? record.total_points, 0),
    references: normalizeStringArray(record.references),
    note: normalizeText(record.note),
    createdAt: normalizeText(record.createdAt ?? record.created_at),
    updatedAt: normalizeText(record.updatedAt ?? record.updated_at),
    history: Array.isArray(record.history) ? record.history.slice() : [],
    mode: normalizeOptionalText(record.mode),
    licenseCode: normalizeOptionalText(record.licenseCode ?? record.license_code),
    companyName: normalizeOptionalText(record.companyName ?? record.company_name),
    taxCode: normalizeOptionalText(record.taxCode ?? record.tax_code),
    extraQuantity: normalizeOptionalNumber(record.extraQuantity ?? record.extra_quantity),
    extraUnitPoints: normalizeOptionalNumber(record.extraUnitPoints ?? record.extra_unit_points),
    createdBy: normalizeOptionalText(record.createdBy ?? record.created_by),
    updatedBy: normalizeOptionalText(record.updatedBy ?? record.updated_by),
    approvedAt: normalizeOptionalText(record.approvedAt ?? record.approved_at),
    approvedBy: normalizeOptionalText(record.approvedBy ?? record.approved_by),
    rejectedAt: normalizeOptionalText(record.rejectedAt ?? record.rejected_at),
    rejectedBy: normalizeOptionalText(record.rejectedBy ?? record.rejected_by),
    version: normalizeNumber(record.version, 1) || 1,
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

function normalizeNumber(value: unknown, fallback: number): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => normalizeText(entry)).filter(Boolean);
}

function normalizeStatus(value: unknown): KpiAdjustmentStoredRecord['status'] {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'approved' || normalized === 'rejected') {
    return normalized;
  }
  return 'pending';
}
