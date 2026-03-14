import type { MstAssignmentAsyncReader } from './mstAssignmentAsyncReader.js';
import { normalizeMst, normalizeStr, toIsoDate } from '../../legacy/legacy-normalizers.js';

export type MstAssignment = {
  mst: string;
  company: string;
  person_import: string;
  person_export: string;
  team: string;
  effective_from: string;
  effective_to: string;
  status: string;
};

const EMPTY_ASSIGNMENTS: MstAssignment[] = [];

export class MstAssignmentsRepository {
  constructor(private readonly reader: MstAssignmentAsyncReader) {}

  async listAssignments(filters: { mst?: string } = {}): Promise<MstAssignment[]> {
    const raw = await this.reader.readMstAssignmentRows();
    const sanitized = Array.isArray(raw)
      ? raw.map((row) => sanitizeAssignment(row)).filter((row): row is MstAssignment => Boolean(row))
      : [];

    sanitized.sort(compareAssignments);

    if (!filters.mst) {
      return sanitized;
    }

    const targetMst = normalizeMst(filters.mst);
    return sanitized.filter((row) => row.mst === targetMst);
  }

  async resolveAssignment(mst: string, date?: string): Promise<MstAssignment | null> {
    const targetMst = normalizeMst(mst);
    if (!targetMst) {
      return null;
    }

    const matches = await this.listAssignments({ mst: targetMst });
    if (!matches.length) {
      return null;
    }

    const targetTime = date ? new Date(date).getTime() : Number.POSITIVE_INFINITY;
    const ranked = matches
      .map((row) => {
        const effectiveFrom = row.effective_from ? new Date(row.effective_from).getTime() : Number.NEGATIVE_INFINITY;
        const rank =
          effectiveFrom <= targetTime
            ? targetTime - effectiveFrom
            : Number.POSITIVE_INFINITY - effectiveFrom;

        return { row, rank };
      })
      .sort((left, right) => left.rank - right.rank);

    return ranked[0]?.row ?? null;
  }
}

function sanitizeAssignment(input: unknown): MstAssignment | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const row = input as Record<string, unknown>;
  const mst = normalizeMst(row.mst);
  if (!mst) {
    return null;
  }

  const assignment: MstAssignment = {
    mst,
    company: pickNormalizedValue(row, ['company', 'company_name', 'companyName', 'tenCongTy']),
    person_import: pickNormalizedValue(row, [
      'person_import',
      'personImport',
      'nguoi_phu_trach_nhap',
      'nguoiPhuTrachNhap',
      'import_person',
      'importPerson',
    ]),
    person_export: pickNormalizedValue(row, [
      'person_export',
      'personExport',
      'nguoi_phu_trach_xuat',
      'nguoiPhuTrachXuat',
      'export_person',
      'exportPerson',
    ]),
    team: pickNormalizedValue(row, ['team', 'team_name', 'teamName']),
    effective_from: pickDateValue(row, ['effective_from', 'effectiveFrom', 'from', 'start', 'valid_from']),
    effective_to: pickDateValue(row, ['effective_to', 'effectiveTo', 'to', 'end', 'valid_to']),
    status: '',
  };

  assignment.status = resolveStatus(row.status, assignment);

  return assignment;
}

function pickNormalizedValue(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key in source && source[key] !== undefined) {
      return normalizeStr(source[key]);
    }
  }

  return '';
}

function pickDateValue(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key in source && source[key] !== undefined) {
      return toIsoDate(source[key]);
    }
  }

  return '';
}

function resolveStatus(rawStatus: unknown, assignment: MstAssignment): string {
  const normalizedStatus = normalizeStr(rawStatus).toLowerCase();
  if (normalizedStatus) {
    return normalizedStatus;
  }

  if (assignment.person_import || assignment.person_export) {
    return 'assigned';
  }

  return 'pending';
}

function compareAssignments(left: MstAssignment, right: MstAssignment): number {
  const byMst = left.mst.localeCompare(right.mst);
  if (byMst !== 0) {
    return byMst;
  }

  if (left.effective_from !== right.effective_from) {
    return left.effective_from.localeCompare(right.effective_from);
  }

  const leftTo = left.effective_to || '9999-12-31';
  const rightTo = right.effective_to || '9999-12-31';
  return leftTo.localeCompare(rightTo);
}
