import { normalizeMst, normalizeStr, stripDiacritics } from '../../legacy/legacy-normalizers.js';
import type { AdjustmentAsyncReader } from './adjustmentAsyncReader.js';

export type KpiAdjustmentStatus = 'pending' | 'approved' | 'rejected';

export type KpiAdjustmentFilters = {
  month?: string;
  status?: KpiAdjustmentStatus;
  staff?: string;
  team?: string;
  category?: string;
};

export type KpiAdjustmentRecord = Record<string, unknown> & {
  id: string;
  category: string;
  categoryLabel: string;
  month: string;
  status: KpiAdjustmentStatus;
  staffName: string;
  teamName: string;
  totalPoints: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type KpiAdjustmentSummary = {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalPoints: number;
  approvedPoints: number;
};

const VALID_STATUSES = new Set<KpiAdjustmentStatus>(['pending', 'approved', 'rejected']);

export class KpiAdjustmentsRepository {
  constructor(private readonly reader: AdjustmentAsyncReader) {}

  async listAdjustments(filters: KpiAdjustmentFilters = {}): Promise<KpiAdjustmentRecord[]> {
    const raw = await this.reader.readAdjustmentRows();
    const sanitized = Array.isArray(raw)
      ? raw.map((entry, index) => sanitizeAdjustment(entry, index)).filter((entry): entry is KpiAdjustmentRecord => Boolean(entry))
      : [];

    return applyFilters(sortAdjustments(sanitized), filters);
  }
}

export function summarizeAdjustments(rows: readonly KpiAdjustmentRecord[]): KpiAdjustmentSummary {
  return rows.reduce<KpiAdjustmentSummary>(
    (summary, row) => {
      if (row.status === 'approved') {
        summary.approvedCount += 1;
        summary.approvedPoints += row.totalPoints;
      } else if (row.status === 'rejected') {
        summary.rejectedCount += 1;
      } else {
        summary.pendingCount += 1;
      }

      summary.totalPoints += row.totalPoints;
      return summary;
    },
    {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      totalPoints: 0,
      approvedPoints: 0,
    },
  );
}

export function sanitizeAdjustment(input: unknown, index: number): KpiAdjustmentRecord | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const row = input as Record<string, unknown>;
  const category = normalizeCategory(pickRawValue(row, ['category', 'type', 'groupKey', 'group_key'])) || 'uncategorized';
  const createdAt = normalizeTimestamp(row.createdAt ?? row.created_at);
  const updatedAt = normalizeTimestamp(row.updatedAt ?? row.updated_at ?? row.modifiedAt ?? row.modified_at) || createdAt;
  const month = normalizeMonth(row.month ?? row.period ?? createdAt);
  const id = normalizeStr(row.id) || `adjustment-${month || 'unknown'}-${index + 1}`;

  return {
    ...row,
    id,
    category,
    categoryLabel:
      normalizeStr(row.categoryLabel ?? row.category_label ?? row.label ?? row.title) || humanizeCategory(category),
    month,
    status: normalizeStatus(row.status),
    staffName: pickNormalizedValue(row, ['staffName', 'staff_name', 'staff', 'nhan_vien']),
    teamName: pickNormalizedValue(row, ['teamName', 'team_name', 'team']),
    totalPoints: pickNumberValue(row, ['totalPoints', 'total_points', 'pointsTotal', 'points_total', 'total', 'points']),
    quantity: pickNumberValue(row, ['quantity', 'count', 'items']),
    companyName: pickNormalizedValue(row, ['companyName', 'company_name', 'company', 'cong_ty']),
    taxCode: normalizeMst(pickRawValue(row, ['taxCode', 'tax_code', 'mst'])),
    note: pickNormalizedValue(row, ['note', 'reason', 'description']),
    createdAt,
    updatedAt,
  };
}

function sortAdjustments(rows: KpiAdjustmentRecord[]): KpiAdjustmentRecord[] {
  return rows
    .map((row, index) => ({
      row,
      index,
      monthKey: row.month || '',
      updatedAt: parseTimestamp(row.updatedAt),
      createdAt: parseTimestamp(row.createdAt),
    }))
    .sort((left, right) => {
      if (left.monthKey !== right.monthKey) {
        return right.monthKey.localeCompare(left.monthKey, undefined, { numeric: true, sensitivity: 'base' });
      }

      if (left.updatedAt !== right.updatedAt) {
        return right.updatedAt - left.updatedAt;
      }

      if (left.createdAt !== right.createdAt) {
        return right.createdAt - left.createdAt;
      }

      return right.index - left.index;
    })
    .map((entry) => entry.row);
}

function applyFilters(rows: KpiAdjustmentRecord[], filters: KpiAdjustmentFilters): KpiAdjustmentRecord[] {
  const targetMonth = normalizeMonth(filters.month);
  const targetStatus = filters.status && VALID_STATUSES.has(filters.status) ? filters.status : undefined;
  const targetStaff = normalizeSearchText(filters.staff);
  const targetTeam = normalizeSearchText(filters.team);
  const targetCategory = normalizeCategory(filters.category);

  return rows.filter((row) => {
    if (targetMonth && row.month !== targetMonth) {
      return false;
    }

    if (targetStatus && row.status !== targetStatus) {
      return false;
    }

    if (targetStaff && !normalizeSearchText(row.staffName).includes(targetStaff)) {
      return false;
    }

    if (targetTeam && !normalizeSearchText(row.teamName).includes(targetTeam)) {
      return false;
    }

    if (targetCategory && row.category !== targetCategory) {
      return false;
    }

    return true;
  });
}

function pickRawValue(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key in source && source[key] !== undefined && source[key] !== null) {
      return String(source[key]).trim();
    }
  }

  return '';
}

function pickNormalizedValue(source: Record<string, unknown>, keys: string[]): string {
  return normalizeStr(pickRawValue(source, keys));
}

function pickNumberValue(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    if (!(key in source)) {
      continue;
    }

    const value = Number.parseFloat(String(source[key] ?? ''));
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function normalizeMonth(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  const raw = normalizeStr(value);
  if (!raw) {
    return '';
  }

  const isoMonth = raw.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth) {
    const month = Number.parseInt(isoMonth[2], 10);
    if (month >= 1 && month <= 12) {
      return `${isoMonth[1]}-${isoMonth[2]}`;
    }
  }

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (isoDate) {
    const month = Number.parseInt(isoDate[2], 10);
    if (month >= 1 && month <= 12) {
      return `${isoDate[1]}-${isoDate[2]}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeStatus(value: unknown): KpiAdjustmentStatus {
  const normalized = normalizeStr(value).toLowerCase();
  return VALID_STATUSES.has(normalized as KpiAdjustmentStatus)
    ? (normalized as KpiAdjustmentStatus)
    : 'pending';
}

function normalizeCategory(value: unknown): string {
  return normalizeStr(value)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

function humanizeCategory(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeTimestamp(value: unknown): string {
  const raw = normalizeStr(value);
  if (!raw) {
    return '';
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function parseTimestamp(value: string): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSearchText(value: unknown): string {
  return stripDiacritics(normalizeStr(value)).toLowerCase();
}
