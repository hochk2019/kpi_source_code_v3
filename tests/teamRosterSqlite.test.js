import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import {
  deleteTeamRosterSnapshot,
  ensureTeamRosterTables,
  readTeamRosterSnapshot,
  writeTeamRosterSnapshot,
} from '../server/teamRosterSqlite.js';

describe('teamRosterSqlite', () => {
  it('writes and restores typed roster snapshots while preserving legacy ids only when provided', () => {
    const db = new Database(':memory:');
    ensureTeamRosterTables(db);

    expect(readTeamRosterSnapshot(db)).toBeNull();

    writeTeamRosterSnapshot(db, {
      version: 7,
      teams: [
        {
          name: 'Blue Team',
          members: [{ name: 'Lan' }, { id: 'custom-member', name: 'Minh', notes: 'Lead' }],
        },
      ],
    });

    expect(
      db.prepare('SELECT legacy_team_id, name, sort_order FROM teams ORDER BY sort_order ASC').all()
    ).toEqual([{ legacy_team_id: '', name: 'Blue Team', sort_order: 0 }]);
    expect(
      db
        .prepare(
          'SELECT legacy_member_id, full_name, notes, sort_order FROM team_members ORDER BY sort_order ASC'
        )
        .all()
    ).toEqual([
      { legacy_member_id: '', full_name: 'Lan', notes: '', sort_order: 0 },
      { legacy_member_id: 'custom-member', full_name: 'Minh', notes: 'Lead', sort_order: 1 },
    ]);
    expect(readTeamRosterSnapshot(db)).toEqual({
      version: 1,
      teams: [
        {
          name: 'Blue Team',
          members: [{ name: 'Lan' }, { id: 'custom-member', name: 'Minh', notes: 'Lead' }],
        },
      ],
    });

    db.close();
  });

  it('clears the snapshot tables when the roster is deleted', () => {
    const db = new Database(':memory:');

    writeTeamRosterSnapshot(db, {
      version: 1,
      teams: [{ id: 'blue', name: 'Blue Team', members: [{ id: 'lan', name: 'Lan' }] }],
    });
    deleteTeamRosterSnapshot(db);

    expect(readTeamRosterSnapshot(db)).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS total FROM teams').get()).toEqual({ total: 0 });
    expect(db.prepare('SELECT COUNT(*) AS total FROM team_members').get()).toEqual({ total: 0 });

    db.close();
  });
});
