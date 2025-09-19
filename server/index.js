import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import process from 'node:process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_FILE = path.resolve(__dirname, 'data/db.json');
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

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const dir = path.dirname(DATA_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_STORAGE, null, 2), 'utf8');
  }
}

async function readStorage() {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STORAGE, ...parsed };
  } catch (err) {
    console.error('Không thể đọc file dữ liệu, sử dụng mặc định.', err);
    return { ...DEFAULT_STORAGE };
  }
}

async function writeStorage(store) {
  const merged = { ...DEFAULT_STORAGE, ...store };
  await fs.writeFile(DATA_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

const app = express();
const PORT = Number.parseInt(process.env.PORT || '4000', 10);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/bootstrap', async (req, res) => {
  const store = await readStorage();
  res.json({ data: store });
});

app.put('/api/storage/:key', async (req, res) => {
  const key = req.params.key;
  if (!key) {
    res.status(400).json({ ok: false, error: 'Thiếu key' });
    return;
  }
  const { value } = req.body || {};
  try {
    const store = await readStorage();
    if (value === null || value === undefined) {
      delete store[key];
    } else {
      store[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    await writeStorage(store);
    res.json({ ok: true });
  } catch (err) {
    console.error('Lỗi ghi dữ liệu', err);
    res.status(500).json({ ok: false, error: 'Không thể ghi dữ liệu' });
  }
});

app.delete('/api/storage/:key', async (req, res) => {
  const key = req.params.key;
  if (!key) {
    res.status(400).json({ ok: false, error: 'Thiếu key' });
    return;
  }
  try {
    const store = await readStorage();
    delete store[key];
    await writeStorage(store);
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
