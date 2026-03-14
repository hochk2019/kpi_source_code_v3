import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  deleteAdjustmentRowsSnapshot,
  deleteDeclarationRowsSnapshot,
  deleteMstAssignmentRowsSnapshot,
  deleteRuleCollectionSnapshot,
  readAdjustmentRowsSnapshot,
  readDeclarationRowsSnapshot,
  readMstAssignmentRowsSnapshot,
  readRuleCollectionSnapshot,
  writeAdjustmentRowsSnapshot,
  writeDeclarationRowsSnapshot,
  writeMstAssignmentRowsSnapshot,
  writeRuleCollectionSnapshot,
} from '../server/businessSnapshotSqlite.js';

describe('businessSnapshotSqlite', () => {
  let db;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('writes and restores declaration snapshots', () => {
    db = new Database(':memory:');

    expect(readDeclarationRowsSnapshot(db)).toBeNull();

    const rows = [
      { so_tk: '12345ABC', nhanh: 'Chi nhanh A', mst: '0101234567-1', date: '2026/02/14', ma_loai_hinh: 'A11' },
      { so_tk_full: '00000012346-X', nhanh: 'Chi nhanh B', mst: '0207654321', date: '2026-02-15', ma_loai_hinh: 'E11' },
    ];

    writeDeclarationRowsSnapshot(db, rows, { updatedAt: '2026-03-12T00:00:00.000Z' });

    expect(readDeclarationRowsSnapshot(db)).toEqual(rows);
  });

  it('writes and restores MST assignment snapshots', () => {
    db = new Database(':memory:');

    expect(readMstAssignmentRowsSnapshot(db)).toBeNull();

    const rows = [
      {
        mst: '0101234567',
        company: 'Cong ty A',
        person_import: 'Lan',
        person_export: '',
        team: 'Blue Team',
        effective_from: '2026-01-01',
        effective_to: '2026-01-31',
      },
      {
        mst: '0101234567',
        company: 'Cong ty A',
        person_import: 'Minh',
        person_export: 'Bao',
        team: 'Blue Team',
        effective_from: '2026-02-01',
        effective_to: '',
      },
    ];

    writeMstAssignmentRowsSnapshot(db, rows, { updatedAt: '2026-03-12T00:00:00.000Z' });

    expect(readMstAssignmentRowsSnapshot(db)).toEqual(rows);
  });

  it('writes and restores KPI rule collection snapshots', () => {
    db = new Database(':memory:');

    expect(readRuleCollectionSnapshot(db)).toBeNull();

    const collection = {
      version: 2,
      activeId: 'legacy-kpi',
      sets: [
        {
          id: 'legacy-kpi',
          name: 'Legacy KPI',
          description: 'Rule set imported from legacy storage',
          groups: {
            group1: {
              key: 'group1',
              title: 'Nhóm 1',
              description: 'Legacy group',
              codes: ['A11'],
              base: 0.5,
              perItem: 0.2,
              tierMode: 'per_item',
              tiers: [],
            },
          },
          license: {
            defaultPoints: 0.3,
            codePoints: [],
            exclude: {
              codes: [],
              agencies: [],
            },
          },
          bonuses: {
            co: {
              enabled: true,
              label: 'C/O',
              points: 0.1,
              perLine: 0.01,
            },
          },
        },
      ],
    };

    writeRuleCollectionSnapshot(db, collection, { updatedAt: '2026-03-12T00:00:00.000Z' });

    expect(readRuleCollectionSnapshot(db)).toEqual(collection);
  });

  it('writes and restores KPI adjustment snapshots', () => {
    db = new Database(':memory:');

    expect(readAdjustmentRowsSnapshot(db)).toBeNull();

    const rows = [
      {
        id: 'adj-reporting-1',
        category: 'support_fixed',
        month: '2026-02',
        staffName: 'Lan',
        teamName: 'Blue Team',
        quantity: 1,
        unitPoints: 2,
        totalPoints: 2,
        status: 'approved',
      },
    ];

    writeAdjustmentRowsSnapshot(db, rows, { updatedAt: '2026-03-12T00:00:00.000Z' });

    expect(readAdjustmentRowsSnapshot(db)).toEqual(rows);
  });

  it('deletes stored typed snapshots by domain', () => {
    db = new Database(':memory:');

    writeDeclarationRowsSnapshot(db, [{ so_tk: 'TK1' }]);
    writeMstAssignmentRowsSnapshot(db, [{ mst: '0101234567' }]);
    writeRuleCollectionSnapshot(db, { version: 2, activeId: 'legacy-kpi', sets: [{ id: 'legacy-kpi', name: 'Legacy KPI' }] });
    writeAdjustmentRowsSnapshot(db, [{ id: 'adj-1', totalPoints: 1 }]);

    deleteDeclarationRowsSnapshot(db);
    deleteMstAssignmentRowsSnapshot(db);
    deleteRuleCollectionSnapshot(db);
    deleteAdjustmentRowsSnapshot(db);

    expect(readDeclarationRowsSnapshot(db)).toBeNull();
    expect(readMstAssignmentRowsSnapshot(db)).toBeNull();
    expect(readRuleCollectionSnapshot(db)).toBeNull();
    expect(readAdjustmentRowsSnapshot(db)).toBeNull();
  });
});
