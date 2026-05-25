import type { Pool } from 'pg';

import type { MstAssignmentAsyncReader } from './mstAssignmentAsyncReader.js';
import type { BusinessSnapshotSourceKind } from '../../persistence/businessSnapshotReader.js';

type PoolLike = Pick<Pool, 'query'>;

type MstAssignmentRow = {
  mst?: unknown;
  company?: unknown;
  person_import?: unknown;
  person_export?: unknown;
  team?: unknown;
  effective_from?: unknown;
  effective_to?: unknown;
  status?: unknown;
};

const READ_MST_ASSIGNMENTS_SQL =
  'SELECT ' +
  'ma.tax_code AS mst, ' +
  'ma.company_name AS company, ' +
  'COALESCE(import_member.full_name, \'\') AS person_import, ' +
  'COALESCE(export_member.full_name, \'\') AS person_export, ' +
  'COALESCE(team_ref.name, \'\') AS team, ' +
  "COALESCE(lower(ma.valid_during)::text, '') AS effective_from, " +
  "CASE WHEN upper_inf(ma.valid_during) THEN '' ELSE COALESCE(upper(ma.valid_during)::text, '') END AS effective_to, " +
  "COALESCE(ma.status, '') AS status " +
  'FROM mst_assignments ma ' +
  'LEFT JOIN team_members import_member ON import_member.id = ma.import_member_id ' +
  'LEFT JOIN team_members export_member ON export_member.id = ma.export_member_id ' +
  'LEFT JOIN teams team_ref ON team_ref.id = ma.team_id ' +
  'ORDER BY ma.tax_code ASC, lower(ma.valid_during) ASC, upper(ma.valid_during) ASC';

export class PostgresMstAssignmentAsyncReader implements MstAssignmentAsyncReader {
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    private readonly fallbackReader: MstAssignmentAsyncReader,
    private readonly pool: PoolLike,
    options: {
      sourceKind?: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;
    } = {},
  ) {
    this.sourceKind = options.sourceKind ?? 'dual-write';
  }

  getSourceKind() {
    return this.sourceKind;
  }

  getHotPathKeys() {
    return this.fallbackReader.getHotPathKeys();
  }

  getLegacyDbFile(): string | null {
    return this.fallbackReader.getLegacyDbFile();
  }

  async readMstAssignmentRows(): Promise<unknown[]> {
    try {
      const result = await this.pool.query<MstAssignmentRow>(READ_MST_ASSIGNMENTS_SQL);
      if (Array.isArray(result.rows) && result.rows.length > 0) {
        return result.rows.map((row) => ({
          mst: normalizeText(row.mst),
          company: normalizeText(row.company),
          person_import: normalizeText(row.person_import),
          person_export: normalizeText(row.person_export),
          team: normalizeText(row.team),
          effective_from: normalizeText(row.effective_from),
          effective_to: normalizeText(row.effective_to),
          status: normalizeText(row.status),
        }));
      }
    } catch {
      // Fall back to the SQLite compatibility reader while Postgres backfill is incomplete.
    }

    return this.fallbackReader.readMstAssignmentRows();
  }
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
