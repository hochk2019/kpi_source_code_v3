import { describe, expect, it } from 'vitest';

import { normalizeDateInput } from '../packages/domain/src/declSearch.js';
import {
  DECL_DELETED_LOG_KEY,
  DECL_DELETED_LOG_LIMIT,
  createDeclDeletedLogStore,
} from '@/lib/declDeletedLog.js';

function createHarness() {
  const storage = new Map();
  const normalizeStr = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const normalizeDeclarationNumber = (value) =>
    String(value ?? '')
      .replace(/\D/g, '')
      .trim();
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
    setRawEntries(entries) {
      setItem(DECL_DELETED_LOG_KEY, JSON.stringify(entries));
    },
    store: createDeclDeletedLogStore({
      getItem,
      setItem,
      normalizeStr,
      normalizeDeclarationNumber,
      normalizeDateInput,
      safeParse,
    }),
  };
}

describe('createDeclDeletedLogStore', () => {
  it('builds and appends normalized soft/hard deletion entries', () => {
    const harness = createHarness();

    const softEntry = harness.store.buildDeletedDeclLogEntryFromRow(
      {
        so_tk: '10000000001',
        nhanh: '01',
        mst: '0100100010',
        ten_dn: '  Công ty Ánh Dương  ',
      },
      {
        actor: 'thu.ky',
        type: 'soft',
        timestamp: '2024-05-01T09:00:00.000Z',
      },
    );
    const hardEntry = harness.store.buildDeletedDeclLogEntryFromRow(
      {
        so_tk: '10000000002',
        nhanh: '02',
        ma_so_thue: '0100100020',
        company: 'Công ty Bình Minh',
      },
      {
        actor: 'quan.ly',
        type: 'hard',
        timestamp: '2024-06-01T09:00:00.000Z',
      },
    );

    harness.store.appendDeletedDeclLogEntries([softEntry]);
    harness.store.appendDeletedDeclLogEntries([hardEntry]);

    expect(harness.store.getDeletedDeclLog()).toEqual([
      {
        so_tk: '10000000002',
        nhanh: '02',
        mst: '0100100020',
        company: 'Công ty Bình Minh',
        type: 'hard',
        deleted_at: '2024-06-01T09:00:00.000Z',
        deleted_by: 'quan.ly',
      },
      {
        so_tk: '10000000001',
        nhanh: '01',
        mst: '0100100010',
        company: 'Công ty Ánh Dương',
        type: 'soft',
        deleted_at: '2024-05-01T09:00:00.000Z',
        deleted_by: 'thu.ky',
      },
    ]);

    expect(harness.store.getDeletedDeclLog({ type: 'hard' })).toHaveLength(1);
    expect(harness.store.getDeletedDeclLog({ type: 'hard' })[0].so_tk).toBe('10000000002');
  });

  it('enforces the configured limit and keeps newest entries first', () => {
    const harness = createHarness();
    const existing = Array.from({ length: DECL_DELETED_LOG_LIMIT }, (_, index) => ({
      so_tk: String(index + 1).padStart(11, '0'),
      nhanh: '00',
      mst: `MST-${index + 1}`,
      company: `Doanh nghiệp ${index + 1}`,
      type: index % 2 === 0 ? 'soft' : 'hard',
      deleted_at: `2024-05-${String((index % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
      deleted_by: 'system',
    }));

    harness.setRawEntries(existing);
    harness.store.appendDeletedDeclLogEntries([
      harness.store.buildDeletedDeclLogEntryFromRow(
        {
          so_tk: '90000000001',
          nhanh: '01',
          mst: '0999999999',
          ten_dn: 'Công ty Giới Hạn',
        },
        {
          actor: 'tester',
          type: 'soft',
          timestamp: '2024-06-15T09:30:00.000Z',
        },
      ),
    ]);

    const stored = JSON.parse(harness.getItem(DECL_DELETED_LOG_KEY) || '[]');
    expect(stored).toHaveLength(DECL_DELETED_LOG_LIMIT);
    expect(stored[0]).toMatchObject({
      so_tk: '90000000001',
      deleted_by: 'tester',
    });
    expect(stored.some((entry) => entry.so_tk === String(DECL_DELETED_LOG_LIMIT).padStart(11, '0'))).toBe(false);
  });

  it('canonicalizes stored entries and filters by date range and delete type', () => {
    const harness = createHarness();

    harness.setRawEntries([
      {
        number: '10000000010',
        branch: '01',
        tax_code: '0101',
        ten_cong_ty: ' Doanh nghiệp A ',
        actor: 'alpha',
        type: 'soft',
        ts: '2024-05-10T09:00:00.000Z',
      },
      {
        so_tk: '10000000011',
        nhanh: '02',
        mst: '0102',
        company: 'Doanh nghiệp B',
        deleted_at: '2024-06-05T10:15:00.000Z',
        deleted_by: 'beta',
        type: 'hard',
      },
      {
        so_tk: '',
        deleted_at: '2024-07-01T11:00:00.000Z',
      },
    ]);

    const normalized = harness.store.getDeletedDeclLog();
    const hardJune = harness.store.getDeletedDeclLog({
      from: '2024-06-01',
      to: '2024-06-30',
      type: 'hard',
    });

    expect(normalized).toEqual([
      {
        so_tk: '10000000010',
        nhanh: '01',
        mst: '0101',
        company: 'Doanh nghiệp A',
        type: 'soft',
        deleted_at: '2024-05-10T09:00:00.000Z',
        deleted_by: 'alpha',
      },
      {
        so_tk: '10000000011',
        nhanh: '02',
        mst: '0102',
        company: 'Doanh nghiệp B',
        type: 'hard',
        deleted_at: '2024-06-05T10:15:00.000Z',
        deleted_by: 'beta',
      },
    ]);
    expect(hardJune).toEqual([
      {
        so_tk: '10000000011',
        nhanh: '02',
        mst: '0102',
        company: 'Doanh nghiệp B',
        type: 'hard',
        deleted_at: '2024-06-05T10:15:00.000Z',
        deleted_by: 'beta',
      },
    ]);
    expect(JSON.parse(harness.getItem(DECL_DELETED_LOG_KEY) || '[]')).toEqual(normalized);
  });
});
