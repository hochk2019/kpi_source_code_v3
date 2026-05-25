import { describe, expect, it } from 'vitest';

import {
  MST_ASSIGNMENT_STATUS,
  createMSTAssignmentStore,
} from '@/lib/mstAssignments.js';

function createHarness() {
  const storage = new Map();
  const auditLogs = [];

  const normalizeStr = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const normalizeName = (value) => normalizeStr(value).toLowerCase();
  const normalizeMST = (value) => String(value ?? '').replace(/\D/g, '');
  const safeParse = (json, fallback) => {
    try {
      const value = JSON.parse(json);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };
  const toISODate = (value) => {
    const text = normalizeStr(value);
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if (slashMatch) {
      return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  };
  const pickFirstValue = (source, keys, fallback) => {
    const record = source && typeof source === 'object' ? source : {};
    for (const key of keys) {
      if (!(key in record)) continue;
      const value = record[key];
      if (value !== undefined && value !== null && `${value}`.trim() !== '') {
        return value;
      }
    }
    return fallback;
  };
  const getItem = (key) => (storage.has(key) ? storage.get(key) : null);
  const setItem = (key, value) => {
    storage.set(key, String(value));
    return Promise.resolve();
  };
  const removeItem = (key) => {
    storage.delete(key);
    return Promise.resolve();
  };
  const pushAuditLog = (entry) => {
    auditLogs.unshift(entry);
  };

  return {
    auditLogs,
    getItem,
    removeItem,
    setItem,
    storage,
    store: createMSTAssignmentStore({
      getItem,
      setItem,
      removeItem,
      pushAuditLog,
      normalizeStr,
      normalizeMST,
      normalizeName,
      toISODate,
      pickFirstValue,
      safeParse,
    }),
  };
}

describe('createMSTAssignmentStore', () => {
  it('migrates legacy MST rows on first read and writes an audit log', async () => {
    const harness = createHarness();
    const legacyRows = [
      {
        mst: '0101234567',
        company: 'ACME Legacy',
        person_import: 'Nguyễn Văn A',
        effective_from: '2024-09-01',
      },
    ];

    const legacyKey = 'mst_rows_v1';
    const currentKey = 'mst_rows_v2';
    const setLegacy = JSON.stringify(legacyRows);

    expect(harness.getItem(legacyKey)).toBeNull();
    harness.setItem(legacyKey, setLegacy);

    harness.store.getMSTMap(); // trigger async migration
    await new Promise((r) => setTimeout(r, 0)); // flush microtask queue

    const rows = harness.store.getMSTMap();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mst: '0101234567',
      company: 'ACME Legacy',
      person_import: 'Nguyễn Văn A',
      status: MST_ASSIGNMENT_STATUS.PENDING,
    });
    expect(harness.getItem(currentKey)).not.toBeNull();
    expect(harness.getItem(legacyKey)).toBeNull();
    expect(harness.auditLogs[0]).toMatchObject({
      action: 'mst.migrate.v1-v2',
      actor: 'system',
    });
  });

  it('updates a row, records history, and rejects no-op saves', async () => {
    const { store } = createHarness();

    await store.upsertMSTRows(
      [
        {
          mst: '0101234567',
          company: 'ACME',
          person_import: 'Trần A',
          person_export: '',
          team: '',
          effective_from: '2024-09-01',
          status: MST_ASSIGNMENT_STATUS.PENDING,
        },
      ],
      { actor: 'seed' },
    );

    const result = await store.saveMSTRow(
      {
        mst: '0101234567',
        company: 'ACME Logistics',
        person_import: 'Nguyễn Văn A',
        person_export: 'Lê B',
        team: 'Team 1',
        effective_from: '2024-09-01',
        status: MST_ASSIGNMENT_STATUS.ASSIGNED,
      },
      { actor: 'tester', originalKey: '0101234567__2024-09-01__' },
    );

    expect(result).toMatchObject({
      ok: true,
      key: '0101234567__2024-09-01__',
      previousKey: '0101234567__2024-09-01__',
    });
    expect(store.getMSTMap()[0]).toMatchObject({
      company: 'ACME Logistics',
      person_import: 'Nguyễn Văn A',
      person_export: 'Lê B',
      team: 'Team 1',
      status: MST_ASSIGNMENT_STATUS.ASSIGNED,
    });

    const history = store.getMSTHistoryFor('0101234567', 10);
    expect(history.some((entry) => entry.field === 'person_import' && entry.to === 'Nguyễn Văn A')).toBe(true);
    expect(history.some((entry) => entry.field === 'person_export' && entry.to === 'Lê B')).toBe(true);

    const noChange = await store.saveMSTRow(
      {
        mst: '0101234567',
        company: 'ACME Logistics',
        person_import: 'Nguyễn Văn A',
        person_export: 'Lê B',
        team: 'Team 1',
        effective_from: '2024-09-01',
        status: MST_ASSIGNMENT_STATUS.ASSIGNED,
      },
      { actor: 'tester', originalKey: '0101234567__2024-09-01__' },
    );

    expect(noChange).toMatchObject({
      ok: false,
      reason: 'no-change',
    });
  });

  it('resolves the effective row for a target date', async () => {
    const { store } = createHarness();

    await store.upsertMSTRows(
      [
        {
          mst: '2301158516',
          company: 'Future Logistics',
          person_import: 'Old Owner',
          effective_from: '2024-01-01',
          effective_to: '2024-08-31',
        },
        {
          mst: '2301158516',
          company: 'Future Logistics',
          person_import: 'Current Owner',
          effective_from: '2024-09-01',
        },
      ],
      { actor: 'seed' },
    );

    expect(store.getMSTFor('2301158516', '2024-08-31')?.person_import).toBe('Old Owner');
    expect(store.getMSTFor('2301158516', '2024-09-15')?.person_import).toBe('Current Owner');
    expect(store.getMSTFor('2301158516')?.person_import).toBe('Current Owner');
  });
});
