import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DECLARATION_SNAPSHOT_DOMAIN_KEY,
  ACTIVE_BUSINESS_SNAPSHOT_KEY,
  writeDeclarationRowsSnapshot,
} from '../server/businessSnapshotSqlite.js';
import { searchDeclarationSnapshot } from '../server/declarationSnapshotSearch.js';

describe('declarationSnapshotSearch', () => {
  let db;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('filters and paginates declaration snapshots inside sqlite', () => {
    db = new Database(':memory:');
    writeDeclarationRowsSnapshot(db, [
      {
        so_tk: '111',
        so_tk_full: '00000000111-A',
        mst: '0101000001',
        date: '2026-02-14',
        cong_ty: 'Cong ty Mot',
        nhan_vien: 'Lan',
        team: 'Blue',
        agency: 'North Hub',
        status: 'approved',
        co_line_count: 2,
      },
      {
        so_tk: '222',
        so_tk_full: '00000000222-B',
        mst: '0101000002',
        date: '2026-02-15',
        company: 'Cong ty Hai',
        staff: 'Minh',
        team: 'Blue',
        agents: ['South Hub'],
        status: 'approved',
        co_count: 1,
      },
      {
        so_tk: '333',
        so_tk_full: '00000000333-C',
        mst: '0101000003',
        date: '2026-02-16',
        company: 'Cong ty Ba',
        staff: 'An',
        team: 'Red',
        agency: 'West Hub',
        status: 'pending',
      },
    ]);

    const page1 = searchDeclarationSnapshot(
      db,
      { query: 'hub', status: 'approved', coMode: 'has' },
      { page: 1, pageSize: 1 }
    );
    const page2 = searchDeclarationSnapshot(
      db,
      { query: 'hub', status: 'approved', coMode: 'has' },
      { page: 2, pageSize: 1 }
    );

    expect(page1).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 1,
    });
    expect(page1.rows).toHaveLength(1);
    expect(page1.rows[0]).toMatchObject({ mst: '0101000001' });

    expect(page2).toMatchObject({
      total: 2,
      page: 2,
      pageSize: 1,
    });
    expect(page2.rows).toHaveLength(1);
    expect(page2.rows[0]).toMatchObject({ mst: '0101000002' });
  });

  it('applies duplicate, no-staff, and deleted filters using projected columns', () => {
    db = new Database(':memory:');
    writeDeclarationRowsSnapshot(db, [
      {
        so_tk: '111',
        so_tk_full: '00000000111-A',
        mst: '0101000011',
        date: '2026-02-14',
        company: 'Cong ty Song Sinh 1',
        nhan_vien: 'Lan',
      },
      {
        so_tk: '111',
        so_tk_full: '00000000111-B',
        mst: '0101000012',
        date: '2026-02-15',
        company: 'Cong ty Song Sinh 2',
        nhan_vien: '',
        deleted_at: '2026-03-01T00:00:00.000Z',
      },
    ]);

    const includeDeleted = searchDeclarationSnapshot(db, {
      duplicate: true,
      noStaff: true,
      includeDeleted: true,
    });
    const excludeDeleted = searchDeclarationSnapshot(db, {
      duplicate: true,
      noStaff: true,
      includeDeleted: false,
    });

    expect(includeDeleted).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 50,
    });
    expect(includeDeleted.rows).toHaveLength(1);
    expect(includeDeleted.rows[0]).toMatchObject({ mst: '0101000012' });

    expect(excludeDeleted).toMatchObject({
      total: 0,
      page: 1,
      pageSize: 50,
    });
    expect(excludeDeleted.rows).toEqual([]);
  });

  it('returns null when the declaration snapshot has an outdated schema version', () => {
    db = new Database(':memory:');
    writeDeclarationRowsSnapshot(db, [
      {
        so_tk: '111',
        mst: '0101999999',
        date: '2026-02-14',
      },
    ]);

    db.prepare(
      'UPDATE business_snapshot_state SET version = 1 WHERE domain_key = ? AND snapshot_key = ?'
    ).run(DECLARATION_SNAPSHOT_DOMAIN_KEY, ACTIVE_BUSINESS_SNAPSHOT_KEY);

    expect(searchDeclarationSnapshot(db, { mst: '0101999999' })).toBeNull();
  });
});
