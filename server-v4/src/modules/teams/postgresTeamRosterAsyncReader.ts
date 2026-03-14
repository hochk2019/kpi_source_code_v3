import type { Pool } from 'pg';

import type { BusinessSnapshotSourceKind } from '../../persistence/businessSnapshotReader.js';
import type { TeamRosterAsyncReader } from './teamRosterAsyncReader.js';

type PoolLike = Pick<Pool, 'query'>;

type TeamRow = {
  id?: unknown;
  legacy_team_id?: unknown;
  name?: unknown;
};

type TeamMemberRow = {
  team_id?: unknown;
  legacy_member_id?: unknown;
  full_name?: unknown;
  notes?: unknown;
};

const ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY = 'active';

const READ_TEAMS_SQL =
  'SELECT id, legacy_team_id, name ' +
  'FROM teams ' +
  'WHERE snapshot_key = $1 AND active = 1 ' +
  'ORDER BY sort_order ASC, name ASC';

const READ_TEAM_MEMBERS_SQL =
  'SELECT team_id, legacy_member_id, full_name, notes ' +
  'FROM team_members ' +
  'WHERE snapshot_key = $1 AND active = 1 ' +
  'ORDER BY team_id ASC, sort_order ASC, full_name ASC';

export class PostgresTeamRosterAsyncReader implements TeamRosterAsyncReader {
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    private readonly fallbackReader: TeamRosterAsyncReader,
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

  async readTeamRoster(): Promise<unknown> {
    try {
      const [teamsResult, membersResult] = await Promise.all([
        this.pool.query<TeamRow>(READ_TEAMS_SQL, [ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY]),
        this.pool.query<TeamMemberRow>(READ_TEAM_MEMBERS_SQL, [ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY]),
      ]);

      if (teamsResult.rows.length > 0 || membersResult.rows.length > 0) {
        return buildRosterSnapshot(teamsResult.rows, membersResult.rows);
      }

      if (this.sourceKind === 'relational-store') {
        return buildRosterSnapshot([], []);
      }
    } catch {
      // Fall back to the SQLite compatibility reader while Postgres roster materialization is incomplete.
    }

    return this.fallbackReader.readTeamRoster();
  }
}

function buildRosterSnapshot(teams: TeamRow[], members: TeamMemberRow[]) {
  const memberMap = new Map<string, Array<Record<string, string>>>();

  for (const row of Array.isArray(members) ? members : []) {
    const teamId = normalizeText(row?.team_id);
    const fullName = normalizeText(row?.full_name);
    if (!teamId || !fullName) {
      continue;
    }

    const entry: Record<string, string> = { name: fullName };
    const memberId = normalizeText(row?.legacy_member_id);
    const notes = normalizeText(row?.notes);
    if (memberId) {
      entry.id = memberId;
    }
    if (notes) {
      entry.notes = notes;
    }

    const items = memberMap.get(teamId) ?? [];
    items.push(entry);
    memberMap.set(teamId, items);
  }

  const rosterTeams = (Array.isArray(teams) ? teams : [])
    .map((row, index) => {
      const teamRowId = normalizeText(row?.id);
      if (!teamRowId) {
        return null;
      }

      const entry: Record<string, unknown> = {
        name: normalizeText(row?.name) || `Team ${index + 1}`,
        members: memberMap.get(teamRowId) ?? [],
      };
      const legacyTeamId = normalizeText(row?.legacy_team_id);
      if (legacyTeamId) {
        entry.id = legacyTeamId;
      }
      return entry;
    })
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));

  return {
    version: 1,
    teams: rosterTeams,
  };
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
