import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { readDeclarationRowsSnapshot, writeDeclarationRowsSnapshot } from '../../server/businessSnapshotSqlite.js';
import {
  SQLITE_DECLARATION_LIVE_ROW_TABLE,
  readCanonicalSqliteDeclarationRows,
} from '../../server-v4/src/modules/declarations/sqliteDeclarationRowsTable.ts';
import { SqliteDeclarationsStore } from '../../server-v4/src/modules/declarations/sqliteDeclarationsStore.ts';

const tempFiles = [];

afterEach(() => {
  while (tempFiles.length > 0) {
    const file = tempFiles.pop();
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
});

describe('SqliteDeclarationsStore', () => {
  it('bootstraps canonical live rows from typed snapshots before applying row-level patches', async () => {
    const dbFile = createRuntimeDb();
    const db = new Database(dbFile);
    writeDeclarationRowsSnapshot(db, [
      {
        declaration_id: 'decl-1',
        so_tk: 'TK-001',
        nhanh: 'CN1',
        mst: '0101234567',
        agency: 'Old Agency',
      },
    ]);
    db.close();

    const store = new SqliteDeclarationsStore(dbFile);
    const actor = createActor();
    const target = {
      id: 'decl-1',
      key: 'TK-001_CN1',
      declarationId: 'decl-1',
      soTk: 'TK-001',
      nhanh: 'CN1',
      current: {
        declaration_id: 'decl-1',
        so_tk: 'TK-001',
        nhanh: 'CN1',
        mst: '0101234567',
        agency: 'Old Agency',
      },
    };

    const nextRecord = await store.patchDeclaration(
      target,
      {
        patch: { agency: 'New Agency' },
        requestedFields: ['agency'],
      },
      actor,
    );

    expect(nextRecord).toMatchObject({
      declaration_id: 'decl-1',
      so_tk: 'TK-001',
      nhanh: 'CN1',
      agency: 'New Agency',
    });

    const verifyDb = new Database(dbFile);
    expect(readCanonicalSqliteDeclarationRows(verifyDb)).toEqual([
      expect.objectContaining({
        declaration_id: 'decl-1',
        so_tk: 'TK-001',
        nhanh: 'CN1',
        mst: '0101234567',
        agency: 'New Agency',
      }),
    ]);
    expect(readDeclarationRowsSnapshot(verifyDb)).toEqual([
      expect.objectContaining({
        declaration_id: 'decl-1',
        so_tk: 'TK-001',
        nhanh: 'CN1',
        mst: '0101234567',
        agency: 'New Agency',
      }),
    ]);
    expect(
      verifyDb
        .prepare(`SELECT COUNT(*) AS count FROM ${SQLITE_DECLARATION_LIVE_ROW_TABLE}`)
        .get().count,
    ).toBe(1);
    verifyDb.close();
  });
});

function createRuntimeDb() {
  const dbFile = path.join(
    os.tmpdir(),
    `server-v4-declarations-store-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`,
  );
  const database = new Database(dbFile);
  database.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  database.close();
  tempFiles.push(dbFile);
  return dbFile;
}

function createActor() {
  return {
    username: 'tester',
    role: 'admin',
    name: 'Tester',
    permissions: { accountManage: true },
    memberId: null,
    memberName: null,
    teamId: null,
    teamName: null,
  };
}
