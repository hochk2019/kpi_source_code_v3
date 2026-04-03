import { describe, expect, it } from 'vitest';

import { createTeamRosterStore } from '@/lib/teamRoster.js';

function createTeamRosterHarness(initialValue = null) {
  const storage = new Map();
  const listeners = new Map();
  const auditEntries = [];

  if (initialValue !== null) {
    storage.set('team_test_key', initialValue);
  }

  const getItem = (key) => (storage.has(key) ? storage.get(key) : null);
  const setItem = (key, value) => {
    storage.set(key, value);
    const keyListeners = listeners.get(key);
    if (!keyListeners) return;
    for (const listener of keyListeners) {
      listener();
    }
  };
  const subscribe = (key, listener) => {
    const keyListeners = listeners.get(key) ?? new Set();
    keyListeners.add(listener);
    listeners.set(key, keyListeners);
    return () => {
      keyListeners.delete(listener);
      if (!keyListeners.size) {
        listeners.delete(key);
      }
    };
  };
  const safeParse = (json, fallback) => {
    try {
      const value = JSON.parse(json);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };
  const normalizeStr = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const stripDiacritics = (value) =>
    normalizeStr(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  const normalizeName = (value) => stripDiacritics(value).toLowerCase();
  const sanitizeMSTRow = (row) => {
    const record = row && typeof row === 'object' ? row : null;
    const mst = normalizeStr(record?.mst);
    if (!mst) return null;
    return {
      mst,
      company: normalizeStr(record?.company),
      person_import: normalizeStr(record?.person_import),
      person_export: normalizeStr(record?.person_export),
      team: normalizeStr(record?.team),
      effective_from: normalizeStr(record?.effective_from),
      effective_to: normalizeStr(record?.effective_to),
      status: normalizeStr(record?.status),
    };
  };

  const store = createTeamRosterStore({
    getItem,
    setItem,
    subscribe,
    pushAuditLog: (entry) => auditEntries.push(entry),
    safeParse,
    normalizeStr,
    stripDiacritics,
    normalizeName,
    sanitizeMSTRow,
    teamKey: 'team_test_key',
  });

  return { storage, auditEntries, normalizeName, store };
}

describe('teamRosterStore', () => {
  it('seeds the default roster when storage is empty', () => {
    const { storage, store } = createTeamRosterHarness();

    const roster = store.getTeamRoster();

    expect(roster.teams).toHaveLength(3);
    expect(JSON.parse(storage.get('team_test_key'))).toMatchObject({
      version: 1,
      teams: expect.arrayContaining([
        expect.objectContaining({ name: 'Team 1' }),
      ]),
    });
  });

  it('normalizes team and member ids when saving the roster', () => {
    const { auditEntries, normalizeName, store } = createTeamRosterHarness();

    const saved = store.setTeamRoster({
      teams: [
        {
          id: 'custom-team',
          name: '  Team X  ',
          members: [
            { id: '', name: '  Nguyen Van A  ' },
            { name: 'Nguyen Van B' },
          ],
        },
      ],
    });

    expect(saved.teams).toHaveLength(1);
    expect(saved.teams[0]).toMatchObject({
      name: 'Team X',
      members: expect.arrayContaining([
        expect.objectContaining({ name: 'Nguyen Van A' }),
        expect.objectContaining({ name: 'Nguyen Van B' }),
      ]),
    });
    expect(saved.teams[0].id).toMatch(/^team-/);

    const firstMember = saved.teams[0].members.find(
      (member) => normalizeName(member.name) === normalizeName('Nguyen Van A'),
    );
    const secondMember = saved.teams[0].members.find(
      (member) => normalizeName(member.name) === normalizeName('Nguyen Van B'),
    );
    expect(firstMember?.id).toMatch(/^team-/);
    expect(secondMember?.id).toMatch(/^team-/);
    expect(firstMember?.id).not.toBe(secondMember?.id);
    expect(auditEntries).toContainEqual(
      expect.objectContaining({ action: 'team.save', actor: 'system' }),
    );
  });

  it('maps member names accent-insensitively', () => {
    const { normalizeName, store } = createTeamRosterHarness();

    const roster = store.setTeamRoster({
      teams: [
        { name: 'Team 1', members: [{ name: 'H\u00f2a' }] },
      ],
    });

    const mapping = store.mapMemberNamesToTeams(roster);
    expect(mapping.get(normalizeName('HOA'))).toEqual({
      team: 'Team 1',
      name: 'H\u00f2a',
    });
  });

  it('syncs MST rows with renamed members through previous roster ids', () => {
    const { normalizeName, store } = createTeamRosterHarness();

    const baseRoster = store.setTeamRoster({
      teams: [
        { name: 'Team 1', members: [{ name: 'Phuong' }] },
      ],
    });

    const renamedRoster = store.setTeamRoster({
      teams: baseRoster.teams.map((team) => ({
        ...team,
        members: team.members.map((member) =>
          normalizeName(member.name) === normalizeName('Phuong')
            ? { ...member, name: 'Ph\u01b0\u01a1ng Nguy\u1ec5n' }
            : member,
        ),
      })),
    });

    const result = store.applyTeamRosterToMST(
      renamedRoster,
      [
        {
          mst: '555',
          company: 'Cong ty X',
          person_import: 'Phuong',
          person_export: '',
          team: 'Team 9',
        },
      ],
      { previousRoster: baseRoster },
    );

    expect(result.changed).toBe(true);
    expect(result.rows[0]).toMatchObject({
      person_import: 'Ph\u01b0\u01a1ng Nguy\u1ec5n',
      team: 'Team 1',
    });
  });

  it('emits an initial snapshot and subsequent updates to subscribers', () => {
    const { store } = createTeamRosterHarness();
    const snapshots = [];

    const unsubscribe = store.subscribeTeamRoster((snapshot) => {
      snapshots.push(snapshot);
    });

    store.setTeamRoster({
      teams: [
        { name: 'Team QA', members: [{ name: 'Lan' }] },
      ],
    });

    unsubscribe();

    expect(snapshots.length).toBeGreaterThan(1);
    expect(snapshots.at(-1)).toMatchObject({
      teams: [expect.objectContaining({ name: 'Team QA' })],
    });
  });
});
