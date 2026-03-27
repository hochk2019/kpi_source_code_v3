export const TEAM_ROSTER_STATE_TABLE = 'team_roster_state';
export const TEAM_TABLE = 'teams';
export const TEAM_MEMBER_TABLE = 'team_members';
export const ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY = 'active';
import { ensureSqliteTeamRosterTables } from './sqliteMigrations.js';

const EMPTY_ROSTER = Object.freeze({ version: 1, teams: [] });

export function ensureTeamRosterTables(database) {
  ensureSqliteTeamRosterTables(database);
}

export function readTeamRosterSnapshot(database, snapshotKey = ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY) {
  if (!database || typeof database.prepare !== 'function') {
    return null;
  }

  try {
    const state = database
      .prepare(
        `SELECT version FROM ${TEAM_ROSTER_STATE_TABLE} WHERE snapshot_key = ?`
      )
      .get(snapshotKey);

    if (!state) {
      return null;
    }

    const teams = database
      .prepare(
        `SELECT id, legacy_team_id, name, sort_order
         FROM ${TEAM_TABLE}
         WHERE snapshot_key = ? AND active = 1
         ORDER BY sort_order ASC, name COLLATE NOCASE ASC`
      )
      .all(snapshotKey);
    const members = database
      .prepare(
        `SELECT team_id, legacy_member_id, full_name, notes, sort_order
         FROM ${TEAM_MEMBER_TABLE}
         WHERE snapshot_key = ? AND active = 1
         ORDER BY team_id ASC, sort_order ASC, full_name COLLATE NOCASE ASC`
      )
      .all(snapshotKey);

    return buildRosterSnapshot(state.version, teams, members);
  } catch {
    return null;
  }
}

export function writeTeamRosterSnapshot(
  database,
  roster,
  { snapshotKey = ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY, updatedAt } = {}
) {
  if (!database || typeof database.prepare !== 'function') {
    return;
  }

  ensureTeamRosterTables(database);

  const normalized = normalizeRosterSnapshot(roster);
  const timestamp = normalizeTimestamp(updatedAt);
  const replaceSnapshot =
    typeof database.transaction === 'function'
      ? database.transaction(() => {
          replaceTeamRosterRows(database, snapshotKey, normalized, timestamp);
        })
      : () => replaceTeamRosterRows(database, snapshotKey, normalized, timestamp);

  replaceSnapshot();
}

export function deleteTeamRosterSnapshot(database, snapshotKey = ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY) {
  if (!database || typeof database.prepare !== 'function') {
    return;
  }

  ensureTeamRosterTables(database);
  database.prepare(`DELETE FROM ${TEAM_MEMBER_TABLE} WHERE snapshot_key = ?`).run(snapshotKey);
  database.prepare(`DELETE FROM ${TEAM_TABLE} WHERE snapshot_key = ?`).run(snapshotKey);
  database.prepare(`DELETE FROM ${TEAM_ROSTER_STATE_TABLE} WHERE snapshot_key = ?`).run(snapshotKey);
}

function replaceTeamRosterRows(database, snapshotKey, roster, updatedAt) {
  deleteTeamRosterSnapshot(database, snapshotKey);

  const insertTeam = database.prepare(
    `INSERT INTO ${TEAM_TABLE}
      (id, snapshot_key, legacy_team_id, name, sort_order, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMember = database.prepare(
    `INSERT INTO ${TEAM_MEMBER_TABLE}
      (id, team_id, snapshot_key, legacy_member_id, full_name, notes, sort_order, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let teamCount = 0;
  let memberCount = 0;

  roster.teams.forEach((team, teamIndex) => {
    const teamRowId = buildTeamRowId(teamIndex);
    insertTeam.run(
      teamRowId,
      snapshotKey,
      normalizeText(team.id),
      normalizeText(team.name) || `Team ${teamIndex + 1}`,
      teamIndex,
      1,
      updatedAt
    );
    teamCount += 1;

    team.members.forEach((member, memberIndex) => {
      insertMember.run(
        buildMemberRowId(teamIndex, memberIndex),
        teamRowId,
        snapshotKey,
        normalizeText(member.id),
        normalizeText(member.name),
        normalizeText(member.notes),
        memberIndex,
        1,
        updatedAt
      );
      memberCount += 1;
    });
  });

  database
    .prepare(
      `INSERT INTO ${TEAM_ROSTER_STATE_TABLE}
        (snapshot_key, version, team_count, member_count, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(snapshot_key) DO UPDATE SET
          version = excluded.version,
          team_count = excluded.team_count,
          member_count = excluded.member_count,
          updated_at = excluded.updated_at`
    )
    .run(snapshotKey, roster.version, teamCount, memberCount, updatedAt);
}

function buildRosterSnapshot(versionInput, teams, members) {
  const version = toPositiveInt(versionInput, 1);
  const memberMap = new Map();

  members.forEach((row) => {
    if (!row || typeof row !== 'object') {
      return;
    }

    const teamId = normalizeText(row.team_id);
    const fullName = normalizeText(row.full_name);
    if (!teamId || !fullName) {
      return;
    }

    const entry = { name: fullName };
    const memberId = normalizeText(row.legacy_member_id);
    const notes = normalizeText(row.notes);
    if (memberId) {
      entry.id = memberId;
    }
    if (notes) {
      entry.notes = notes;
    }

    const items = memberMap.get(teamId) || [];
    items.push(entry);
    memberMap.set(teamId, items);
  });

  const rosterTeams = teams
    .map((row, index) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const teamRowId = normalizeText(row.id);
      const name = normalizeText(row.name) || `Team ${index + 1}`;
      if (!teamRowId) {
        return null;
      }

      const entry = {
        name,
        members: memberMap.get(teamRowId) || [],
      };
      const legacyTeamId = normalizeText(row.legacy_team_id);
      if (legacyTeamId) {
        entry.id = legacyTeamId;
      }
      return entry;
    })
    .filter(Boolean);

  return {
    version,
    teams: rosterTeams,
  };
}

function normalizeRosterSnapshot(input) {
  const teamsInput = Array.isArray(input?.teams) ? input.teams : Array.isArray(input) ? input : [];
  const teams = teamsInput
    .map((team, index) => normalizeTeamSnapshot(team, index))
    .filter(Boolean);

  return {
    version: 1,
    teams,
  };
}

function normalizeTeamSnapshot(input, teamIndex) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const name = normalizeText(input.name) || `Team ${teamIndex + 1}`;
  const membersInput = Array.isArray(input.members) ? input.members : [];
  const members = membersInput
    .map((member) => normalizeMemberSnapshot(member))
    .filter(Boolean);

  return {
    id: normalizeText(input.id),
    name,
    members,
  };
}

function normalizeMemberSnapshot(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const name = normalizeText(input.name);
  if (!name) {
    return null;
  }

  const normalized = { name };
  const memberId = normalizeText(input.id);
  const notes = normalizeText(input.notes);
  if (memberId) {
    normalized.id = memberId;
  }
  if (notes) {
    normalized.notes = notes;
  }
  return normalized;
}

function buildTeamRowId(index) {
  return `team-row-${index + 1}`;
}

function buildMemberRowId(teamIndex, memberIndex) {
  return `team-row-${teamIndex + 1}-member-row-${memberIndex + 1}`;
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeTimestamp(value) {
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

function toPositiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) {
    return fallback;
  }
  return Math.trunc(number);
}

export function createEmptyTeamRosterSnapshot() {
  return structuredClone(EMPTY_ROSTER);
}
