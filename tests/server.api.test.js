/* eslint-env node */
import process from 'node:process';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { resetSqlMonitor, getSqlTimeoutEvents } from '../server/sqlMonitor.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.KPI_DB_FILE = ':memory:';
process.env.KPI_DISABLE_CRON = '1';
process.env.KPI_SKIP_LISTEN = '1';

const mockState = {
  result: [],
  connectError: null,
  queryError: null,
  requests: [],
  lastConfig: null,
  lastQuery: null,
  closed: false,
};

class FakeStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
  }

  run(key, value) {
    if (this.sql.includes('INSERT INTO kv_store')) {
      if (value === null || value === undefined) {
        this.database.store.delete(String(key));
        return { changes: 1 };
      }
      this.database.store.set(String(key), String(value));
      return { changes: 1 };
    }
    if (this.sql.includes('DELETE FROM kv_store')) {
      const deleted = this.database.store.delete(String(key));
      return { changes: deleted ? 1 : 0 };
    }
    return { changes: 0 };
  }

  get(key) {
    if (this.sql.includes('SELECT value FROM kv_store WHERE key')) {
      if (this.database.store.has(String(key))) {
        return { value: this.database.store.get(String(key)) };
      }
      return undefined;
    }
    return undefined;
  }

  all() {
    if (this.sql.includes('SELECT key FROM kv_store') && !this.sql.includes('value')) {
      return Array.from(this.database.store.keys()).map((key) => ({ key }));
    }
    if (this.sql.includes('SELECT key, value FROM kv_store')) {
      return Array.from(this.database.store.entries()).map(([key, value]) => ({ key, value }));
    }
    return [];
  }
}

class FakeDatabase {
  constructor() {
    this.store = new Map();
  }

  pragma() {}

  exec(sql) {
    if (sql.includes('DELETE FROM kv_store')) {
      this.store.clear();
    }
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  transaction(fn) {
    return (...args) => fn(...args);
  }

  close() {
    this.store.clear();
  }
}

class MockRequest {
  constructor() {
    this.inputs = {};
  }

  input(name, _type, value) {
    this.inputs[name] = value;
    return this;
  }

  async query(sqlText) {
    mockState.lastQuery = sqlText;
    if (mockState.queryError) {
      throw mockState.queryError;
    }
    return { recordset: mockState.result };
  }
}

class MockConnectionPool {
  constructor(config) {
    this.config = config;
    mockState.lastConfig = config;
  }

  async connect() {
    if (mockState.connectError) {
      throw mockState.connectError;
    }
    return this;
  }

  request() {
    const req = new MockRequest();
    mockState.requests.push(req);
    return req;
  }

  async close() {
    mockState.closed = true;
  }
}

const DateTimeToken = Symbol.for('mssql.DateTime');

function resetMockState() {
  mockState.result = [];
  mockState.connectError = null;
  mockState.queryError = null;
  mockState.requests = [];
  mockState.lastConfig = null;
  mockState.lastQuery = null;
  mockState.closed = false;
}

vi.mock('mssql', () => ({
  __esModule: true,
  default: {
    ConnectionPool: MockConnectionPool,
    DateTime: DateTimeToken,
    __setMockResult(rows) {
      mockState.result = Array.isArray(rows) ? rows : [];
    },
    __setMockErrors({ connectError = null, queryError = null } = {}) {
      mockState.connectError = connectError;
      mockState.queryError = queryError;
    },
    __resetMock: resetMockState,
    __getState() {
      return mockState;
    },
  },
  ConnectionPool: MockConnectionPool,
  DateTime: DateTimeToken,
  __setMockResult(rows) {
    mockState.result = Array.isArray(rows) ? rows : [];
  },
  __setMockErrors({ connectError = null, queryError = null } = {}) {
    mockState.connectError = connectError;
    mockState.queryError = queryError;
  },
  __resetMock: resetMockState,
  __getState() {
    return mockState;
  },
}));

vi.mock('better-sqlite3', () => ({
  __esModule: true,
  default: FakeDatabase,
}));

const sqlModule = await import('mssql');
const sqlMock = sqlModule.default;

let app;
let resetDb;
let getDb;
let stopServer;

beforeAll(async () => {
  const serverModule = await import('../server/index.js');
  app = serverModule.app;
  resetDb = serverModule.resetDatabaseForTests;
  getDb = serverModule.getDatabaseHandle;
  stopServer = serverModule.stopServer;
});

describe('API xác thực & bootstrap', () => {
  beforeEach(() => {
    resetDb();
  });

  it('bootstrap trả về tài khoản đã khử mật khẩu và có cấu hình HQ mặc định', async () => {
    const response = await request(app).get('/api/bootstrap');
    expect(response.status).toBe(200);
    const payload = response.body?.data;
    expect(payload).toBeTruthy();
    expect(payload).toHaveProperty('hq_agencies_v1', '[]');
    const accounts = JSON.parse(payload.kpi_users_v1 || '[]');
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);
    for (const account of accounts) {
      expect(account).not.toHaveProperty('password');
      expect(account).not.toHaveProperty('passwordHash');
    }
  });

  it('cho phép đăng nhập bằng tài khoản mặc định', async () => {
    const response = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(response.status).toBe(200);
    expect(response.body?.ok).toBe(true);
    expect(response.body?.user).toMatchObject({ username: 'admin', role: 'admin' });
    expect(response.body?.user).not.toHaveProperty('passwordHash');
  });

  it('từ chối đăng nhập khi mật khẩu sai', async () => {
    const response = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'sai' });
    expect(response.status).toBe(401);
    expect(response.body?.ok).toBe(false);
  });

  it('không cho phép ghi đè kpi_users_v1 qua API storage chung', async () => {
    const response = await request(app)
      .put('/api/storage/kpi_users_v1')
      .send({ value: JSON.stringify([]) });
    expect(response.status).toBe(403);
  });

  it('danh sách tài khoản không lộ hash mật khẩu', async () => {
    const response = await request(app).get('/api/auth/accounts');
    expect(response.status).toBe(200);
    const accounts = response.body?.accounts ?? [];
    expect(Array.isArray(accounts)).toBe(true);
    for (const account of accounts) {
      expect(account).not.toHaveProperty('password');
      expect(account).not.toHaveProperty('passwordHash');
    }
  });

  it('lưu mật khẩu dạng băm trong cơ sở dữ liệu', () => {
    const db = getDb();
    const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('kpi_users_v1');
    expect(row?.value).toBeTruthy();
    const accounts = JSON.parse(row.value || '[]');
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts[0]).not.toHaveProperty('password');
    expect(accounts[0].passwordHash).toMatch(/^\$2[abyx]\$/);
  });
});

afterAll(() => {
  stopServer?.();
});

beforeEach(() => {
  resetDb();
  sqlMock.__resetMock();
  resetSqlMonitor();
});

describe('ECUS sync API', () => {
  it('trả về cấu hình mặc định', async () => {
    const res = await request(app).get('/api/import/ecus/config');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      config: {
        connection: { hasPassword: false, password: '' },
        enabled: false,
      },
    });
  });

  it('trả về trạng thái chưa cấu hình khi thiếu thông tin SQL', async () => {
    const res = await request(app).get('/api/import/ecus/status');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.backend).toMatchObject({ ok: true, state: 'online' });
    expect(res.body.database).toMatchObject({ ok: false, state: 'not_configured' });
  });

  it('lưu cấu hình và chạy đồng bộ thành công', async () => {
    const configPayload = {
      config: {
        enabled: true,
        schedule: '0 0 * * *',
        rangeDays: 2,
        connection: {
          server: 'MRHOC\\ECUSSQL2008',
          database: 'ECUS5VNACCS',
          user: 'sa',
          password: '123456',
        },
      },
    };
    const saveRes = await request(app).put('/api/import/ecus/config').send(configPayload);
    expect(saveRes.status).toBe(200);
    expect(saveRes.body.config.connection.password).toBe('');
    expect(saveRes.body.config.connection.hasPassword).toBe(true);

    sqlMock.__setMockResult([
      {
        So_tk: '105110557420',
        Ngay_dang_ky: '2025-08-01',
        MaSoThue: '1051105574',
        TenDoanhNghiep: 'CÔNG TY TNHH ABC',
        Loai_hinh: 'A11',
        muc_hang: 5,
        ds_gp: 'GP01, GP05',
        NhanVienNhap: 'Phương',
      },
    ]);

    const runRes = await request(app)
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });

    expect(runRes.status).toBe(200);
    expect(runRes.body).toMatchObject({
      ok: true,
      result: {
        imported: 1,
        fetched: 1,
        alerts: expect.any(Object),
      },
    });

    const state = sqlMock.__getState();
    expect(state.requests[0].inputs).toHaveProperty('from');
    expect(state.requests[0].inputs).toHaveProperty('to');

    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('decl_rows_v1');
    const storedRows = JSON.parse(row.value);
    expect(storedRows).toHaveLength(1);
    expect(storedRows[0]).toMatchObject({
      so_tk: '105110557420',
      mst: '1051105574',
      cong_ty: 'CÔNG TY TNHH ABC',
      nhan_vien: 'Phương',
      so_luong_gp: 2,
    });
  });

  it('đánh dấu C/O khi dữ liệu ECUS có mã biểu thuế phù hợp', async () => {
    await request(app)
      .put('/api/import/ecus/config')
      .send({
        config: {
          enabled: true,
          connection: {
            server: 'MRHOC\\ECUSSQL2008',
            database: 'ECUS5VNACCS',
            user: 'sa',
            password: '123456',
          },
        },
      });

    sqlMock.__setMockResult([
      {
        'Số tờ khai': '105110557420',
        'Ngày đăng ký': '2025-08-01',
        'Mã số thuế': '1051105574',
        'Tên doanh nghiệp': 'CÔNG TY TNHH C/O',
        'Mã biểu thuế XNK': 'B05',
        'Số mục hàng': '1',
      },
    ]);

    const runRes = await request(app)
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });

    expect(runRes.status).toBe(200);
    const row = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1');
    const storedRows = JSON.parse(row.value);
    expect(storedRows[0]).toMatchObject({ co: 'Có', has_co: true });
  });

  it('kiểm tra trạng thái SQL Server thành công khi đã cấu hình', async () => {
    await request(app)
      .put('/api/import/ecus/config')
      .send({
        config: {
          enabled: true,
          connection: {
            server: 'MRHOC\\ECUSSQL2008',
            database: 'ECUS5VNACCS',
            user: 'sa',
            password: '123456',
          },
        },
      });

    sqlMock.__setMockResult([{ ok: 1 }]);

    const res = await request(app).get('/api/import/ecus/status');
    expect(res.status).toBe(200);
    expect(res.body.database.ok).toBe(true);
    expect(res.body.database.state).toBe('ready');

    const state = sqlMock.__getState();
    expect(state.lastQuery).toMatch(/SELECT 1/i);
  });

  it('đồng bộ được bản ghi với tiêu đề cột tiếng Việt có dấu', async () => {
    await request(app)
      .put('/api/import/ecus/config')
      .send({
        config: {
          enabled: true,
          connection: {
            server: 'MRHOC\\ECUSSQL2008',
            database: 'ECUS5VNACCS',
            user: 'sa',
            password: '123456',
          },
        },
      });

    sqlMock.__setMockResult([
      {
        'Số tờ khai': '305254416960',
        'Ngày đăng ký': '2025-08-15',
        'Mã số thuế': '2301158516',
        'Tên doanh nghiệp': 'CÔNG TY TNHH XYZ',
        'Số mục hàng': '4',
        'Số lượng GP': '3',
        'Nhân viên xuất': 'Học',
        'Tổ đội': 'Team 3',
      },
    ]);

    const runRes = await request(app)
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });

    expect(runRes.status).toBe(200);
    expect(runRes.body.ok).toBe(true);
    expect(runRes.body.result.imported).toBe(1);

    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('decl_rows_v1');
    const stored = JSON.parse(row.value);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      so_tk: '305254416960',
      mst: '2301158516',
      cong_ty: 'CÔNG TY TNHH XYZ',
      so_luong_gp: 3,
      team: 'Team 3',
      nhan_vien: 'Học',
    });
  });

  it('ghi nhận lỗi khi SQL Server gặp sự cố', async () => {
    await request(app)
      .put('/api/import/ecus/config')
      .send({
        config: {
          enabled: true,
          connection: {
            server: 'MRHOC\\ECUSSQL2008',
            database: 'ECUS5VNACCS',
            user: 'sa',
            password: '123456',
          },
        },
      });

    sqlMock.__setMockErrors({ queryError: new Error('SQL timeout') });

    const res = await request(app)
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);

    const timeoutEvents = getSqlTimeoutEvents();
    expect(timeoutEvents.some((event) => event.message?.includes('SQL timeout'))).toBe(true);

    const configRes = await request(app).get('/api/import/ecus/config');
    expect(configRes.body.config.lastStatus).toMatch(/error/i);

    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('decl_rows_v1');
    expect(JSON.parse(row.value)).toHaveLength(0);
  });
});

describe('Alert API', () => {
  const missingDecl = {
    so_tk: 'TK001',
    nhanh: '',
    mst: '0100000001',
    cong_ty: 'CÔNG TY MINH HỌA',
    date: '2000-01-01',
    raw_date: '2000-01-01',
    nhan_vien: '',
    team: '',
  };

  beforeEach(async () => {
    await request(app)
      .put('/api/storage/decl_rows_v1')
      .send({ value: JSON.stringify([missingDecl]) });
  });

  it('trả về danh sách cảnh báo và cấu hình hiện tại', async () => {
    const res = await request(app).get('/api/import/alerts');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.alerts.length).toBe(1);
    expect(res.body.alerts[0]).toMatchObject({ so_tk: 'TK001', resolved: false });
  });

  it('cho phép cập nhật cấu hình cảnh báo và đánh dấu đã rà soát', async () => {
    const configRes = await request(app)
      .put('/api/import/alerts/config')
      .send({
        actor: 'tester',
        config: { thresholdDays: 0, channel: 'audit', enabled: true },
      });
    expect(configRes.status).toBe(200);
    expect(configRes.body.summary.outstanding).toBe(1);

    const alerts = await request(app).get('/api/import/alerts');
    const key = alerts.body.alerts[0].key;

    const reviewRes = await request(app)
      .post('/api/import/alerts/review')
      .send({ actor: 'tester', keys: [key] });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.updated).toBe(1);
    expect(reviewRes.body.summary.outstanding).toBe(0);
  });
});
