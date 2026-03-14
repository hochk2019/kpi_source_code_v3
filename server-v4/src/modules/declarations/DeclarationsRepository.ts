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

export class DeclarationsRepository {
  constructor(private readonly reader: DeclarationAsyncReader) {}

  async listDeclarations(filters: DeclarationFilters = {}): Promise<DeclarationRecord[]> {
    const raw = await this.reader.readDeclarationRows();
    const sanitized = Array.isArray(raw)
      ? raw.map((row, index) => sanitizeDeclaration(row, index)).filter((row): row is DeclarationRecord => Boolean(row))
      : [];

    return applyFilters(sortDeclarations(sanitized), filters);
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
