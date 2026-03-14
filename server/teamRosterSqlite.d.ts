export const TEAM_ROSTER_STATE_TABLE: string;
export const TEAM_TABLE: string;
export const TEAM_MEMBER_TABLE: string;
export const ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY: string;

type SqliteStatementLike = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
};

type SqliteDatabaseLike = {
  exec(sql: string): unknown;
  prepare(sql: string): SqliteStatementLike;
  transaction?<T extends (...args: never[]) => unknown>(fn: T): T;
};

export type TeamRosterSnapshotMember = {
  id?: string;
  name: string;
  notes?: string;
};

export type TeamRosterSnapshotTeam = {
  id?: string;
  name: string;
  members: TeamRosterSnapshotMember[];
};

export type TeamRosterSnapshot = {
  version: 1;
  teams: TeamRosterSnapshotTeam[];
};

export function ensureTeamRosterTables(database: SqliteDatabaseLike | null | undefined): void;

export function readTeamRosterSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): TeamRosterSnapshot | null;

export function writeTeamRosterSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  roster: unknown,
  options?: {
    snapshotKey?: string;
    updatedAt?: string;
  }
): void;

export function deleteTeamRosterSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): void;

export function createEmptyTeamRosterSnapshot(): TeamRosterSnapshot;
