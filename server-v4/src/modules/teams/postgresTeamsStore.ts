import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import { cloneTeamRoster, normalizeTeamRoster, type TeamRoster } from './teamRosterDocument.js';
import type { TeamsStore } from './teamsStore.js';

type PoolLike = Pick<Pool, 'query'>;

const ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY = 'active';

const CREATE_TEAMS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS teams (' +
  'id TEXT PRIMARY KEY, ' +
  'snapshot_key TEXT NOT NULL, ' +
  "legacy_team_id TEXT NOT NULL DEFAULT '', " +
  "name TEXT NOT NULL DEFAULT '', " +
  'sort_order INTEGER NOT NULL DEFAULT 0, ' +
  'active INTEGER NOT NULL DEFAULT 1, ' +
  'updated_at TIMESTAMPTZ NOT NULL' +
  ')';

const CREATE_TEAMS_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_teams_snapshot_key_sort_order ON teams(snapshot_key, sort_order)';

const CREATE_TEAM_MEMBERS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS team_members (' +
  'id TEXT PRIMARY KEY, ' +
  'team_id TEXT NOT NULL, ' +
  'snapshot_key TEXT NOT NULL, ' +
  "legacy_member_id TEXT NOT NULL DEFAULT '', " +
  "full_name TEXT NOT NULL DEFAULT '', " +
  "notes TEXT NOT NULL DEFAULT '', " +
  'sort_order INTEGER NOT NULL DEFAULT 0, ' +
  'active INTEGER NOT NULL DEFAULT 1, ' +
  'updated_at TIMESTAMPTZ NOT NULL, ' +
  'FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE' +
  ')';

const CREATE_TEAM_MEMBERS_TEAM_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_team_members_team_id_sort_order ON team_members(team_id, sort_order)';

const CREATE_TEAM_MEMBERS_SNAPSHOT_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_team_members_snapshot_key_sort_order ON team_members(snapshot_key, sort_order)';

const DELETE_TEAM_MEMBERS_SQL = 'DELETE FROM team_members WHERE snapshot_key = $1';
const DELETE_TEAMS_SQL = 'DELETE FROM teams WHERE snapshot_key = $1';

const INSERT_TEAM_SQL =
  'INSERT INTO teams (id, snapshot_key, legacy_team_id, name, sort_order, active, updated_at) ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7)';

const INSERT_TEAM_MEMBER_SQL =
  'INSERT INTO team_members (id, team_id, snapshot_key, legacy_member_id, full_name, notes, sort_order, active, updated_at) ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';

export class PostgresTeamsStore implements TeamsStore {
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly pool: PoolLike) {}

  async writeRoster(roster: TeamRoster): Promise<TeamRoster> {
    await this.ensureInitialized();

    const normalized = normalizeTeamRoster(roster);
    const updatedAt = new Date().toISOString();
    const teamRows = normalized.teams.map((team, teamIndex) => {
      const rowId = randomUUID();
      return {
        rowId,
        legacyTeamId: team.id,
        name: team.name,
        sortOrder: teamIndex,
        members: team.members.map((member, memberIndex) => ({
          rowId: randomUUID(),
          legacyMemberId: member.id,
          name: member.name,
          notes: member.notes ?? '',
          sortOrder: memberIndex,
        })),
      };
    });

    await this.pool.query('BEGIN');

    try {
      await this.pool.query(DELETE_TEAM_MEMBERS_SQL, [ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY]);
      await this.pool.query(DELETE_TEAMS_SQL, [ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY]);

      for (const team of teamRows) {
        await this.pool.query(INSERT_TEAM_SQL, [
          team.rowId,
          ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY,
          team.legacyTeamId,
          team.name,
          team.sortOrder,
          1,
          updatedAt,
        ]);

        for (const member of team.members) {
          await this.pool.query(INSERT_TEAM_MEMBER_SQL, [
            member.rowId,
            team.rowId,
            ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY,
            member.legacyMemberId,
            member.name,
            member.notes,
            member.sortOrder,
            1,
            updatedAt,
          ]);
        }
      }

      await this.pool.query('COMMIT');
      return cloneTeamRoster(normalized);
    } catch (error) {
      await this.pool.query('ROLLBACK');
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = initializeTeamsStorage(this.pool).catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }

    await this.initializationPromise;
  }
}

async function initializeTeamsStorage(pool: PoolLike): Promise<void> {
  await pool.query(CREATE_TEAMS_TABLE_SQL);
  await pool.query(CREATE_TEAMS_INDEX_SQL);
  await pool.query(CREATE_TEAM_MEMBERS_TABLE_SQL);
  await pool.query(CREATE_TEAM_MEMBERS_TEAM_INDEX_SQL);
  await pool.query(CREATE_TEAM_MEMBERS_SNAPSHOT_INDEX_SQL);
}
