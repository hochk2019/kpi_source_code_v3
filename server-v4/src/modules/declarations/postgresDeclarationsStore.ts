import type { Pool } from 'pg';

import { normalizeStr, slugify } from '../../legacy/legacy-normalizers.js';
import {
  normalizeCoCodeConfig,
  normalizeCoDiscrepancyConfig,
  normalizeCoDiscrepancyState,
  type CoCodeConfigDocument,
  type CoDiscrepancyConfigDocument,
  type CoDiscrepancyStateDocument,
} from './declarationCoMonitoring.js';
import {
  normalizeDeclarationAlertConfig,
  normalizeDeclarationAlertState,
  type DeclarationAlertConfigDocument,
  type DeclarationAlertStateDocument,
} from './declarationAlerts.js';
import {
  ECUS_SYNC_CONFIG_STORAGE_KEY,
  normalizeEcusSyncConfig,
  type EcusSyncConfigDocument,
} from './ecusSyncConfig.js';
import {
  applyDeclarationPatch,
  buildDeclarationDeletionEvent,
  buildDeclarationUpdateEvent,
  cloneDeclarationRecord,
  compareDeclarationEventsDescending,
  type DeclarationImportCommitInput,
  type DeclarationActor,
  type DeletedDeclarationFilters,
  type DeletedDeclarationRecord,
  type DeclarationEventRecord,
  type DeclarationStoreTarget,
  type DeclarationsStore,
  type NormalizedDeclarationPatch,
} from './declarationsStore.js';

type PoolLike = Pick<Pool, 'query'>;

type DeclarationIdentityRow = {
  id?: unknown;
};

type DeclarationEventRow = {
  id?: unknown;
  event_type?: unknown;
  payload?: unknown;
  actor_username?: unknown;
  occurred_at?: unknown;
};

type ConfigDocumentRow = {
  document?: unknown;
};

const CREATE_EVENTS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS declaration_events (' +
  'id BIGSERIAL PRIMARY KEY, ' +
  'declaration_id TEXT NOT NULL, ' +
  'event_type TEXT NOT NULL, ' +
  `payload JSONB NOT NULL DEFAULT '{}'::jsonb, ` +
  'actor_username TEXT NOT NULL, ' +
  'occurred_at TIMESTAMPTZ NOT NULL' +
  ')';

const CREATE_EVENTS_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_declaration_events_declaration_id_occurred_at ' +
  'ON declaration_events(declaration_id, occurred_at DESC, id DESC)';

const CREATE_CONFIG_DOCUMENTS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS config_documents (' +
  'config_key TEXT PRIMARY KEY, ' +
  `document JSONB NOT NULL DEFAULT '{}'::jsonb, ` +
  'updated_at TIMESTAMPTZ NOT NULL, ' +
  'updated_by_account_id TEXT NULL' +
  ')';

const ENSURE_DECLARATION_REVIEWED_SQL =
  'ALTER TABLE declarations ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT FALSE';

const ENSURE_DECLARATION_REVIEWED_AT_SQL =
  'ALTER TABLE declarations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL';

const ENSURE_DECLARATION_REVIEWED_BY_SQL =
  'ALTER TABLE declarations ADD COLUMN IF NOT EXISTS reviewed_by TEXT NULL';

const READ_DECLARATION_ID_SQL =
  'SELECT id::text AS id ' +
  'FROM declarations ' +
  'WHERE deleted_at IS NULL AND declaration_no = $1 AND branch_code = $2 ' +
  'ORDER BY declared_at DESC, declaration_no DESC ' +
  'LIMIT 1';

const UPDATE_DECLARATION_SQL =
  'UPDATE declarations SET ' +
  'staff_name_snapshot = $2, ' +
  'team_name_snapshot = $3, ' +
  'agency_text = $4, ' +
  'license_count = $5 ' +
  'WHERE id::text = $1 AND deleted_at IS NULL';

const DELETE_DECLARATION_LICENSE_CODES_SQL =
  'DELETE FROM declaration_license_codes ' +
  'WHERE declaration_id::text = $1';

const INSERT_DECLARATION_LICENSE_CODE_SQL =
  'INSERT INTO declaration_license_codes (declaration_id, code, is_excluded) ' +
  'VALUES ($1, $2, $3)';

const INSERT_DECLARATION_EVENT_SQL =
  'INSERT INTO declaration_events (declaration_id, event_type, payload, actor_username, occurred_at) ' +
  'VALUES ($1, $2, $3::jsonb, $4, $5::timestamptz)';

const UPSERT_IMPORTED_DECLARATION_SQL =
  'INSERT INTO declarations (' +
  'id, declaration_no, declaration_no_raw, branch_code, declared_at, tax_code, company_name, customs_type_code, ' +
  'item_count, license_count, staff_name_snapshot, team_name_snapshot, agency_text, is_export, co_line_count, deleted_at' +
  ') VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NULL) ' +
  'ON CONFLICT (id) DO UPDATE SET ' +
  'declaration_no = EXCLUDED.declaration_no, ' +
  'declaration_no_raw = EXCLUDED.declaration_no_raw, ' +
  'branch_code = EXCLUDED.branch_code, ' +
  'declared_at = EXCLUDED.declared_at, ' +
  'tax_code = EXCLUDED.tax_code, ' +
  'company_name = EXCLUDED.company_name, ' +
  'customs_type_code = EXCLUDED.customs_type_code, ' +
  'item_count = EXCLUDED.item_count, ' +
  'license_count = EXCLUDED.license_count, ' +
  'staff_name_snapshot = EXCLUDED.staff_name_snapshot, ' +
  'team_name_snapshot = EXCLUDED.team_name_snapshot, ' +
  'agency_text = EXCLUDED.agency_text, ' +
  'is_export = EXCLUDED.is_export, ' +
  'co_line_count = EXCLUDED.co_line_count, ' +
  'deleted_at = NULL';

const READ_DECLARATION_EVENTS_SQL =
  'SELECT id::text AS id, event_type, payload, actor_username, occurred_at::text AS occurred_at ' +
  'FROM declaration_events ' +
  'WHERE declaration_id = $1 OR (payload ->> \'key\') = $2 ' +
  'ORDER BY occurred_at DESC, id DESC';

const LIST_DELETED_DECLARATION_EVENTS_SQL =
  'SELECT id::text AS id, event_type, payload, actor_username, occurred_at::text AS occurred_at ' +
  'FROM declaration_events ' +
  "WHERE event_type ILIKE 'delete%' " +
  'AND ($1::timestamptz IS NULL OR occurred_at >= $1::timestamptz) ' +
  'AND ($2::timestamptz IS NULL OR occurred_at <= $2::timestamptz) ' +
  'ORDER BY occurred_at DESC, id DESC';

const CO_CODE_CONFIG_KEY = 'co_tax_code_config_v1';
const CO_DISCREPANCY_CONFIG_KEY = 'co_discrepancy_config_v1';
const CO_DISCREPANCY_STATE_KEY = 'co_discrepancy_state_v1';
const DECLARATION_ALERT_CONFIG_KEY = 'decl_alert_config_v1';
const DECLARATION_ALERT_STATE_KEY = 'decl_alert_state_v1';

const READ_CONFIG_DOCUMENT_SQL =
  'SELECT document ' +
  'FROM config_documents ' +
  'WHERE config_key = $1';

const UPSERT_CONFIG_DOCUMENT_SQL =
  'INSERT INTO config_documents (config_key, document, updated_at, updated_by_account_id) ' +
  'VALUES ($1, $2::jsonb, $3::timestamptz, $4) ' +
  'ON CONFLICT (config_key) DO UPDATE SET ' +
  'document = EXCLUDED.document, ' +
  'updated_at = EXCLUDED.updated_at, ' +
  'updated_by_account_id = EXCLUDED.updated_by_account_id';

export class PostgresDeclarationsStore implements DeclarationsStore {
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly pool: PoolLike) {}

  async patchDeclaration(
    target: DeclarationStoreTarget,
    normalizedPatch: NormalizedDeclarationPatch,
    actor: DeclarationActor,
  ): Promise<Record<string, unknown>> {
    await this.ensureInitialized();
    const result = applyDeclarationPatch(target.current, normalizedPatch);
    const nextRecord = cloneDeclarationRecord(result.nextRecord);
    const declarationId = await this.resolveDeclarationId(target);
    const timestamp = `${nextRecord.updatedAt ?? new Date().toISOString()}`;

    await this.pool.query('BEGIN');

    try {
      await this.pool.query(UPDATE_DECLARATION_SQL, [
        declarationId,
        `${nextRecord.staff_name_snapshot ?? nextRecord.nhan_vien ?? ''}`,
        `${nextRecord.team_name_snapshot ?? nextRecord.team ?? ''}`,
        `${nextRecord.agency_text ?? nextRecord.agency ?? nextRecord.dai_ly ?? ''}`,
        normalizeLicenseCount(nextRecord),
      ]);

      if (shouldSyncLicenseCodes(normalizedPatch)) {
        await this.pool.query(DELETE_DECLARATION_LICENSE_CODES_SQL, [declarationId]);

        const sourceCodes = normalizeStringArray(nextRecord.licenseSourceCodes);
        const excludedCodes = new Set(normalizeStringArray(nextRecord.licenseExcludedCodes));
        for (const code of sourceCodes) {
          await this.pool.query(INSERT_DECLARATION_LICENSE_CODE_SQL, [
            declarationId,
            code,
            excludedCodes.has(code),
          ]);
        }
      }

      await this.pool.query(INSERT_DECLARATION_EVENT_SQL, [
        declarationId,
        'manual_patch',
        JSON.stringify({
          key: target.key,
          changes: result.historyChanges,
        }),
        actor.username,
        timestamp,
      ]);

      await this.pool.query('COMMIT');

      nextRecord.declaration_id = declarationId;
      return nextRecord;
    } catch (error) {
      await this.pool.query('ROLLBACK');
      throw error;
    }
  }

  async commitImportedDeclarations(input: DeclarationImportCommitInput): Promise<void> {
    await this.ensureInitialized();
    const entries = Array.isArray(input.entries) ? input.entries : [];
    if (entries.length === 0) {
      return;
    }

    await this.pool.query('BEGIN');

    try {
      for (const entry of entries) {
        const row = cloneDeclarationRecord(entry.nextRecord);
        const declarationId = resolveImportedDeclarationId(entry.key, row, entry.current);

        await this.pool.query(UPSERT_IMPORTED_DECLARATION_SQL, [
          declarationId,
          normalizeImportedText(row.declaration_no ?? row.so_tk),
          normalizeImportedText(row.declaration_no_raw ?? row.so_tk_full) ||
            normalizeImportedText(row.declaration_no ?? row.so_tk),
          normalizeImportedText(row.branch_code ?? row.nhanh ?? row.branch),
          normalizeImportedDate(row.declared_at ?? row.date),
          normalizeImportedText(row.tax_code ?? row.mst),
          normalizeImportedText(row.company_name ?? row.cong_ty),
          normalizeImportedText(row.customs_type_code ?? row.loai_hinh ?? row.ma_loai_hinh),
          normalizeImportedInteger(row.item_count ?? row.num_items ?? row.muc_hang),
          normalizeLicenseCount(row),
          normalizeImportedText(row.staff_name_snapshot ?? row.nhan_vien),
          normalizeImportedText(row.team_name_snapshot ?? row.team),
          normalizeImportedText(row.agency_text ?? row.agency ?? row.dai_ly),
          normalizeImportedBoolean(row.is_export ?? row.isExport),
          normalizeImportedInteger(row.co_line_count ?? row.co ?? row.coLineCount),
        ]);

        await this.pool.query(DELETE_DECLARATION_LICENSE_CODES_SQL, [declarationId]);

        const sourceCodes = normalizeStringArray(row.licenseSourceCodes);
        const excludedCodes = new Set(normalizeStringArray(row.licenseExcludedCodes));
        for (const code of sourceCodes) {
          await this.pool.query(INSERT_DECLARATION_LICENSE_CODE_SQL, [
            declarationId,
            code,
            excludedCodes.has(code),
          ]);
        }
      }

      await this.pool.query('COMMIT');
    } catch (error) {
      await this.pool.query('ROLLBACK');
      throw error;
    }
  }

  async listDeclarationEvents(target: DeclarationStoreTarget): Promise<DeclarationEventRecord[]> {
    await this.ensureInitialized();
    const declarationId = target.declarationId || target.key;
    const result = await this.pool.query<DeclarationEventRow>(READ_DECLARATION_EVENTS_SQL, [
      declarationId,
      target.key,
    ]);

    return (Array.isArray(result.rows) ? result.rows : [])
      .map((row) => normalizeEventRow(row))
      .filter((entry): entry is DeclarationEventRecord => Boolean(entry))
      .sort(compareDeclarationEventsDescending);
  }

  async listDeletedDeclarations(
    filters: DeletedDeclarationFilters = {},
  ): Promise<DeletedDeclarationRecord[]> {
    await this.ensureInitialized();
    const normalizedType = normalizeDeletedDeclarationFilterType(filters.type);
    const rangeFrom = normalizeDeletedDeclarationTimestampFilter(filters.from, false);
    const rangeTo = normalizeDeletedDeclarationTimestampFilter(filters.to, true);
    const result = await this.pool.query<DeclarationEventRow>(LIST_DELETED_DECLARATION_EVENTS_SQL, [
      rangeFrom,
      rangeTo,
    ]);

    return (Array.isArray(result.rows) ? result.rows : [])
      .map((row) => normalizeDeletedDeclarationRow(row))
      .filter((entry): entry is DeletedDeclarationRecord => Boolean(entry))
      .filter((entry) => !normalizedType || entry.type === normalizedType);
  }

  async readEcusSyncConfig(): Promise<EcusSyncConfigDocument | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<ConfigDocumentRow>(READ_CONFIG_DOCUMENT_SQL, [
      ECUS_SYNC_CONFIG_STORAGE_KEY,
    ]);
    return result.rows[0]?.document ? normalizeEcusSyncConfig(result.rows[0].document) : null;
  }

  async writeEcusSyncConfig(
    config: EcusSyncConfigDocument,
    updatedBy: string | null,
  ): Promise<EcusSyncConfigDocument> {
    const normalized = normalizeEcusSyncConfig(config);
    await this.ensureInitialized();
    await this.pool.query(UPSERT_CONFIG_DOCUMENT_SQL, [
      ECUS_SYNC_CONFIG_STORAGE_KEY,
      JSON.stringify(normalized),
      normalized.updatedAt ?? new Date().toISOString(),
      updatedBy,
    ]);
    return normalizeEcusSyncConfig(normalized);
  }

  async readCoCodeConfig(): Promise<CoCodeConfigDocument | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<ConfigDocumentRow>(READ_CONFIG_DOCUMENT_SQL, [CO_CODE_CONFIG_KEY]);
    return result.rows[0]?.document ? normalizeCoCodeConfig(result.rows[0].document) : null;
  }

  async writeCoCodeConfig(
    config: CoCodeConfigDocument,
    updatedBy: string | null,
  ): Promise<CoCodeConfigDocument> {
    const normalized = normalizeCoCodeConfig(config);
    await this.ensureInitialized();
    await this.pool.query(UPSERT_CONFIG_DOCUMENT_SQL, [
      CO_CODE_CONFIG_KEY,
      JSON.stringify(normalized),
      normalized.updatedAt ?? new Date().toISOString(),
      updatedBy,
    ]);
    return normalizeCoCodeConfig(normalized);
  }

  async readCoDiscrepancyConfig(): Promise<CoDiscrepancyConfigDocument | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<ConfigDocumentRow>(READ_CONFIG_DOCUMENT_SQL, [
      CO_DISCREPANCY_CONFIG_KEY,
    ]);
    return result.rows[0]?.document ? normalizeCoDiscrepancyConfig(result.rows[0].document) : null;
  }

  async writeCoDiscrepancyConfig(
    config: CoDiscrepancyConfigDocument,
    updatedBy: string | null,
  ): Promise<CoDiscrepancyConfigDocument> {
    const normalized = normalizeCoDiscrepancyConfig(config);
    await this.ensureInitialized();
    await this.pool.query(UPSERT_CONFIG_DOCUMENT_SQL, [
      CO_DISCREPANCY_CONFIG_KEY,
      JSON.stringify(normalized),
      normalized.updatedAt ?? new Date().toISOString(),
      updatedBy,
    ]);
    return normalizeCoDiscrepancyConfig(normalized);
  }

  async readCoDiscrepancyState(): Promise<CoDiscrepancyStateDocument | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<ConfigDocumentRow>(READ_CONFIG_DOCUMENT_SQL, [
      CO_DISCREPANCY_STATE_KEY,
    ]);
    return result.rows[0]?.document ? normalizeCoDiscrepancyState(result.rows[0].document) : null;
  }

  async writeCoDiscrepancyState(
    state: CoDiscrepancyStateDocument,
    updatedBy: string | null,
  ): Promise<CoDiscrepancyStateDocument> {
    const normalized = normalizeCoDiscrepancyState(state);
    await this.ensureInitialized();
    await this.pool.query(UPSERT_CONFIG_DOCUMENT_SQL, [
      CO_DISCREPANCY_STATE_KEY,
      JSON.stringify(normalized),
      normalized.lastRunAt ?? new Date().toISOString(),
      updatedBy,
    ]);
    return normalizeCoDiscrepancyState(normalized);
  }

  async readDeclarationAlertConfig(): Promise<DeclarationAlertConfigDocument | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<ConfigDocumentRow>(READ_CONFIG_DOCUMENT_SQL, [
      DECLARATION_ALERT_CONFIG_KEY,
    ]);
    return result.rows[0]?.document
      ? normalizeDeclarationAlertConfig(result.rows[0].document)
      : null;
  }

  async writeDeclarationAlertConfig(
    config: DeclarationAlertConfigDocument,
    updatedBy: string | null,
  ): Promise<DeclarationAlertConfigDocument> {
    const normalized = normalizeDeclarationAlertConfig(config);
    await this.ensureInitialized();
    await this.pool.query(UPSERT_CONFIG_DOCUMENT_SQL, [
      DECLARATION_ALERT_CONFIG_KEY,
      JSON.stringify(normalized),
      new Date().toISOString(),
      updatedBy,
    ]);
    return normalizeDeclarationAlertConfig(normalized);
  }

  async readDeclarationAlertState(): Promise<DeclarationAlertStateDocument | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<ConfigDocumentRow>(READ_CONFIG_DOCUMENT_SQL, [
      DECLARATION_ALERT_STATE_KEY,
    ]);
    return result.rows[0]?.document
      ? normalizeDeclarationAlertState(result.rows[0].document)
      : null;
  }

  async writeDeclarationAlertState(
    state: DeclarationAlertStateDocument,
    updatedBy: string | null,
  ): Promise<DeclarationAlertStateDocument> {
    const normalized = normalizeDeclarationAlertState(state);
    await this.ensureInitialized();
    await this.pool.query(UPSERT_CONFIG_DOCUMENT_SQL, [
      DECLARATION_ALERT_STATE_KEY,
      JSON.stringify(normalized),
      normalized.lastEvaluatedAt ?? new Date().toISOString(),
      updatedBy,
    ]);
    return normalizeDeclarationAlertState(normalized);
  }

  async markDeclarationsReviewed(keys: readonly string[], actor: string): Promise<number> {
    await this.ensureInitialized();
    const targets = normalizeDeclarationReviewTargets(keys);
    if (targets.length === 0) {
      return 0;
    }

    let updated = 0;
    const reviewedAt = new Date().toISOString();
    await this.pool.query('BEGIN');

    try {
      for (const target of targets) {
        const result = await this.pool.query(
          'UPDATE declarations ' +
            'SET reviewed = TRUE, reviewed_at = $3::timestamptz, reviewed_by = $4 ' +
            'WHERE deleted_at IS NULL AND declaration_no = $1 AND branch_code = $2 AND reviewed = FALSE',
          [target.soTk, target.nhanh, reviewedAt, actor || 'system'],
        );
        updated += result.rowCount ?? 0;
      }

      await this.pool.query('COMMIT');
      return updated;
    } catch (error) {
      await this.pool.query('ROLLBACK');
      throw error;
    }
  }

  async unmarkDeclarationsReviewed(keys: readonly string[], _actor: string): Promise<number> {
    await this.ensureInitialized();
    const targets = normalizeDeclarationReviewTargets(keys);
    if (targets.length === 0) {
      return 0;
    }

    let updated = 0;
    await this.pool.query('BEGIN');

    try {
      for (const target of targets) {
        const result = await this.pool.query(
          'UPDATE declarations ' +
            'SET reviewed = FALSE, reviewed_at = NULL, reviewed_by = NULL ' +
            'WHERE deleted_at IS NULL AND declaration_no = $1 AND branch_code = $2 AND reviewed = TRUE',
          [target.soTk, target.nhanh],
        );
        updated += result.rowCount ?? 0;
      }

      await this.pool.query('COMMIT');
      return updated;
    } catch (error) {
      await this.pool.query('ROLLBACK');
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = initializeDeclarationsStorage(this.pool).catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }

    await this.initializationPromise;
  }

  private async resolveDeclarationId(target: DeclarationStoreTarget): Promise<string> {
    const existing = `${target.declarationId ?? ''}`.trim();
    if (existing) {
      return existing;
    }

    const lookup = await this.pool.query<DeclarationIdentityRow>(READ_DECLARATION_ID_SQL, [
      target.soTk,
      target.nhanh,
    ]);
    const declarationId = `${lookup.rows[0]?.id ?? ''}`.trim();
    if (!declarationId) {
      throw new Error(`Cannot resolve declaration id for ${target.key}.`);
    }

    return declarationId;
  }
}

async function initializeDeclarationsStorage(pool: PoolLike): Promise<void> {
  await pool.query(CREATE_CONFIG_DOCUMENTS_TABLE_SQL);
  await pool.query(CREATE_EVENTS_TABLE_SQL);
  await pool.query(CREATE_EVENTS_INDEX_SQL);
  await pool.query(ENSURE_DECLARATION_REVIEWED_SQL);
  await pool.query(ENSURE_DECLARATION_REVIEWED_AT_SQL);
  await pool.query(ENSURE_DECLARATION_REVIEWED_BY_SQL);
}

function shouldSyncLicenseCodes(normalizedPatch: NormalizedDeclarationPatch): boolean {
  return (
    normalizedPatch.requestedFields.includes('licenseCodes') ||
    normalizedPatch.requestedFields.includes('licenseSourceCodes') ||
    normalizedPatch.requestedFields.includes('licenseExcludedCodes')
  );
}

function normalizeLicenseCount(record: Record<string, unknown>): number {
  const candidates = [
    record.license_count,
    record.licenseManualCount,
    record.licenses,
    record.so_luong_gp,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  return 0;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const entries: string[] = [];
  for (const item of value) {
    const normalized = `${item ?? ''}`.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    entries.push(normalized);
  }

  return entries;
}

function resolveImportedDeclarationId(
  key: string,
  row: Record<string, unknown>,
  current: Record<string, unknown> | null,
): string {
  return (
    normalizeImportedText(row.declaration_id ?? row.id) ||
    normalizeImportedText(current?.declaration_id ?? current?.id) ||
    `decl-${slugify(key, 'declaration')}`
  );
}

function normalizeImportedText(value: unknown): string {
  return normalizeStr(value);
}

function normalizeImportedInteger(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? Math.max(0, Math.round(normalized)) : 0;
}

function normalizeImportedBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = normalizeImportedText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes';
}

function normalizeImportedDate(value: unknown): string | null {
  const normalized = normalizeImportedText(value);
  return normalized || null;
}

function normalizeEventRow(row: DeclarationEventRow): DeclarationEventRecord | null {
  const payload = parseEventPayload(row.payload);
  const eventType = `${row.event_type ?? ''}`.trim().toLowerCase();
  const actor = `${row.actor_username ?? ''}`.trim() || 'system';
  const timestamp = `${row.occurred_at ?? ''}`.trim();

  if (eventType.startsWith('delete')) {
    const snapshot =
      payload.snapshot && typeof payload.snapshot === 'object' && !Array.isArray(payload.snapshot)
        ? (payload.snapshot as Record<string, unknown>)
        : {};

    return buildDeclarationDeletionEvent({
      id: row.id,
      timestamp,
      actor,
      deletionType: payload.deletionType ?? payload.type ?? eventType.replace(/^delete\.?/, ''),
      snapshot,
    });
  }

  return buildDeclarationUpdateEvent({
    id: row.id,
    timestamp,
    actor,
    changes: payload.changes,
  });
}

function normalizeDeletedDeclarationRow(row: DeclarationEventRow): DeletedDeclarationRecord | null {
  const payload = parseEventPayload(row.payload);
  const eventType = `${row.event_type ?? ''}`.trim().toLowerCase();
  if (!eventType.startsWith('delete')) {
    return null;
  }

  const snapshot =
    payload.snapshot && typeof payload.snapshot === 'object' && !Array.isArray(payload.snapshot)
      ? (payload.snapshot as Record<string, unknown>)
      : payload;
  const soTk = normalizeStr(snapshot.so_tk);
  if (!soTk) {
    return null;
  }

  const company = normalizeStr(snapshot.company ?? snapshot.ten_dn);

  return {
    so_tk: soTk,
    nhanh: normalizeStr(snapshot.nhanh),
    mst: normalizeStr(snapshot.mst),
    company,
    ten_dn: company,
    type: normalizeDeletedDeclarationStoredType(
      payload.deletionType ?? payload.type ?? eventType.replace(/^delete\.?/, ''),
    ),
    deleted_at: `${row.occurred_at ?? ''}`.trim() || new Date().toISOString(),
    deleted_by: `${row.actor_username ?? ''}`.trim() || 'system',
  };
}

function parseEventPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeDeletedDeclarationFilterType(value: unknown): 'soft' | 'hard' | null {
  const normalized = normalizeStr(value).toLowerCase();
  if (normalized === 'soft' || normalized === 'hard') {
    return normalized;
  }
  return null;
}

function normalizeDeletedDeclarationStoredType(value: unknown): 'soft' | 'hard' {
  return normalizeStr(value).toLowerCase() === 'hard' ? 'hard' : 'soft';
}

function normalizeDeletedDeclarationTimestampFilter(value: unknown, endOfDay: boolean): string | null {
  const normalized = normalizeStr(value).slice(0, 10);
  if (!normalized) {
    return null;
  }

  return `${normalized}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`;
}

function normalizeDeclarationReviewTargets(
  keys: readonly string[],
): Array<{
  soTk: string;
  nhanh: string;
}> {
  const targets: Array<{ soTk: string; nhanh: string }> = [];
  const seen = new Set<string>();

  for (const value of Array.isArray(keys) ? keys : []) {
    const normalized = `${value ?? ''}`.trim();
    const separatorIndex = normalized.indexOf('_');
    if (!normalized || separatorIndex <= 0) {
      continue;
    }

    const soTk = normalizeStr(normalized.slice(0, separatorIndex));
    const nhanh = normalizeStr(normalized.slice(separatorIndex + 1));
    const identity = `${soTk}_${nhanh}`;
    if (!soTk || !nhanh || seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    targets.push({ soTk, nhanh });
  }

  return targets;
}
