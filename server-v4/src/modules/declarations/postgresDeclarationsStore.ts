import type { Pool } from 'pg';

import {
  applyDeclarationPatch,
  buildDeclarationDeletionEvent,
  buildDeclarationUpdateEvent,
  cloneDeclarationRecord,
  compareDeclarationEventsDescending,
  type DeclarationActor,
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

const READ_DECLARATION_EVENTS_SQL =
  'SELECT id::text AS id, event_type, payload, actor_username, occurred_at::text AS occurred_at ' +
  'FROM declaration_events ' +
  'WHERE declaration_id = $1 OR (payload ->> \'key\') = $2 ' +
  'ORDER BY occurred_at DESC, id DESC';

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
  await pool.query(CREATE_EVENTS_TABLE_SQL);
  await pool.query(CREATE_EVENTS_INDEX_SQL);
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
