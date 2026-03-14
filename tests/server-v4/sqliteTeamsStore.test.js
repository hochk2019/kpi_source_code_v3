import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { readTeamRosterSnapshot } from '../../server/teamRosterSqlite.js';
import { SqliteTeamsStore } from '../../server-v4/src/modules/teams/sqliteTeamsStore.ts';

const tempFiles = [];

afterEach(() => {
  while (tempFiles.length > 0) {
    const file = tempFiles.pop();
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
});

describe('SqliteTeamsStore', () => {
  it('writes the canonical roster to typed snapshot tables and kv_store, replacing prior rows', async () => {
    const dbFile = createRuntimeDb();
    const store = new SqliteTeamsStore(dbFile);

    await expect(
      store.writeRoster({
        version: 1,
        teams: [
          {
            name: 'Blue Team',
            members: [
              { name: 'Minh', notes: 'Lead' },
              { id: 'custom-member', name: 'Lan' },
            ],
          },
          {
            id: 'ops',
            name: 'Operations',
            members: [{ name: 'Dung' }],
          },
        ],
      }),
    ).resolves.toEqual({
      version: 1,
      teams: [
        {
          id: 'team-blue-team',
          name: 'Blue Team',
          members: [
            { id: 'custom-member', name: 'Lan' },
            { id: 'team-blue-team-minh', name: 'Minh', notes: 'Lead' },
          ],
        },
        {
          id: 'team-ops',
          name: 'Operations',
          members: [{ id: 'team-ops-dung', name: 'Dung' }],
        },
      ],
    });

    let database = new Database(dbFile);
    expect(readTeamRosterSnapshot(database)).toEqual({
      version: 1,
      teams: [
        {
          id: 'team-blue-team',
          name: 'Blue Team',
          members: [
            { id: 'custom-member', name: 'Lan' },
            { id: 'team-blue-team-minh', name: 'Minh', notes: 'Lead' },
          ],
        },
        {
          id: 'team-ops',
          name: 'Operations',
          members: [{ id: 'team-ops-dung', name: 'Dung' }],
        },
      ],
    });
    expect(readStoredRoster(database)).toEqual({
      version: 1,
      teams: [
        {
          id: 'team-blue-team',
          name: 'Blue Team',
          members: [
            { id: 'custom-member', name: 'Lan' },
            { id: 'team-blue-team-minh', name: 'Minh', notes: 'Lead' },
          ],
        },
        {
          id: 'team-ops',
          name: 'Operations',
          members: [{ id: 'team-ops-dung', name: 'Dung' }],
        },
      ],
    });
    database.close();

    await store.writeRoster({
      version: 1,
      teams: [
        {
          id: 'ops',
          name: 'Operations',
          members: [{ name: 'Dung' }],
        },
      ],
    });

    database = new Database(dbFile);
    expect(readTeamRosterSnapshot(database)).toEqual({
      version: 1,
      teams: [
        {
          id: 'team-ops',
          name: 'Operations',
          members: [{ id: 'team-ops-dung', name: 'Dung' }],
        },
      ],
    });
    expect(readStoredRoster(database)).toEqual({
      version: 1,
      teams: [
        {
          id: 'team-ops',
          name: 'Operations',
          members: [{ id: 'team-ops-dung', name: 'Dung' }],
        },
      ],
    });
    expect(database.prepare('SELECT COUNT(*) AS count FROM teams WHERE snapshot_key = ?').get('active').count).toBe(1);
    expect(database.prepare('SELECT COUNT(*) AS count FROM team_members WHERE snapshot_key = ?').get('active').count).toBe(1);
    database.close();
  });
});

function createRuntimeDb() {
  const dbFile = path.join(
    os.tmpdir(),
    `server-v4-teams-store-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`,
  );
  const database = new Database(dbFile);
  database.close();
  tempFiles.push(dbFile);
  return dbFile;
}

function readStoredRoster(database) {
  const row = database.prepare('SELECT value FROM kv_store WHERE key = ?').get('team_roster_v1');
  return row?.value ? JSON.parse(row.value) : null;
}
