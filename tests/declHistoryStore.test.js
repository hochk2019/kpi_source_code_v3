import { describe, expect, it } from 'vitest';

import {
  DECL_HISTORY_KEY,
  createDeclHistoryStore,
} from '@/lib/declHistory.js';

function createHarness(options = {}) {
  const storage = new Map();
  const normalizeStr = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const safeParse = (json, fallback) => {
    try {
      const value = JSON.parse(json);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };
  const getItem = (key) => (storage.has(key) ? storage.get(key) : null);
  const setItem = (key, value) => {
    storage.set(key, String(value));
    return Promise.resolve();
  };

  return {
    getItem,
    setRawStore(store) {
      setItem(DECL_HISTORY_KEY, JSON.stringify(store));
    },
    store: createDeclHistoryStore({
      getItem,
      setItem,
      normalizeStr,
      safeParse,
      ...options,
    }),
  };
}

describe('createDeclHistoryStore', () => {
  it('groups declaration history changes by resolved field', () => {
    const harness = createHarness();

    expect(
      harness.store.buildDeclHistoryChanges(
        {
          dai_ly: ' Đại lý A ',
          licenses: 1,
          nhan_vien: '',
        },
        {
          agency: 'Đại lý B',
          licenseManualCount: 2,
          nhan_vien: ' Nguyễn Văn A ',
        },
        ['dai_ly', 'licenseManualCount', 'nhan_vien', 'licenses'],
      ),
    ).toEqual([
      { field: 'agency', before: 'Đại lý A', after: 'Đại lý B' },
      { field: 'licenses', before: '1', after: '2' },
      { field: 'nhan_vien', before: '', after: 'Nguyễn Văn A' },
    ]);
  });

  it('normalizes persisted history entries and reads them back by trimmed row key', () => {
    const harness = createHarness();

    const entry = harness.store.appendDeclHistoryEntry(' row-1 ', {
      actor: ' tester ',
      ts: '2024-05-01T10:30:00.000Z',
      changes: [
        { field: 'dai_ly', before: ' Đại lý A ', after: ' Đại lý B ' },
        { field: 'licenses', before: 1, after: '2' },
      ],
    });

    expect(entry).toMatchObject({
      actor: 'tester',
      ts: '2024-05-01T10:30:00.000Z',
      changes: [
        { field: 'agency', before: 'Đại lý A', after: 'Đại lý B' },
        { field: 'licenses', before: '1', after: '2' },
      ],
    });
    expect(entry.id).toMatch(/^decl-row-1-/);
    expect(harness.store.getDeclHistoryForRow('row-1', 10)).toEqual([entry]);
    expect(JSON.parse(harness.getItem(DECL_HISTORY_KEY) || '{}')).toEqual({
      rows: {
        'row-1': [entry],
      },
    });
  });

  it('keeps newest entries first and enforces the per-row limit', () => {
    const harness = createHarness({ perRowLimit: 2 });

    harness.store.appendDeclHistoryEntry('row-1', {
      actor: 'alpha',
      ts: '2024-05-01T08:00:00.000Z',
      changes: [{ field: 'team', before: '', after: 'A' }],
    });
    harness.store.appendDeclHistoryEntry('row-1', {
      actor: 'beta',
      ts: '2024-05-02T08:00:00.000Z',
      changes: [{ field: 'team', before: 'A', after: 'B' }],
    });
    harness.store.appendDeclHistoryEntry('row-1', {
      actor: 'gamma',
      ts: '2024-05-03T08:00:00.000Z',
      changes: [{ field: 'team', before: 'B', after: 'C' }],
    });

    const history = harness.store.getDeclHistoryForRow('row-1', 10);
    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.actor)).toEqual(['gamma', 'beta']);
    expect(history[0].changes[0]).toMatchObject({
      field: 'team',
      before: 'B',
      after: 'C',
    });
  });

  it('drops oldest row buckets when total tracked rows exceed the configured limit', () => {
    const harness = createHarness({ maxRows: 2 });

    harness.store.appendDeclHistoryEntry('row-1', {
      actor: 'alpha',
      ts: '2024-05-01T08:00:00.000Z',
      changes: [{ field: 'team', before: '', after: 'A' }],
    });
    harness.store.appendDeclHistoryEntry('row-2', {
      actor: 'beta',
      ts: '2024-05-02T08:00:00.000Z',
      changes: [{ field: 'team', before: '', after: 'B' }],
    });
    harness.store.appendDeclHistoryEntry('row-3', {
      actor: 'gamma',
      ts: '2024-05-03T08:00:00.000Z',
      changes: [{ field: 'team', before: '', after: 'C' }],
    });

    expect(harness.store.getDeclHistoryForRow('row-1', 10)).toEqual([]);
    expect(harness.store.getDeclHistoryForRow('row-2', 10)).toHaveLength(1);
    expect(harness.store.getDeclHistoryForRow('row-3', 10)).toHaveLength(1);
    expect(Object.keys(JSON.parse(harness.getItem(DECL_HISTORY_KEY) || '{}').rows)).toEqual([
      'row-2',
      'row-3',
    ]);
  });
});
