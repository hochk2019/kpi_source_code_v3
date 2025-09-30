/* eslint-env node */
/* @vitest-environment node */
import process from 'node:process';
import { Buffer } from 'node:buffer';
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

  run(...params) {
    if (this.sql.includes('INSERT INTO kv_store')) {
      const [key, value] = params;
      if (value === null || value === undefined) {
        this.database.store.delete(String(key));
        return { changes: 1 };
      }
      this.database.store.set(String(key), String(value));
      return { changes: 1 };
    }
    if (this.sql.includes('DELETE FROM kv_store')) {
      const [key] = params;
      const deleted = this.database.store.delete(String(key));
      return { changes: deleted ? 1 : 0 };
    }
    if (this.sql.includes('INSERT INTO auth_sessions')) {
      const [token, username, createdAt, expiresAt] = params;
      this.database.sessions.set(String(token), {
        token: String(token),
        username: String(username),
        created_at: Number(createdAt),
        expires_at: Number(expiresAt),
      });
      return { changes: 1 };
    }
    if (this.sql.includes('DELETE FROM auth_sessions WHERE token')) {
      const [token] = params;
      const deleted = this.database.sessions.delete(String(token));
      return { changes: deleted ? 1 : 0 };
    }
    if (this.sql.includes('DELETE FROM auth_sessions WHERE username')) {
      const [username] = params;
      let changes = 0;
      for (const [token, session] of Array.from(this.database.sessions.entries())) {
        if (session.username === String(username)) {
          this.database.sessions.delete(token);
          changes += 1;
        }
      }
      return { changes };
    }
    if (this.sql.includes('DELETE FROM auth_sessions WHERE expires_at')) {
      const [expiresAt] = params;
      let changes = 0;
      for (const [token, session] of Array.from(this.database.sessions.entries())) {
        if (session.expires_at <= Number(expiresAt)) {
          this.database.sessions.delete(token);
          changes += 1;
        }
      }
      return { changes };
    }
    return { changes: 0 };
  }

  get(...params) {
    if (this.sql.includes('SELECT value FROM kv_store WHERE key')) {
      const [key] = params;
      if (this.database.store.has(String(key))) {
        return { value: this.database.store.get(String(key)) };
      }
      return undefined;
    }
    if (this.sql.includes('SELECT token, username, created_at, expires_at FROM auth_sessions WHERE token = ?')) {
      const [token] = params;
      const session = this.database.sessions.get(String(token));
      if (!session) {
        return undefined;
      }
      return { ...session };
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
    if (this.sql.includes('SELECT token, username FROM auth_sessions')) {
      return Array.from(this.database.sessions.values()).map((session) => ({
        token: session.token,
        username: session.username,
      }));
    }
    if (this.sql.includes('SELECT token FROM auth_sessions')) {
      return Array.from(this.database.sessions.keys()).map((token) => ({ token }));
    }
    return [];
  }
}

class FakeDatabase {
  constructor() {
    this.store = new Map();
    this.sessions = new Map();
  }

  pragma() {}

  exec(sql) {
    if (sql.includes('DELETE FROM kv_store')) {
      this.store.clear();
    }
    if (sql.includes('DELETE FROM auth_sessions')) {
      this.sessions.clear();
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
    this.sessions.clear();
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

function binaryParser(res, callback) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      callback(null, Buffer.from(data, 'binary'));
    } catch (err) {
      callback(err);
    }
  });
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

vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hashSync: (value) => `$2a$${value}`,
    compare: async (input, hash) => hash === `$2a$${input}` || hash === input,
  },
}));

vi.mock('exceljs', () => {
  class MockCell {
    constructor() {
      this.value = null;
      this.font = {};
      this.alignment = {};
      this.border = {};
    }
  }

  class MockRow {
    constructor() {
      this.cells = new Map();
      this.height = 0;
    }

    getCell(index) {
      const key = Number(index) || 1;
      if (!this.cells.has(key)) {
        this.cells.set(key, new MockCell());
      }
      return this.cells.get(key);
    }

    commit() {}
  }

  function columnToIndex(column) {
    return column
      .toUpperCase()
      .split('')
      .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0);
  }

  class MockWorksheet {
    constructor(name = 'Sheet1') {
      this.name = name;
      this.rows = new Map();
      this.pageSetup = {};
      this.columns = [];
    }

    mergeCells() {}

    getRow(index) {
      const key = Number(index) || 1;
      if (!this.rows.has(key)) {
        this.rows.set(key, new MockRow());
      }
      return this.rows.get(key);
    }

    getCell(ref, colIndex) {
      if (typeof ref === 'string') {
        const match = ref.match(/^([A-Z]+)(\d+)$/i);
        if (match) {
          const [, column, row] = match;
          return this.getRow(Number(row)).getCell(columnToIndex(column));
        }
        return this.getRow(1).getCell(1);
      }
      if (typeof ref === 'number') {
        return this.getRow(ref).getCell(colIndex || 1);
      }
      return this.getRow(1).getCell(1);
    }
  }

  let workbookCreateCount = 0;

  class MockWorkbook {
    constructor() {
      workbookCreateCount += 1;
      this.worksheets = [];
      this.xlsx = {
        writeBuffer: async () => Buffer.from('excel-mock'),
      };
    }

    addWorksheet(name) {
      const sheet = new MockWorksheet(name);
      this.worksheets.push(sheet);
      return sheet;
    }
  }

  const excelNamespace = {
    Workbook: MockWorkbook,
    __getWorkbookCreateCount: () => workbookCreateCount,
    __resetWorkbookCreateCount: () => {
      workbookCreateCount = 0;
    },
  };

  return {
    __esModule: true,
    default: excelNamespace,
    Workbook: MockWorkbook,
  };
});

const sqlModule = await import('mssql');
const sqlMock = sqlModule.default;
const excelModule = await import('exceljs');
const excelMock = excelModule.default;
const reportExportModule = await import('../server/reportExport.js');
const { clearReportCache } = reportExportModule;

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
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('duy trì phiên đăng nhập và cho phép đăng xuất', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);
    const sessionRes = await agent.get('/api/auth/session');
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body?.user).toMatchObject({ username: 'admin', role: 'admin' });

    const logoutRes = await agent.post('/api/auth/logout').send();
    expect(logoutRes.status).toBe(200);

    const sessionAfterLogout = await agent.get('/api/auth/session');
    expect(sessionAfterLogout.body?.user).toBeNull();
  });

  it('cấp lại cookie phiên sau khi người dùng đổi mật khẩu', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const changeRes = await agent
      .post('/api/auth/password/change')
      .send({ username: 'admin', currentPassword: 'admin123', newPassword: 'admin999' });
    expect(changeRes.status).toBe(200);
    expect(changeRes.headers['set-cookie']).toBeDefined();

    const sessionAfterChange = await agent.get('/api/auth/session');
    expect(sessionAfterChange.body?.user).toMatchObject({ username: 'admin' });
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
  clearReportCache();
  excelMock.__resetWorkbookCreateCount?.();
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

describe('Report export API', () => {
  it('yêu cầu đăng nhập trước khi xuất báo cáo', async () => {
    const res = await request(app)
      .post('/api/reports/export')
      .send({ kind: 'staff', payload: {} });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('từ chối khi tài khoản không có quyền báo cáo', async () => {
    const admin = request.agent(app);
    const loginAdmin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginAdmin.status).toBe(200);

    await admin.post('/api/auth/accounts').send({
      username: 'noperm',
      password: '123456',
      name: 'Không quyền',
      role: 'staff',
      permissions: { reportsExport: false },
    });

    const staffAgent = request.agent(app);
    const staffLogin = await staffAgent.post('/api/auth/login').send({ username: 'noperm', password: '123456' });
    expect(staffLogin.status).toBe(200);

    const exportRes = await staffAgent
      .post('/api/reports/export')
      .send({ kind: 'staff', payload: {} });

    expect(exportRes.status).toBe(403);
    expect(exportRes.body.ok).toBe(false);

    const cleanup = await admin.delete('/api/auth/accounts/noperm');
    expect(cleanup.status).toBe(200);
  });

  it('xuất file báo cáo KPI nhân viên thành công', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const payload = {
      staff: {
        name: 'Nguyễn Văn A',
        teamLabel: 'Team 1',
        stats: { decls: 1, kpi: 2.5, import: 1, export: 0, items: 5, licenses: 1 },
        rows: [
          {
            date: '2025-01-01',
            so_tk: 'TK001',
            mst: '0123456789',
            cong_ty: 'CÔNG TY A',
            loai_hinh: 'A11',
            isExport: false,
            num_items: 5,
            licenses: 1,
            kpi: 2.5,
          },
        ],
      },
      range: { from: '2025-01-01', to: '2025-01-31' },
      rules: { name: 'Quy tắc demo', applyFrom: '2025-01-01' },
    };

    const res = await agent
      .post('/api/reports/export')
      .buffer(true)
      .parse(binaryParser)
      .send({ kind: 'staff', payload });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toMatch(/bao-cao-kpi-nhan-vien/);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.byteLength).toBeGreaterThan(0);
  });

  it('tái sử dụng cache khi xuất cùng tham số', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const payload = {
      staff: {
        name: 'Nguyễn Văn B',
        teamLabel: 'Team 2',
        stats: { decls: 2, kpi: 5, import: 1, export: 1, items: 10, licenses: 0 },
        rows: [
          {
            date: '2025-02-01',
            so_tk: 'TK002',
            mst: '9876543210',
            cong_ty: 'CÔNG TY B',
            loai_hinh: 'B11',
            isExport: true,
            num_items: 10,
            licenses: 0,
            kpi: 5,
          },
        ],
      },
      range: { from: '2025-02-01', to: '2025-02-28' },
    };

    const first = await agent
      .post('/api/reports/export')
      .buffer(true)
      .parse(binaryParser)
      .send({ kind: 'staff', payload });

    expect(first.status).toBe(200);
    expect(excelMock.__getWorkbookCreateCount()).toBe(1);

    const second = await agent
      .post('/api/reports/export')
      .buffer(true)
      .parse(binaryParser)
      .send({ kind: 'staff', payload });

    expect(second.status).toBe(200);
    expect(excelMock.__getWorkbookCreateCount()).toBe(1);
    expect(Buffer.isBuffer(second.body)).toBe(true);
    expect(second.body.byteLength).toBeGreaterThan(0);
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
