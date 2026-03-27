import Database from 'better-sqlite3';
import { ensureSqliteKvStore } from '../../../../server/sqliteMigrations.js';

import { writeTeamRosterSnapshot } from '../../../../server/teamRosterSqlite.js';
import { cloneTeamRoster, normalizeTeamRoster, type TeamRoster } from './teamRosterDocument.js';
import type { TeamsStore } from './teamsStore.js';

const TEAM_ROSTER_STORAGE_KEY = 'team_roster_v1';
const UPSERT_KV_VALUE_SQL =
  'INSERT INTO kv_store (key, value) VALUES (?, ?) ' +
  'ON CONFLICT(key) DO UPDATE SET value = excluded.value';

export class SqliteTeamsStore implements TeamsStore {
  constructor(private readonly dbFile: string) {}

  async writeRoster(roster: TeamRoster): Promise<TeamRoster> {
    return this.withDatabase((database) => {
      const normalized = normalizeTeamRoster(roster);
      const updatedAt = new Date().toISOString();
      const writeRoster = database.transaction(() => {
        this.ensureKvStore(database);
        writeTeamRosterSnapshot(database, normalized, { updatedAt });
        database
          .prepare(UPSERT_KV_VALUE_SQL)
          .run(TEAM_ROSTER_STORAGE_KEY, JSON.stringify(cloneTeamRoster(normalized)));
      });

      writeRoster();
      return cloneTeamRoster(normalized);
    });
  }

  private ensureKvStore(database: Database): void {
    ensureSqliteKvStore(database);
  }

  private withDatabase<T>(work: (database: Database) => T): T {
    const database = new Database(this.dbFile);

    try {
      return work(database);
    } finally {
      database.close();
    }
  }
}
