import type { DeclarationAsyncReader } from './declarationAsyncReader.js';
import {
  normalizeDeclarationNumber,
  normalizeMst,
  normalizeStr,
  slugify,
  stripDiacritics,
  toIsoDate,
} from '../../legacy/legacy-normalizers.js';

export type DeclarationFilters = {
  mst?: string;
  soTk?: string;
  branch?: string;
};

export type DeclarationRecord = Record<string, unknown> & {
  id: string;
  key: string;
  so_tk: string;
  so_tk_full: string;
  so_tk_suffix: string;
  nhanh: string;
  mst: string;
  date: string;
};

const EMPTY_DECLARATIONS: unknown[] = [];
const EMPTY_SEARCH_STATUS_LIST: string[] = [];

type DeclarationSearchFilters = {
  queryLower: string;
  mstNeedle: string;
  companyNeedle: string;
  statusSet: Set<string> | null;
  rangeFrom: string;
  rangeTo: string;
  noStaff: boolean;
  noTeam: boolean;
  duplicate: boolean;
  coMode: 'all' | 'has' | 'min';
  coMinValue: number;
  includeDeleted: boolean;
};

export class DeclarationsRepository {
  constructor(private readonly reader: DeclarationAsyncReader) {}

  async listDeclarations(filters: DeclarationFilters = {}): Promise<DeclarationRecord[]> {
    const raw = await this.reader.readDeclarationRows();
    const sanitized = Array.isArray(raw)
      ? raw.map((row, index) => sanitizeDeclaration(row, index)).filter((row): row is DeclarationRecord => Boolean(row))
      : [];

    return applyFilters(sortDeclarations(sanitized), filters);
  }

  async searchDeclarations(rawFilters: unknown = {}): Promise<DeclarationRecord[]> {
    const raw = await this.reader.readDeclarationRows();
    const sanitized = Array.isArray(raw)
      ? raw.map((row, index) => sanitizeDeclaration(row, index)).filter((row): row is DeclarationRecord => Boolean(row))
      : [];

    return filterDeclRows(sanitized, rawFilters) as DeclarationRecord[];
  }

  async readDeclarationByIdentifier(identifier: string): Promise<DeclarationRecord | null> {
    const normalizedIdentifier = normalizeStr(identifier);
    if (!normalizedIdentifier) {
      return null;
    }

    const rows = await this.listDeclarations();
    return rows.find((row) => matchesDeclarationIdentifier(row, normalizedIdentifier)) ?? null;
  }

  coerceDeclarationRecord(input: unknown): DeclarationRecord | null {
    return sanitizeDeclaration(input, 0);
  }
}

export function sanitizeDeclaration(input: unknown, index: number): DeclarationRecord | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const row = input as Record<string, unknown>;
  const originalNumber = pickRawValue(row, ['so_tk_full', 'so_tk', 'declaration_no', 'declarationNumber']);
  const normalizedNumber = normalizeDeclarationNumber(originalNumber || row.so_tk);
  const nhanh = pickNormalizedValue(row, ['nhanh', 'branch', 'chi_nhanh', 'branch_name']);
  const fallbackKey = `legacy-declaration-${index + 1}`;
  const key = normalizedNumber ? `${normalizedNumber}_${nhanh}` : fallbackKey;
  const normalizedDate = pickDateValue(row, [
    'date',
    'ngay',
    'ngay_dk',
    'ngay_dang_ky',
    'registration_date',
    'registered_at',
  ]);

  const declaration: DeclarationRecord = {
    ...row,
    id: slugify(key, fallbackKey),
    key,
    so_tk: normalizedNumber,
    so_tk_full: originalNumber || normalizedNumber,
    so_tk_suffix: resolveDeclarationSuffix(originalNumber, normalizedNumber),
    nhanh,
    mst: normalizeMst(pickRawValue(row, ['mst', 'ma_so_thue', 'tax_code', 'taxCode'])),
    date: normalizedDate,
  };

  if (!normalizeStr(declaration.branch) && nhanh) {
    declaration.branch = nhanh;
  }

  return declaration;
}

function matchesDeclarationIdentifier(row: DeclarationRecord, identifier: string): boolean {
  if (row.id === identifier || row.key === identifier) {
    return true;
  }

  const declarationId = normalizeStr(row.declaration_id ?? row.declarationId);
  if (declarationId && declarationId === identifier) {
    return true;
  }

  return row.so_tk === normalizeDeclarationNumber(identifier) || row.so_tk_full === identifier;
}

function pickRawValue(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key in source && source[key] !== undefined) {
      return String(source[key] ?? '').trim();
    }
  }

  return '';
}

function pickNormalizedValue(source: Record<string, unknown>, keys: string[]): string {
  return normalizeStr(pickRawValue(source, keys));
}

function pickDateValue(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key in source && source[key] !== undefined) {
      const normalizedDate = toIsoDate(source[key]);
      if (normalizedDate) {
        return normalizedDate;
      }
    }
  }

  return '';
}

function resolveDeclarationSuffix(originalNumber: string, normalizedNumber: string): string {
  if (!originalNumber || !normalizedNumber) {
    return '';
  }

  return originalNumber.slice(normalizedNumber.length) || '';
}

function sortDeclarations(rows: DeclarationRecord[]): DeclarationRecord[] {
  return rows
    .map((row, index) => ({
      row,
      index,
      ts: parseSortTime(row.date),
    }))
    .sort((left, right) => {
      if (left.ts !== right.ts) {
        return right.ts - left.ts;
      }

      if (left.row.so_tk !== right.row.so_tk) {
        const compareDeclaration = right.row.so_tk.localeCompare(left.row.so_tk, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (compareDeclaration !== 0) {
          return compareDeclaration;
        }
      }

      if (left.row.nhanh !== right.row.nhanh) {
        const compareBranch = right.row.nhanh.localeCompare(left.row.nhanh, 'vi', {
          numeric: true,
          sensitivity: 'base',
        });
        if (compareBranch !== 0) {
          return compareBranch;
        }
      }

      return right.index - left.index;
    })
    .map((entry) => entry.row);
}

function parseSortTime(value: string): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function applyFilters(rows: DeclarationRecord[], filters: DeclarationFilters): DeclarationRecord[] {
  const targetMst = normalizeMst(filters.mst);
  const targetSoTk = normalizeDeclarationNumber(filters.soTk);
  const targetBranch = normalizeSearchText(filters.branch);

  return rows.filter((row) => {
    if (targetMst && !matchesMst(row.mst, targetMst)) {
      return false;
    }

    if (targetSoTk && row.so_tk !== targetSoTk) {
      return false;
    }

    if (targetBranch && !normalizeSearchText(row.nhanh).includes(targetBranch)) {
      return false;
    }

    return true;
  });
}

function normalizeSearchText(value: unknown): string {
  return stripDiacritics(normalizeStr(value)).toLowerCase();
}

function matchesMst(rowMst: string, targetMst: string): boolean {
  if (!rowMst || !targetMst) {
    return false;
  }

  return rowMst === targetMst || rowMst.startsWith(targetMst) || targetMst.startsWith(rowMst);
}

function filterDeclRows(rows: DeclarationRecord[], rawFilters: unknown): DeclarationRecord[] {
  const list = Array.isArray(rows) ? rows : (EMPTY_DECLARATIONS as DeclarationRecord[]);
  if (!list.length) {
    return [];
  }

  const filters = prepareSearchFilters(rawFilters);
  const duplicatePrefixCounts = filters.duplicate ? computeDuplicatePrefixCounts(list) : null;

  return list.filter((row) => {
    if (!filters.includeDeleted && row.deleted_at) {
      return false;
    }

    if (filters.queryLower) {
      const agencyText = normalizeSearchText([row.agency, row.dai_ly, ...(Array.isArray(row.agents) ? row.agents : [])].join(' '));
      const matchesQuery =
        normalizeSearchText(row.so_tk).includes(filters.queryLower) ||
        normalizeSearchText(row.so_tk_full).includes(filters.queryLower) ||
        normalizeSearchText(row.mst ?? row.ma_so_thue).includes(filters.queryLower) ||
        normalizeSearchText(row.cong_ty ?? row.company ?? row.ten_cong_ty ?? row.doanh_nghiep).includes(filters.queryLower) ||
        normalizeSearchText(row.nhan_vien ?? row.staff).includes(filters.queryLower) ||
        normalizeSearchText(row.team ?? row.to_doi ?? row.bo_phan).includes(filters.queryLower) ||
        agencyText.includes(filters.queryLower);
      if (!matchesQuery) {
        return false;
      }
    }

    if (filters.mstNeedle && !normalizeSearchText(row.mst ?? row.ma_so_thue).includes(filters.mstNeedle)) {
      return false;
    }

    if (
      filters.companyNeedle &&
      !normalizeSearchText(row.cong_ty ?? row.company ?? row.ten_cong_ty ?? row.doanh_nghiep).includes(filters.companyNeedle)
    ) {
      return false;
    }

    if (filters.statusSet) {
      const status = normalizeSearchText(row.status ?? row.trang_thai ?? row.previewStatus ?? row.importStatus ?? row.state);
      if (!filters.statusSet.has(status)) {
        return false;
      }
    }

    if (filters.rangeFrom || filters.rangeTo) {
      const rowDate = normalizeDateInput(row.date ?? row.raw_date);
      if (filters.rangeFrom && (!rowDate || rowDate < filters.rangeFrom)) {
        return false;
      }
      if (filters.rangeTo && (!rowDate || rowDate > filters.rangeTo)) {
        return false;
      }
    }

    if (filters.noStaff && normalizeStr(row.nhan_vien ?? row.staff)) {
      return false;
    }

    if (filters.noTeam && normalizeStr(row.team ?? row.to_doi ?? row.bo_phan)) {
      return false;
    }

    if (filters.coMode === 'has' && coLineCount(row) <= 0) {
      return false;
    }

    if (filters.coMode === 'min' && coLineCount(row) < filters.coMinValue) {
      return false;
    }

    if (duplicatePrefixCounts) {
      const duplicatePrefix = normalizeDeclarationNumber(row.so_tk_full ?? row.so_tk, { length: 11 });
      if (!duplicatePrefix || (duplicatePrefixCounts.get(duplicatePrefix) ?? 0) <= 1) {
        return false;
      }
    }

    return true;
  });
}

function prepareSearchFilters(rawFilters: unknown): DeclarationSearchFilters {
  const filters = isRecord(rawFilters) ? rawFilters : {};
  const query = extractStringInput(filters.query, filters.q);
  const range = isRecord(filters.range) ? filters.range : {};
  const statuses = Array.isArray(filters.statuses)
    ? filters.statuses
    : typeof filters.status === 'string'
      ? filters.status.split(',')
      : EMPTY_SEARCH_STATUS_LIST;
  const statusSet = new Set(
    statuses
      .map((status) => normalizeSearchText(status))
      .filter(Boolean),
  );
  const coModeCandidate = normalizeStr(filters.coMode).toLowerCase();
  const coMode: DeclarationSearchFilters['coMode'] =
    coModeCandidate === 'has' || coModeCandidate === 'min' ? coModeCandidate : 'all';
  const rawCoMin = Number(filters.coMin ?? filters.coThreshold ?? filters.coFilterMin);

  return {
    queryLower: normalizeSearchText(query),
    mstNeedle: normalizeSearchText(filters.mst),
    companyNeedle: normalizeSearchText(filters.company),
    statusSet: statusSet.size > 0 ? statusSet : null,
    rangeFrom: normalizeDateInput(range.from ?? filters.from),
    rangeTo: normalizeDateInput(range.to ?? filters.to),
    noStaff: parseBooleanInput(filters.noStaff) || parseBooleanInput(filters.filterNoStaff),
    noTeam: parseBooleanInput(filters.noTeam) || parseBooleanInput(filters.filterNoTeam),
    duplicate: parseBooleanInput(filters.duplicate) || parseBooleanInput(filters.filterDuplicate11),
    coMode,
    coMinValue: Number.isFinite(rawCoMin) ? Math.max(0, Math.round(rawCoMin)) : 0,
    includeDeleted: parseBooleanInput(
      filters.includeDeleted ?? filters.showDeleted ?? filters.withDeleted ?? filters.include_deleted,
    ),
  };
}

function extractStringInput(...sources: unknown[]): string {
  for (const source of sources) {
    if (typeof source === 'string') {
      return source;
    }
    if (Array.isArray(source)) {
      const preferred = source.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
      if (preferred) {
        return preferred;
      }

      const fallback = source.find((entry): entry is string => typeof entry === 'string');
      if (fallback) {
        return fallback;
      }
    }
  }

  return '';
}

function parseBooleanInput(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
  }
  if (Array.isArray(value)) {
    return value.some((entry) => parseBooleanInput(entry));
  }

  return false;
}

function normalizeDateInput(value: unknown): string {
  const isoDate = toIsoDate(value);
  return isoDate ? isoDate.slice(0, 10) : '';
}

function computeDuplicatePrefixCounts(rows: DeclarationRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const prefix = normalizeDeclarationNumber(row.so_tk_full ?? row.so_tk, { length: 11 });
    if (!prefix) {
      continue;
    }
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return counts;
}

function coLineCount(row: DeclarationRecord): number {
  const directCount = parseCountValue(
    row.co_line_count ??
      row.co_lines ??
      row.co_count ??
      row.coLineCount ??
      row.coLines ??
      row.so_dong_co ??
      row.sodongco,
  );
  if (directCount > 0) {
    return directCount;
  }

  if (Array.isArray(row.co_codes)) {
    return row.co_codes
      .map((code) => normalizeStr(code))
      .filter(Boolean)
      .length;
  }

  return 0;
}

function parseCountValue(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }
  if (typeof value === 'string') {
    const match = value.trim().replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return 0;
    }

    const numericValue = Number(match[0]);
    return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((total, entry) => total + parseCountValue(entry), 0);
  }
  if (isRecord(value)) {
    return parseCountValue(value.count ?? value.total ?? value.value ?? value.lines ?? value.co);
  }

  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
