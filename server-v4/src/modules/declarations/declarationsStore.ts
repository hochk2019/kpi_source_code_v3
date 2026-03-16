import { randomUUID } from 'node:crypto';

import { normalizeStr } from '../../legacy/legacy-normalizers.js';
import type { AuthPermissionMap } from '../auth/authTypes.js';
import type {
  CoCodeConfigDocument,
  CoDiscrepancyConfigDocument,
  CoDiscrepancyStateDocument,
} from './declarationCoMonitoring.js';
import type {
  DeclarationAlertConfigDocument,
  DeclarationAlertStateDocument,
} from './declarationAlerts.js';
import type { EcusSyncConfigDocument } from './ecusSyncConfig.js';

export type DeclarationActor = {
  username: string;
  role: string;
  name: string;
  permissions: AuthPermissionMap;
  memberId: string | null;
  memberName: string | null;
  teamId: string | null;
  teamName: string | null;
};

export type DeclarationEditableField =
  | 'nhan_vien'
  | 'team'
  | 'agency'
  | 'licenses'
  | 'licenseCodes'
  | 'licenseSourceCodes'
  | 'licenseExcludedCodes';

export type DeclarationHistoryChange = {
  field: string;
  before: string;
  after: string;
};

export type DeclarationUpdateEventRecord = {
  id: string;
  kind: 'update';
  timestamp: string;
  actor: string;
  changes: DeclarationHistoryChange[];
};

export type DeclarationDeletionEventRecord = {
  id: string;
  kind: 'deletion';
  timestamp: string;
  actor: string;
  deletionType: 'soft' | 'hard' | null;
  snapshot: {
    so_tk: string;
    nhanh: string;
    mst: string;
    company: string;
  };
};

export type DeclarationEventRecord = DeclarationUpdateEventRecord | DeclarationDeletionEventRecord;

export type DeletedDeclarationType = 'soft' | 'hard' | null;

export type DeletedDeclarationRecord = {
  so_tk: string;
  nhanh: string;
  mst: string;
  company: string;
  ten_dn: string;
  type: DeletedDeclarationType;
  deleted_at: string;
  deleted_by: string;
};

export type DeletedDeclarationFilters = {
  from?: string | null;
  to?: string | null;
  type?: string | null;
};

export type NormalizedDeclarationPatch = {
  patch: Record<string, unknown>;
  requestedFields: DeclarationEditableField[];
};

export type DeclarationStoreTarget = {
  id: string;
  key: string;
  declarationId: string | null;
  soTk: string;
  nhanh: string;
  current: Record<string, unknown>;
};

export type DeclarationImportRange = {
  from: string;
  to: string;
};

export type DeclarationImportCommitEntry = {
  kind: 'insert' | 'update';
  key: string;
  current: Record<string, unknown> | null;
  nextRecord: Record<string, unknown>;
  changedFields: string[];
};

export type DeclarationImportCommitInput = {
  entries: DeclarationImportCommitEntry[];
  actor: string;
  reason: string;
  runAt: string;
  range: DeclarationImportRange;
};

export type ApplyDeclarationPatchResult = {
  changed: boolean;
  nextRecord: Record<string, unknown>;
  historyChanges: DeclarationHistoryChange[];
};

export interface DeclarationsStore {
  patchDeclaration(
    target: DeclarationStoreTarget,
    normalizedPatch: NormalizedDeclarationPatch,
    actor: DeclarationActor,
  ): Promise<Record<string, unknown>>;
  commitImportedDeclarations(input: DeclarationImportCommitInput): Promise<void>;
  listDeclarationEvents(target: DeclarationStoreTarget): Promise<DeclarationEventRecord[]>;
  listDeletedDeclarations(filters?: DeletedDeclarationFilters): Promise<DeletedDeclarationRecord[]>;
  readEcusSyncConfig(): Promise<EcusSyncConfigDocument | null>;
  writeEcusSyncConfig(
    config: EcusSyncConfigDocument,
    updatedBy: string | null,
  ): Promise<EcusSyncConfigDocument>;
  readCoCodeConfig(): Promise<CoCodeConfigDocument | null>;
  writeCoCodeConfig(config: CoCodeConfigDocument, updatedBy: string | null): Promise<CoCodeConfigDocument>;
  readCoDiscrepancyConfig(): Promise<CoDiscrepancyConfigDocument | null>;
  writeCoDiscrepancyConfig(
    config: CoDiscrepancyConfigDocument,
    updatedBy: string | null,
  ): Promise<CoDiscrepancyConfigDocument>;
  readCoDiscrepancyState(): Promise<CoDiscrepancyStateDocument | null>;
  writeCoDiscrepancyState(
    state: CoDiscrepancyStateDocument,
    updatedBy: string | null,
  ): Promise<CoDiscrepancyStateDocument>;
  readDeclarationAlertConfig(): Promise<DeclarationAlertConfigDocument | null>;
  writeDeclarationAlertConfig(
    config: DeclarationAlertConfigDocument,
    updatedBy: string | null,
  ): Promise<DeclarationAlertConfigDocument>;
  readDeclarationAlertState(): Promise<DeclarationAlertStateDocument | null>;
  writeDeclarationAlertState(
    state: DeclarationAlertStateDocument,
    updatedBy: string | null,
  ): Promise<DeclarationAlertStateDocument>;
  markDeclarationsReviewed(keys: readonly string[], actor: string): Promise<number>;
  unmarkDeclarationsReviewed(keys: readonly string[], actor: string): Promise<number>;
}

const EMPTY_PATCH: NormalizedDeclarationPatch = Object.freeze({
  patch: {},
  requestedFields: [],
});

const LICENSE_VISIBLE_FIELD = 'licenseCodes';
const LICENSE_SOURCE_FIELD = 'licenseSourceCodes';
const LICENSE_EXCLUDED_FIELD = 'licenseExcludedCodes';

export function normalizeDeclarationPatch(
  input: Record<string, unknown> | null | undefined,
): NormalizedDeclarationPatch {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return EMPTY_PATCH;
  }

  const patch: Record<string, unknown> = {};
  const requestedFields: DeclarationEditableField[] = [];

  const markField = (field: DeclarationEditableField) => {
    if (!requestedFields.includes(field)) {
      requestedFields.push(field);
    }
  };

  const assignTextFields = (field: DeclarationEditableField, nextPatch: Record<string, unknown>) => {
    markField(field);
    Object.assign(patch, nextPatch);
  };

  const assignLicenseCount = (value: unknown) => {
    markField('licenses');

    if (value === '' || value === null || value === undefined) {
      patch.licenses = '';
      patch.so_luong_gp = '';
      patch.licenseManualCount = null;
      patch.license_count = 0;
      return;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const normalized = Math.max(0, Math.round(parsed));
    patch.licenses = normalized;
    patch.so_luong_gp = normalized;
    patch.licenseManualCount = normalized;
    patch.license_count = normalized;
  };

  for (const [field, value] of Object.entries(input)) {
    switch (field) {
      case 'nhan_vien':
      case 'staffName':
      case 'staff_name_snapshot': {
        const normalized = normalizeText(value);
        assignTextFields('nhan_vien', {
          nhan_vien: normalized,
          staff_name_snapshot: normalized,
        });
        break;
      }
      case 'team':
      case 'teamName':
      case 'team_name_snapshot': {
        const normalized = normalizeText(value);
        assignTextFields('team', {
          team: normalized,
          team_name_snapshot: normalized,
        });
        break;
      }
      case 'agency':
      case 'dai_ly':
      case 'agencyText':
      case 'agency_text': {
        const normalized = normalizeText(value);
        assignTextFields('agency', {
          agency: normalized,
          dai_ly: normalized,
          agency_text: normalized,
        });
        break;
      }
      case 'licenses':
      case 'so_luong_gp':
      case 'licenseManualCount':
      case 'license_count': {
        assignLicenseCount(value);
        break;
      }
      case 'licenseCodes':
      case 'license_codes': {
        markField(LICENSE_VISIBLE_FIELD);
        patch.licenseCodes = normalizeDeclarationArray(value);
        break;
      }
      case 'licenseSourceCodes':
      case 'license_source_codes': {
        markField(LICENSE_SOURCE_FIELD);
        patch.licenseSourceCodes = normalizeDeclarationArray(value);
        break;
      }
      case 'licenseExcludedCodes':
      case 'license_excluded_codes': {
        markField(LICENSE_EXCLUDED_FIELD);
        patch.licenseExcludedCodes = normalizeDeclarationArray(value);
        break;
      }
      default:
        break;
    }
  }

  return {
    patch,
    requestedFields,
  };
}

export function applyDeclarationPatch(
  current: Record<string, unknown> | null | undefined,
  normalizedPatch: NormalizedDeclarationPatch,
): ApplyDeclarationPatchResult {
  const nextRecord = cloneDeclarationRecord(current);
  const sourceRecord = cloneDeclarationRecord(current);
  const patch = normalizedPatch.patch ?? {};
  let changed = false;

  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }

    if (value === null) {
      if (Object.prototype.hasOwnProperty.call(nextRecord, field)) {
        delete nextRecord[field];
        changed = true;
      }
      continue;
    }

    const nextValue = Array.isArray(value) ? value.slice() : value;
    if (!isEqualDeclarationValue(nextRecord[field], nextValue)) {
      nextRecord[field] = nextValue;
      changed = true;
    }
  }

  if (
    normalizedPatch.requestedFields.includes(LICENSE_SOURCE_FIELD) ||
    normalizedPatch.requestedFields.includes(LICENSE_EXCLUDED_FIELD)
  ) {
    const derivedVisibleCodes = deriveVisibleLicenseCodes(
      nextRecord.licenseSourceCodes,
      nextRecord.licenseExcludedCodes,
    );

    if (
      !normalizedPatch.requestedFields.includes(LICENSE_VISIBLE_FIELD) &&
      !isEqualDeclarationValue(nextRecord.licenseCodes, derivedVisibleCodes)
    ) {
      nextRecord.licenseCodes = derivedVisibleCodes;
      changed = true;
    }
  }

  if (changed) {
    nextRecord.updatedAt = new Date().toISOString();
  }

  return {
    changed,
    nextRecord,
    historyChanges: buildDeclarationHistoryChanges(
      sourceRecord,
      nextRecord,
      normalizedPatch.requestedFields,
    ),
  };
}

export function buildDeclarationUpdateEvent(input: {
  id?: unknown;
  timestamp?: unknown;
  actor?: unknown;
  changes?: unknown;
}): DeclarationUpdateEventRecord | null {
  const changes = normalizeDeclarationHistoryChanges(input.changes);
  if (changes.length === 0) {
    return null;
  }

  return {
    id: normalizeText(input.id) || randomUUID(),
    kind: 'update',
    timestamp: normalizeTimestamp(input.timestamp),
    actor: normalizeText(input.actor) || 'system',
    changes,
  };
}

export function buildDeclarationDeletionEvent(input: {
  id?: unknown;
  timestamp?: unknown;
  actor?: unknown;
  deletionType?: unknown;
  snapshot?: unknown;
}): DeclarationDeletionEventRecord {
  const snapshot =
    input.snapshot && typeof input.snapshot === 'object' && !Array.isArray(input.snapshot)
      ? (input.snapshot as Record<string, unknown>)
      : {};

  return {
    id: normalizeText(input.id) || randomUUID(),
    kind: 'deletion',
    timestamp: normalizeTimestamp(input.timestamp),
    actor: normalizeText(input.actor) || 'system',
    deletionType: normalizeDeletionType(input.deletionType),
    snapshot: {
      so_tk: normalizeText(snapshot.so_tk),
      nhanh: normalizeText(snapshot.nhanh),
      mst: normalizeText(snapshot.mst),
      company: normalizeText(snapshot.company),
    },
  };
}

export function normalizeDeclarationHistoryChanges(value: unknown): DeclarationHistoryChange[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const changes: DeclarationHistoryChange[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }

    const entry = item as Record<string, unknown>;
    const fieldKey = normalizeText(entry.field ?? entry.key ?? entry.name);
    if (!fieldKey) {
      continue;
    }

    const before = normalizeDeclarationHistoryValue(entry.before ?? entry.old ?? entry.previous);
    const after = normalizeDeclarationHistoryValue(entry.after ?? entry.new ?? entry.next);
    if (before === after) {
      continue;
    }

    changes.push({
      field: resolveHistoryField(fieldKey),
      before,
      after,
    });
  }

  return changes;
}

export function compareDeclarationEventsDescending(
  left: DeclarationEventRecord,
  right: DeclarationEventRecord,
): number {
  const rightTime = Date.parse(right.timestamp);
  const leftTime = Date.parse(left.timestamp);
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return right.id.localeCompare(left.id);
}

export function createDeclarationRowKey(soTk: unknown, nhanh: unknown): string {
  return `${normalizeText(soTk)}_${normalizeText(nhanh)}`;
}

export function declarationTargetMatchesRow(row: unknown, target: DeclarationStoreTarget): boolean {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return false;
  }

  const record = row as Record<string, unknown>;
  const rowId = normalizeText(record.id);
  const rowKey =
    normalizeText(record.key) ||
    createDeclarationRowKey(record.so_tk, record.nhanh ?? record.branch ?? record.branch_code);
  const rowDeclarationId = normalizeText(record.declaration_id ?? record.declarationId);

  if (target.declarationId && rowDeclarationId && target.declarationId === rowDeclarationId) {
    return true;
  }

  if (target.id && rowId && target.id === rowId) {
    return true;
  }

  if (target.key && rowKey && target.key === rowKey) {
    return true;
  }

  return createDeclarationRowKey(record.so_tk, record.nhanh ?? record.branch) === target.key;
}

export function cloneDeclarationRecord(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return { ...value };
  }
}

function buildDeclarationHistoryChanges(
  current: Record<string, unknown>,
  nextRecord: Record<string, unknown>,
  fields: readonly DeclarationEditableField[],
): DeclarationHistoryChange[] {
  const changes: DeclarationHistoryChange[] = [];

  for (const field of fields) {
    const before = normalizeDeclarationHistoryValue(extractDeclarationHistoryValue(current, field));
    const after = normalizeDeclarationHistoryValue(extractDeclarationHistoryValue(nextRecord, field));
    if (before === after) {
      continue;
    }

    changes.push({
      field: resolveHistoryField(field),
      before,
      after,
    });
  }

  return changes;
}

function extractDeclarationHistoryValue(
  row: Record<string, unknown>,
  field: DeclarationEditableField,
): unknown {
  switch (field) {
    case 'agency':
      return row.agency ?? row.dai_ly ?? row.agency_text ?? '';
    case 'licenses':
      return pickDeclarationLicenseCount(row);
    case 'licenseCodes':
      return row.licenseCodes ?? row.license_codes ?? [];
    case 'licenseSourceCodes':
      return row.licenseSourceCodes ?? row.license_source_codes ?? [];
    case 'licenseExcludedCodes':
      return row.licenseExcludedCodes ?? row.license_excluded_codes ?? [];
    default:
      return row[field];
  }
}

function pickDeclarationLicenseCount(row: Record<string, unknown>): unknown {
  const candidates = [
    row.licenseManualCount,
    row.license_count,
    row.licenses,
    row.so_luong_gp,
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '') {
      continue;
    }

    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return candidate;
  }

  return '';
}

function deriveVisibleLicenseCodes(sourceCodes: unknown, excludedCodes: unknown): string[] {
  const excluded = new Set(normalizeDeclarationArray(excludedCodes));
  return normalizeDeclarationArray(sourceCodes).filter((code) => !excluded.has(code));
}

function normalizeDeclarationArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const entries: string[] = [];
  for (const item of value) {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    entries.push(normalized);
  }

  return entries;
}

function normalizeDeclarationHistoryValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return normalizeDeclarationArray(value).join(', ');
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return normalizeText(value);
}

function resolveHistoryField(field: string): string {
  if (field === 'dai_ly') {
    return 'agency';
  }

  if (field === 'so_luong_gp' || field === 'licenseManualCount' || field === 'license_count') {
    return 'licenses';
  }

  return field;
}

function isEqualDeclarationValue(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!isEqualDeclarationValue(left[index], right[index])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function normalizeDeletionType(value: unknown): 'soft' | 'hard' | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'soft' || normalized === 'hard') {
    return normalized;
  }

  return null;
}

function normalizeTimestamp(value: unknown): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return new Date().toISOString();
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeText(value: unknown): string {
  return normalizeStr(value);
}
