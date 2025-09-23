import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import process from 'node:process';
import Database from 'better-sqlite3';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DB_FILE = path.resolve(__dirname, 'data/storage.sqlite');
const LEGACY_JSON = path.resolve(__dirname, 'data/db.json');
const DIST_DIR = path.resolve(__dirname, '../dist');

const DEFAULT_STORAGE = {
  decl_rows_v1: '[]',
  mst_rows_v2: '[]',
  kpi_rules_v2: JSON.stringify({ version: 1, points: { base: 1 } }),
  team_roster_v1: JSON.stringify({
    version: 1,
    teams: [
      {
        id: 'team-1',
        name: 'Team 1',
        members: [
          { id: 'team-1-phuong', name: 'Phương' },
          { id: 'team-1-hanh', name: 'Hạnh' },
          { id: 'team-1-bao', name: 'Bảo' },
          { id: 'team-1-ha-be', name: 'Hà Bé' },
          { id: 'team-1-huong', name: 'Hương' },
        ],
      },
      {
        id: 'team-2',
        name: 'Team 2',
        members: [
          { id: 'team-2-tuan', name: 'Tuấn' },
          { id: 'team-2-hoa', name: 'Hòa' },
          { id: 'team-2-thu', name: 'Thu' },
          { id: 'team-2-hang', name: 'Hằng' },
          { id: 'team-2-huyen', name: 'Huyền' },
        ],
      },
      {
        id: 'team-3',
        name: 'Team 3',
        members: [
          { id: 'team-3-hoc', name: 'Học' },
          { id: 'team-3-thanh', name: 'Thanh' },
          { id: 'team-3-huy', name: 'Huy' },
          { id: 'team-3-linh', name: 'Linh' },
          { id: 'team-3-thao', name: 'Thảo' },
          { id: 'team-3-hung', name: 'Hưng' },
        ],
      },
    ],
  }),
  audit_logs_v1: '[]',
  import_logs_v1: '[]',
  kpi_users_v1: JSON.stringify([
    {
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      name: 'Quản trị viên',
      permissions: {
        importEdit: true,
        mstEdit: true,
        rulesEdit: true,
        teamsEdit: true,
        reportsExport: true,
        accountManage: true,
      },
    },
    {
      username: 'nhanvien',
      password: '123456',
      role: 'staff',
      name: 'Nhân viên',
      permissions: {
        importEdit: true,
        mstEdit: false,
        rulesEdit: false,
        teamsEdit: false,
        reportsExport: true,
        accountManage: false,
      },
    },
  ]),
};

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

async function initializeDatabase() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  const database = new Database(DB_FILE);
  database.pragma('journal_mode = WAL');
  database.exec(
    'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  );

  let seedData = { ...DEFAULT_STORAGE };
  try {
    const raw = await fs.readFile(LEGACY_JSON, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      seedData = { ...seedData, ...parsed };
    }
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn('Không thể đọc dữ liệu JSON cũ, tiếp tục với giá trị mặc định.', err);
    }
  }

  const existingKeys = new Set(
    database
      .prepare('SELECT key FROM kv_store')
      .all()
      .map((row) => row.key)
  );

  if (existingKeys.size === 0) {
    const insertMany = database.transaction((entries) => {
      const stmt = database.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)');
      for (const [key, value] of entries) {
        stmt.run(key, normalizeValue(value));
      }
    });
    insertMany(Object.entries(seedData));
  } else {
    const missingEntries = Object.entries(seedData).filter(([key]) => !existingKeys.has(key));
    if (missingEntries.length > 0) {
      const insertMissing = database.transaction((entries) => {
        const stmt = database.prepare(
          'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
        );
        for (const [key, value] of entries) {
          stmt.run(key, normalizeValue(value));
        }
      });
      insertMissing(missingEntries);
    }
  }

  return database;
}

const db = await initializeDatabase();

function readStorage() {
  const rows = db.prepare('SELECT key, value FROM kv_store').all();
  const store = { ...DEFAULT_STORAGE };
  for (const row of rows) {
    store[row.key] = row.value;
  }
  return store;
}

function upsertValue(key, value) {
  const normalized = normalizeValue(value);
  if (normalized === null) {
    db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
    return;
  }
  db.prepare(
    'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, normalized);
}

function deleteValue(key) {
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
}

const app = express();
const PORT = Number.parseInt(process.env.PORT || '4000', 10);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/bootstrap', (req, res) => {
  const store = readStorage();
  res.json({ data: store });
});

app.put('/api/storage/:key', (req, res) => {
  const key = req.params.key;
  if (!key) {
    res.status(400).json({ ok: false, error: 'Thiếu key' });
    return;
  }
  const { value } = req.body || {};
  try {
    if (value === null || value === undefined) {
      deleteValue(key);
    } else {
      upsertValue(key, value);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Lỗi ghi dữ liệu', err);
    res.status(500).json({ ok: false, error: 'Không thể ghi dữ liệu' });
  }
});

app.delete('/api/storage/:key', (req, res) => {
  const key = req.params.key;
  if (!key) {
    res.status(400).json({ ok: false, error: 'Thiếu key' });
    return;
  }
  try {
    deleteValue(key);
    res.json({ ok: true });
  } catch (err) {
    console.error('Lỗi xóa dữ liệu', err);
    res.status(500).json({ ok: false, error: 'Không thể xóa dữ liệu' });
  }
});

app.use(express.static(DIST_DIR));
app.get('*', async (req, res, next) => {
  try {
    await fs.access(path.join(DIST_DIR, 'index.html'));
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  } catch {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`KPI storage server đang chạy tại http://localhost:${PORT}`);
});
