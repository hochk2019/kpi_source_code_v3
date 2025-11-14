/* eslint-env node */

/* @vitest-environment node */

import process from 'node:process';

import os from 'node:os';

import path from 'node:path';

import fs from 'node:fs/promises';

import Database from 'better-sqlite3';

import { describe, it, expect, beforeAll } from 'vitest';



process.env.NODE_ENV = 'test';

process.env.VITEST = 'true';

process.env.KPI_SKIP_LISTEN = '1';

process.env.KPI_DISABLE_CRON = '1';



let initializeDatabase;

let getDatabaseInitState;



beforeAll(async () => {

  ({ initializeDatabase, getDatabaseInitState } = await import('../server/index.js'));

});



describe('initializeDatabase seed logic', () => {

  it('tạo đầy đủ kho chia sẻ mặc định khi CSDL rỗng', async () => {

    const db = await initializeDatabase({ dbFile: ':memory:' });

    const keys = db.prepare('SELECT key FROM kv_store').all().map((row) => row.key);



    expect(keys).toEqual(expect.arrayContaining([

      'decl_rows_v1',

      'mst_rows_v2',

      'kpi_rules_v2',

      'team_roster_v1',

      'hq_agencies_v1',

      'kpi_users_v1',

    ]));



    const usersRow = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('kpi_users_v1');

    expect(usersRow).toBeTruthy();

    expect(() => JSON.parse(usersRow.value)).not.toThrow();



    db.close();



    const info = getDatabaseInitState();

    expect(info.seeded).toBe(true);

    expect(info.insertedEntries).toBeGreaterThan(0);

  });



  it('giữ nguyên giá trị đã có và chỉ bổ sung key thiếu', async () => {

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kpi-seed-'));

    const dbFile = path.join(tmpDir, 'storage.sqlite');



    const manualDb = new Database(dbFile);

    manualDb.exec('CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

    manualDb.exec('CREATE TABLE IF NOT EXISTS auth_sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)');

    manualDb.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)').run(

      'decl_rows_v1',

      JSON.stringify([{ so_tk: 'CUSTOM-01' }])

    );

    manualDb.close();



    const db = await initializeDatabase({ dbFile });



    const declRow = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1');

    expect(JSON.parse(declRow.value)).toEqual([{ so_tk: 'CUSTOM-01' }]);



    const keys = db.prepare('SELECT key FROM kv_store').all().map((row) => row.key);

    expect(keys).toEqual(expect.arrayContaining([

      'mst_rows_v2',

      'team_roster_v1',

      'hq_agencies_v1',

      'kpi_users_v1',

    ]));



    db.close();

    const info = getDatabaseInitState();

    expect(info.seeded).toBe(false);

    expect(info.missingInserted).toBeGreaterThanOrEqual(0);

    await fs.rm(tmpDir, { recursive: true, force: true });

  });

});

