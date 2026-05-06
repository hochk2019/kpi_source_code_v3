import { describe, expect, it } from 'vitest';

import {
  HQ_HISTORY_LIMIT,
  createHQAgencyStore,
} from '@/lib/hqAgencies.js';

function createHarness() {
  const storage = new Map();
  const auditLogs = [];
  const mstRows = [];
  let declRows = [];
  const mstSyncCalls = [];
  const declSaveCalls = [];

  const normalizeStr = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const normalizeMST = (value) => String(value ?? '').replace(/\D/g, '');
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
  const pushAuditLog = (entry) => {
    auditLogs.unshift(entry);
  };
  const getMSTMap = () => mstRows.map((row) => ({ ...row }));
  const upsertMSTRows = (rows, options = {}) => {
    mstSyncCalls.push({ rows, options });
    mstRows.splice(0, mstRows.length, ...rows.map((row) => ({ ...row })));
    return mstRows;
  };
  const getDeclRows = () => declRows.map((row) => ({ ...row }));
  const saveDeclRows = (rows, options = {}) => {
    declSaveCalls.push({ rows, options });
    declRows = rows.map((row) => ({ ...row }));
    return declRows;
  };

  return {
    auditLogs,
    declSaveCalls,
    getDeclRows,
    getItem,
    mstRows,
    mstSyncCalls,
    setDeclRows(nextRows) {
      declRows = nextRows.map((row) => ({ ...row }));
    },
    storage,
    store: createHQAgencyStore({
      getItem,
      setItem,
      pushAuditLog,
      normalizeStr,
      normalizeMST,
      safeParse,
      getMSTMap,
      upsertMSTRows,
      getDeclRows,
      saveDeclRows,
    }),
  };
}

describe('createHQAgencyStore', () => {
  it('normalizes and merges agency rows while recording history', async () => {
    const harness = createHarness();

    const storedCount = await harness.store.upsertHQAgencies(
      [
        { mst: '010-123-4567', company: '  Công ty A  ', agent: 'FCL' },
        { mst: '0101234567', company: 'Công ty A cập nhật', agent: ' Air ' },
      ],
      { actor: 'tester' },
    );

    expect(storedCount).toBe(1);
    expect(JSON.parse(harness.getItem('hq_agencies_v1') || '[]')).toEqual([
      {
        mst: '0101234567',
        company: 'Công ty A cập nhật',
        agent: 'FCL, Air',
        agents: ['FCL', 'Air'],
      },
    ]);

    const history = harness.store.getHQHistoryForMST('0101234567', HQ_HISTORY_LIMIT);
    expect(history.some((entry) => entry.type === 'create' && entry.field === 'company')).toBe(true);
    expect(history.some((entry) => entry.type === 'create' && entry.field === 'agents')).toBe(true);
    expect(harness.auditLogs[0]).toMatchObject({
      actor: 'tester',
      action: 'hq.save',
    });
  });

  it('syncs company and agency metadata into MST rows and declarations', async () => {
    const harness = createHarness();
    harness.mstRows.push({
      mst: '0101234567',
      company: 'Tên cũ',
      person_import: '',
      person_export: '',
      team: '',
    });
    harness.setDeclRows([
      { so_tk: 'TK01', mst: '0101234567', cong_ty: 'Tên cũ' },
    ]);

    await harness.store.upsertHQAgencies(
      [{ mst: '0101234567', company: 'Công ty Golden', agent: 'FCL' }],
      { actor: 'tester' },
    );

    expect(harness.mstSyncCalls).toHaveLength(1);
    expect(harness.mstRows[0].company).toBe('Công ty Golden');
    expect(harness.declSaveCalls).toHaveLength(1);
    expect(harness.getDeclRows()[0]).toMatchObject({
      cong_ty: 'Công ty Golden',
      customer: 'Công ty Golden',
      agency: 'FCL',
      dai_ly: 'FCL',
      dai_ly_hq: 'FCL',
      agents: ['FCL'],
    });
  });

  it('updates then deletes a row through save/delete helpers', async () => {
    const harness = createHarness();

    await harness.store.upsertHQAgencies(
      [{ mst: '0101234567', company: 'Công ty A', agent: 'FCL' }],
      { actor: 'seed' },
    );

    const saved = await harness.store.saveHQAgencyRow(
      {
        mst: '0101234567',
        company: 'Công ty B',
        agents: ['Sea', 'Road'],
      },
      { actor: 'editor', previousMst: '0101234567' },
    );

    expect(saved).toMatchObject({
      mst: '0101234567',
      company: 'Công ty B',
      agent: 'Sea, Road',
      agents: ['Sea', 'Road'],
    });

    expect(await harness.store.deleteHQAgencyRow('0101234567', { actor: 'editor' })).toBe(1);
    expect(harness.store.getHQAgencies()).toEqual([]);

    const history = harness.store.getHQHistoryForMST('0101234567', HQ_HISTORY_LIMIT);
    expect(history.some((entry) => entry.type === 'delete' && entry.field === 'company')).toBe(true);
    expect(history.some((entry) => entry.type === 'delete' && entry.field === 'agents')).toBe(true);
  });
});
