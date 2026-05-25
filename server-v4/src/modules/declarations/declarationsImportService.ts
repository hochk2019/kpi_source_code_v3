import { createHash } from 'node:crypto';
import {
  normalizeDeclarationNumber,
  normalizeMst,
  normalizeStr,
  slugify,
  toIsoDate,
} from '../../legacy/legacy-normalizers.js';
import type { DeclarationRecord, DeclarationsRepository } from './DeclarationsRepository.js';
import { DeclarationsHttpError } from './declarationsService.js';
import type {
  DeclarationActor,
  DeclarationImportCommitEntry,
  DeclarationImportRange,
  DeclarationsStore,
} from './declarationsStore.js';
import type { EcusImportRunner } from './ecusCoDiscrepancyRunner.js';

const FIELD_ALIASES = Object.freeze({
  so_tk: ['declaration_no', 'declarationNumber', 'so_to_khai'],
  nhanh: ['branch', 'branch_code', 'chi_nhanh'],
  date: ['declared_at', 'declaredAt', 'ngay', 'ngay_dk', 'ngay_dang_ky', 'registered_at'],
  mst: ['tax_code', 'taxCode', 'ma_so_thue'],
  cong_ty: ['company_name', 'companyName', 'ten_dn'],
  loai_hinh: ['customs_type_code', 'customsTypeCode', 'ma_loai_hinh'],
  num_items: ['item_count', 'itemCount', 'items', 'muc_hang'],
  licenses: ['license_count', 'licenseCount', 'so_luong_gp', 'licenseManualCount'],
  license_codes: ['licenseCodes', 'licenseSourceCodes', 'license_source_codes'],
  license_excluded_codes: ['licenseExcludedCodes', 'license_excluded_codes'],
  agency: ['dai_ly', 'agency_text', 'agencyText'],
  nhan_vien: ['staff_name_snapshot', 'staffName'],
  team: ['team_name_snapshot', 'teamName'],
  co_line_count: ['coLineCount', 'co', 'co_lines'],
  is_export: ['isExport'],
});

type ImportPayload = {
  rawRows?: unknown[];
  rangeInput?: {
    from?: string;
    to?: string;
  };
  includeTaxCodes?: string[];
  excludeTaxCodes?: string[];
};

export type DeclarationsImportPreviewRow = Record<string, unknown> & {
  status: 'new' | 'existing';
  locked: boolean;
  changedFields: string[];
};

export type DeclarationsImportPreviewResponse = {
  rows: DeclarationsImportPreviewRow[];
  limited: boolean;
  fetched: number;
  range: DeclarationImportRange;
  previewHash: string;
};

export type DeclarationsImportCommitRequest = ImportPayload & {
  fetchedTotal?: number;
  actor?: string;
  reason?: string;
  previewHash?: string;
};

export type DeclarationsImportCommitResponse = {
  fetched: number;
  imported: number;
  updated: number;
  skipped: number;
  reviewLocked: number;
  runAt: string;
  actor: string;
  reason: string;
  range: DeclarationImportRange;
};

type ImportPlan = {
  previewRows: DeclarationsImportPreviewRow[];
  commitEntries: DeclarationImportCommitEntry[];
  fetched: number;
  imported: number;
  updated: number;
  skipped: number;
  reviewLocked: number;
  range: DeclarationImportRange;
};

type ResolvedImportSource = {
  rawRows: unknown[];
  fetched: number;
  limited: boolean;
  range: DeclarationImportRange;
};

type MergeResult = {
  row: Record<string, unknown>;
  changed: boolean;
  locked?: boolean;
  changedFields: string[];
};

export class DeclarationsImportService {
  constructor(
    private readonly repository: DeclarationsRepository,
    private readonly store: DeclarationsStore,
    private readonly ecusImportRunner: EcusImportRunner | null = null,
  ) {}

  async previewEcusImport(
    actor: DeclarationActor,
    payload: ImportPayload,
    options: {
      limit?: number;
    } = {},
  ): Promise<DeclarationsImportPreviewResponse> {
    this.requireSyncManage(actor);
    const source = await this.resolveImportSource(payload, { limit: options.limit });
    const plan = await this.buildImportPlan({
      ...payload,
      rawRows: source.rawRows,
      rangeInput: source.range,
    });
    const limit =
      Number.isFinite(options.limit) && options.limit && options.limit > 0
        ? Math.floor(options.limit)
        : null;

    return {
      rows: limit ? plan.previewRows.slice(0, limit) : plan.previewRows,
      limited: source.limited || Boolean(limit && plan.previewRows.length > limit),
      fetched: source.fetched,
      range: source.range,
      previewHash: computeRawRowsHash(source.rawRows),
    };
  }

  async commitEcusImport(
    actor: DeclarationActor,
    payload: DeclarationsImportCommitRequest,
  ): Promise<DeclarationsImportCommitResponse> {
    this.requireSyncManage(actor);
    const source = await this.resolveImportSource(payload);

    if (payload.previewHash) {
      const currentHash = computeRawRowsHash(source.rawRows);
      if (currentHash !== payload.previewHash) {
        throw new DeclarationsHttpError(
          409,
          'preview_stale',
          'Dữ liệu ECUS đã thay đổi kể từ khi xem trước. Vui lòng xem lại trước khi đồng bộ.',
        );
      }
    }
    const plan = await this.buildImportPlan({
      ...payload,
      rawRows: source.rawRows,
      rangeInput: source.range,
    });
    const runAt = new Date().toISOString();
    const commitActor = actor.username || 'ecus-bridge-service';
    const reason = normalizeStr(payload.reason) || 'manual';
    const fetchedTotal = Number.isFinite(Number(payload.fetchedTotal))
      ? Number(payload.fetchedTotal)
      : source.fetched;

    await this.store.commitImportedDeclarations({
      entries: plan.commitEntries,
      actor: commitActor,
      reason,
      runAt,
      range: plan.range,
    });

    return {
      fetched: fetchedTotal,
      imported: plan.imported,
      updated: plan.updated,
      skipped: plan.skipped,
      reviewLocked: plan.reviewLocked,
      runAt,
      actor: commitActor,
      reason,
      range: source.range,
    };
  }

  private async resolveImportSource(
    payload: ImportPayload,
    options: {
      limit?: number;
    } = {},
  ): Promise<ResolvedImportSource> {
    const range = normalizeRangeInput(payload.rangeInput);
    if (Array.isArray(payload.rawRows)) {
      return {
        rawRows: payload.rawRows,
        fetched: payload.rawRows.length,
        limited: false,
        range,
      };
    }

    if (!this.ecusImportRunner) {
      return {
        rawRows: [],
        fetched: 0,
        limited: false,
        range,
      };
    }

    const fetched = await this.ecusImportRunner.fetch(range, {
      limit: options.limit,
      includeTaxCodes: normalizeOptionalTaxCodeList(payload.includeTaxCodes),
      excludeTaxCodes: normalizeOptionalTaxCodeList(payload.excludeTaxCodes),
    });

    return {
      rawRows: fetched.rawRows,
      fetched: fetched.fetched,
      limited: fetched.limited,
      range: fetched.range,
    };
  }

  private async buildImportPlan(payload: ImportPayload): Promise<ImportPlan> {
    const syncConfig = await this.store.readEcusSyncConfig().catch(() => null);
    const preferMonthFirst = syncConfig?.preferMonthFirst === true;
    const rawRows = Array.isArray(payload.rawRows) ? payload.rawRows : [];
    const range = normalizeRangeInput(payload.rangeInput);
    const includeSet = new Set(normalizeTaxCodeList(payload.includeTaxCodes));
    const excludeSet = new Set(normalizeTaxCodeList(payload.excludeTaxCodes));
    const targetKeys = extractKeysFromRawRows(rawRows, { preferMonthFirst });
    const existingRows = targetKeys.length > 0
      ? await this.repository.listDeclarationsByKeys(targetKeys)
      : await this.repository.listDeclarations();
    const workingByKey = new Map(existingRows.map((row) => [row.key, cloneRecord(row)]));
    const previewRows: DeclarationsImportPreviewRow[] = [];
    const commitEntries: DeclarationImportCommitEntry[] = [];
    let skipped = 0;
    let reviewLocked = 0;
    let imported = 0;
    let updated = 0;

    for (const rawRow of rawRows) {
      const mapped = mapImportedDeclaration(rawRow, { preferMonthFirst });
      if (!mapped || shouldSkipByTaxCode(mapped.mst, includeSet, excludeSet)) {
        skipped += 1;
        continue;
      }

      const existing = workingByKey.get(mapped.key) ?? null;
      if (!existing) {
        const previewRow = {
          ...cloneRecord(mapped),
          status: 'new' as const,
          locked: false,
          changedFields: buildNewRecordChangedFields(mapped),
        };
        previewRows.push(previewRow);
        commitEntries.push({
          kind: 'insert',
          key: mapped.key,
          current: null,
          nextRecord: cloneRecord(mapped),
          changedFields: previewRow.changedFields.slice(),
        });
        workingByKey.set(mapped.key, cloneRecord(mapped));
        imported += 1;
        continue;
      }

      const merged = mergeDeclarationRows(existing, mapped);
      previewRows.push({
        ...cloneRecord(merged.row),
        status: 'existing',
        locked: Boolean(merged.locked),
        changedFields: merged.changedFields.slice(),
      });

      if (merged.locked) {
        reviewLocked += 1;
        continue;
      }

      if (!merged.changed) {
        skipped += 1;
        continue;
      }

      commitEntries.push({
        kind: 'update',
        key: mapped.key,
        current: cloneRecord(existing),
        nextRecord: cloneRecord(merged.row),
        changedFields: merged.changedFields.slice(),
      });
      const nextWorking = this.repository.coerceDeclarationRecord(merged.row);
      workingByKey.set(mapped.key, cloneRecord(nextWorking ?? existing));
      updated += 1;
    }

    return {
      previewRows,
      commitEntries,
      fetched: previewRows.length,
      imported,
      updated,
      skipped,
      reviewLocked,
      range,
    };
  }

  private requireSyncManage(actor: DeclarationActor): void {
    if (!actor.permissions?.syncManage) {
      throw new DeclarationsHttpError(403, 'forbidden', 'Bạn không có quyền quản lý đồng bộ ECUS.');
    }
  }
}

function mapImportedDeclaration(input: unknown, options?: { preferMonthFirst?: boolean }): DeclarationRecord | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const getField = createFieldReader(record);
  const soTkRaw = normalizeStr(getField('so_tk'));
  const soTk = normalizeDeclarationNumber(soTkRaw);
  const nhanh = normalizeStr(getField('nhanh'));
  const date = toIsoDate(getField('date'), { preferMonthFirst: options?.preferMonthFirst });

  if (!soTk || !date) {
    return null;
  }

  const loaiHinh = normalizeStr(getField('loai_hinh'));
  const mst = normalizeMst(getField('mst'));
  const company = normalizeStr(getField('cong_ty'));
  const agency = normalizeStr(getField('agency'));
  const nhanVien = normalizeStr(getField('nhan_vien'));
  const team = normalizeStr(getField('team'));
  const sourceCodes = extractLicenseCodes(getField('license_codes'));
  const excludedCodes = extractLicenseCodes(getField('license_excluded_codes'));
  const visibleCodes = sourceCodes.filter((code) => !excludedCodes.includes(code));
  const explicitLicenseCount = toFiniteInteger(getField('licenses'));
  const licenseCount = visibleCodes.length > 0 ? visibleCodes.length : explicitLicenseCount;
  const itemCount = toFiniteInteger(getField('num_items'));
  const coLineCount = parseImportCoLineCount(getField('co_line_count'));
  const isExport = resolveIsExport(soTk, loaiHinh, getField('is_export'));
  const key = `${soTk}_${nhanh}`;
  const declarationId =
    normalizeStr(getField('declaration_id')) ||
    normalizeStr(getField('id')) ||
    `decl-${slugify(key, 'declaration')}`;

  return {
    declaration_id: declarationId,
    id: slugify(key, declarationId),
    key,
    declaration_no: soTk,
    declaration_no_raw: soTkRaw || soTk,
    so_tk: soTk,
    so_tk_full: soTkRaw || soTk,
    so_tk_suffix: (soTkRaw || soTk).slice(soTk.length),
    branch_code: nhanh,
    branch: nhanh,
    nhanh,
    declared_at: date,
    date,
    tax_code: mst,
    mst,
    company_name: company,
    cong_ty: company,
    customs_type_code: loaiHinh,
    ma_loai_hinh: loaiHinh,
    loai_hinh: loaiHinh,
    item_count: itemCount,
    num_items: itemCount,
    muc_hang: itemCount,
    license_count: licenseCount,
    licenses: licenseCount,
    so_luong_gp: licenseCount,
    licenseManualCount: licenseCount,
    staff_name_snapshot: nhanVien,
    nhan_vien: nhanVien,
    team_name_snapshot: team,
    team,
    agency_text: agency,
    agency,
    dai_ly: agency,
    is_export: isExport,
    isExport,
    licenseCodes: visibleCodes,
    licenseSourceCodes: sourceCodes,
    licenseExcludedCodes: excludedCodes,
    ...deriveImportCoStatus(record, coLineCount),
  };
}

function mergeDeclarationRows(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): MergeResult {
  if (!existing) {
    return { row: cloneRecord(incoming), changed: true, changedFields: buildNewRecordChangedFields(incoming) };
  }

  if (existing.reviewed) {
    return { row: cloneRecord(existing), changed: false, changedFields: [], locked: true };
  }

  const merged = cloneRecord(existing);
  const changedFields = new Set<string>();
  let changed = false;
  const skipFields = new Set([
    'declaration_id',
    'id',
    'key',
    'so_tk',
    'so_tk_full',
    'so_tk_suffix',
    'declaration_no',
    'declaration_no_raw',
    'nhan_vien',
    'staff_name_snapshot',
    'team',
    'team_name_snapshot',
    'agency',
    'dai_ly',
    'agency_text',
    'licenses',
    'so_luong_gp',
    'license_count',
    'licenseManualCount',
    'reviewed',
    'reviewed_at',
  ]);

  const assign = (field: string, value: unknown) => {
    if (!isEqualValue(merged[field], value)) {
      merged[field] = Array.isArray(value) ? value.slice() : value;
      changed = true;
      changedFields.add(field);
    }
  };

  for (const [field, value] of Object.entries(incoming)) {
    if (skipFields.has(field)) {
      continue;
    }

    if (field === 'co_line_count') {
      assign(field, parseImportCoLineCount(value));
      continue;
    }

    if (field === 'has_co') {
      assign(field, Boolean(value));
      continue;
    }

    if (field === 'is_export' || field === 'isExport') {
      assign(field, Boolean(value));
      continue;
    }

    if (field === 'licenseCodes' || field === 'licenseSourceCodes' || field === 'licenseExcludedCodes' || field === 'co_codes') {
      assign(field, normalizeStringList(value));
      continue;
    }

    assign(field, value);
  }

  fillIfBlank(merged, incoming, 'nhan_vien', 'staff_name_snapshot', assign, changedFields);
  fillIfBlank(merged, incoming, 'team', 'team_name_snapshot', assign, changedFields);
  fillIfBlank(merged, incoming, 'agency', 'dai_ly', assign, changedFields);
  fillIfBlank(merged, incoming, 'agency', 'agency_text', assign, changedFields);
  fillNumericIfPresent(merged, incoming, 'licenses', 'license_count', assign, changedFields);
  fillNumericIfPresent(merged, incoming, 'licenses', 'so_luong_gp', assign, changedFields);
  fillNumericIfPresent(merged, incoming, 'licenses', 'licenseManualCount', assign, changedFields);

  return {
    row: merged,
    changed,
    changedFields: Array.from(changedFields),
  };
}

function buildNewRecordChangedFields(record: Record<string, unknown>): string[] {
  return Object.entries(record)
    .filter(([, value]) => !isEmptyValue(value))
    .map(([field]) => field);
}

function createFieldReader(record: Record<string, unknown>) {
  const lookup = new Map<string, string>();
  for (const key of Object.keys(record)) {
    lookup.set(key.toLowerCase(), key);
  }

  return (field: keyof typeof FIELD_ALIASES | string): unknown => {
    const candidates = [field, ...(FIELD_ALIASES[field as keyof typeof FIELD_ALIASES] ?? [])];
    for (const candidate of candidates) {
      const sourceKey = lookup.get(String(candidate).toLowerCase());
      if (!sourceKey) {
        continue;
      }
      const value = record[sourceKey];
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  };
}

function normalizeRangeInput(
  input:
    | {
        from?: string;
        to?: string;
      }
    | undefined,
): DeclarationImportRange {
  const from = normalizeStr(input?.from);
  const to = normalizeStr(input?.to);
  if (from || to) {
    return { from, to };
  }

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {
    from: formatRangeDate(start),
    to: formatRangeDate(end),
  };
}

function formatRangeDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTaxCodeList(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of input) {
    const normalized = normalizeMst(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeOptionalTaxCodeList(input: unknown): string[] | undefined {
  return Array.isArray(input) ? normalizeTaxCodeList(input) : undefined;
}

function shouldSkipByTaxCode(mst: string, includeSet: Set<string>, excludeSet: Set<string>): boolean {
  if (includeSet.size > 0 && (!mst || !includeSet.has(mst))) {
    return true;
  }
  return Boolean(mst && excludeSet.has(mst));
}

function extractLicenseCodes(value: unknown): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const collector = (code: unknown) => {
    const normalized = normalizeStr(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  };

  collectLicenseCodes(value, collector);
  return result;
}

function collectLicenseCodes(value: unknown, collector: (code: unknown) => void): void {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectLicenseCodes(entry, collector);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectLicenseCodes(nested, collector);
    }
    return;
  }

  const text = String(value);
  for (const match of text.matchAll(/<TS_XNK_MA_BT[^>]*>([^<]+)<\/TS_XNK_MA_BT>/gi)) {
    collector(match[1]);
  }
  for (const part of text.split(/[\s,;|]+/g)) {
    collector(part);
  }
}

function fillIfBlank(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
  sourceField: string,
  mirrorField: string,
  assign: (field: string, value: unknown) => void,
  changedFields: Set<string>,
): void {
  const currentValue = normalizeStr(current[sourceField]);
  const incomingValue = normalizeStr(incoming[sourceField]);
  if (!currentValue && incomingValue) {
    assign(sourceField, incoming[sourceField]);
    assign(mirrorField, incomingValue);
    changedFields.add(sourceField);
  }
}

function fillNumericIfPresent(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
  sourceField: string,
  mirrorField: string,
  assign: (field: string, value: unknown) => void,
  changedFields: Set<string>,
): void {
  const value = incoming[sourceField] ?? incoming[mirrorField];
  const parsed = toFiniteInteger(value);
  if (parsed <= 0) {
    return;
  }

  if (toFiniteInteger(current[sourceField]) !== parsed) {
    assign(sourceField, parsed);
    changedFields.add(sourceField);
  }
  if (toFiniteInteger(current[mirrorField]) !== parsed) {
    assign(mirrorField, parsed);
  }
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    const normalized = normalizeStr(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function deriveImportCoStatus(record: Record<string, unknown>, coLineCount: number) {
  const directCodes = normalizeStringList(record.co_codes);
  const inferredCodes = directCodes.length > 0 ? directCodes : inferCodesFromRecord(record);
  const finalLineCount = Math.max(coLineCount, inferredCodes.length);
  const coLabel = normalizeStr(record.co).toLowerCase();
  const hasCo = Boolean(finalLineCount > 0 || record.has_co === true || coLabel === 'co' || coLabel === 'có');

  return {
    co: hasCo ? 'Có' : '',
    has_co: hasCo,
    co_codes: inferredCodes,
    co_line_count: finalLineCount,
  };
}

function inferCodesFromRecord(record: Record<string, unknown>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const collector = (code: unknown) => {
    const normalized = normalizeStr(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  };

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === 'co' ||
      normalizedKey === 'co_codes' ||
      normalizedKey.includes('ma_bt') ||
      normalizedKey.includes('bieu_thue')
    ) {
      collectLicenseCodes(value, collector);
    }
  }

  return result;
}

function parseImportCoLineCount(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return 0;
    }
    const normalized = Number(match[0]);
    return Number.isFinite(normalized) && normalized > 0 ? Math.round(normalized) : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((total, entry) => total + parseImportCoLineCount(entry), 0);
  }
  if (typeof value === 'object') {
    const candidate = (value as Record<string, unknown>).count ?? (value as Record<string, unknown>).total;
    return parseImportCoLineCount(candidate);
  }
  return 0;
}

function resolveIsExport(soTk: string, loaiHinh: string, rawValue: unknown): boolean {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }
  if (typeof rawValue === 'number') {
    return rawValue !== 0;
  }
  const normalized = normalizeStr(rawValue).toLowerCase();
  if (normalized) {
    if (['1', 'true', 't', 'yes'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'f', 'no'].includes(normalized)) {
      return false;
    }
  }

  const number = soTk.replace(/\D/g, '');
  if (/^30\d{10}$/.test(number)) {
    return true;
  }
  if (/^10\d{10}$/.test(number)) {
    return false;
  }

  const type = loaiHinh.toUpperCase();
  return new Set(['B11', 'B12', 'B13', 'E42', 'E52', 'E62', 'E82', 'G22', 'G23', 'G24', 'G61', 'H21']).has(type);
}

function isEqualValue(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!isEqualValue(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function cloneRecord<T>(value: T): T {
  return structuredClone(value);
}

function toFiniteInteger(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? Math.max(0, Math.round(normalized)) : 0;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return !value.trim();
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

function computeRawRowsHash(rawRows: unknown[]): string {
  const normalized = JSON.stringify(rawRows ?? []);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

function extractKeysFromRawRows(rawRows: unknown[], options?: { preferMonthFirst?: boolean }): string[] {
  const keys: string[] = [];
  for (const rawRow of rawRows) {
    const mapped = mapImportedDeclaration(rawRow, options);
    if (mapped?.key) {
      keys.push(mapped.key);
    }
  }
  return keys;
}
