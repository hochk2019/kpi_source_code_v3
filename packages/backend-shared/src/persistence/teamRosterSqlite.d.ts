export const TEAM_ROSTER_STATE_TABLE: string;
export const TEAM_TABLE: string;
export const TEAM_MEMBER_TABLE: string;
export const ACTIVE_TEAM_ROSTER_SNAPSHOT_KEY: string;

export function ensureTeamRosterTables(database: unknown): void;

export function readTeamRosterSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown> | null;

export function writeTeamRosterSnapshot(
  database: unknown,
  roster: Record<string, unknown>,
  options?: { snapshotKey?: string; updatedAt?: string },
): void;

export function deleteTeamRosterSnapshot(
  database: unknown,
  snapshotKey?: string,
): void;

export function createEmptyTeamRosterSnapshot(): { version: number; teams: never[] };
