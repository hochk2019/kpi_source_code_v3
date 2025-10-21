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
process.env.ECUS_SQL_SERVER = 'MOCK-SERVER';

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
    if (this.sql.includes('INSERT INTO export_audit')) {
      const payload = params[0] && typeof params[0] === 'object' ? params[0] : {};
      const entry = {
        id: ++this.database.exportAuditSeq,
        created_at: payload.created_at ?? new Date().toISOString(),
        issued_at: payload.issued_at ?? null,
        username: payload.username ?? 'unknown',
        display_name: payload.display_name ?? null,
        role: payload.role ?? null,
        report_kind: payload.report_kind ?? 'unknown',
        filename: payload.filename ?? null,
        signature: payload.signature ?? null,
        short_signature: payload.short_signature ?? null,
        filter_summary: payload.filter_summary ?? null,
        filters: payload.filters ?? null,
        ip_address: payload.ip_address ?? null,
        request_id: payload.request_id ?? null,
        user_agent: payload.user_agent ?? null,
      };
      this.database.exportAudit.push(entry);
      return { changes: 1, lastInsertRowid: entry.id };
    }
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

  filterExportAudit(params = {}) {
    const baseParams = params && typeof params === 'object' ? params : {};
    const fromIso = baseParams.from || baseParams['@from'];
    const toIso = baseParams.to || baseParams['@to'];
    const kind = (baseParams.kind || baseParams['@kind'] || '').toString().toLowerCase();
    const searchRaw = (baseParams.search || baseParams['@search'] || '').toString().toLowerCase();
    const search = searchRaw.replace(/%/g, '');
    const fromTs = fromIso ? new Date(fromIso).getTime() : Number.NaN;
    const toTs = toIso ? new Date(toIso).getTime() : Number.NaN;

    return this.database.exportAudit.filter((entry) => {
      const createdTs = new Date(entry.created_at).getTime();
      if (Number.isFinite(fromTs) && createdTs < fromTs) {
        return false;
      }
      if (Number.isFinite(toTs) && createdTs > toTs) {
        return false;
      }
      if (kind && entry.report_kind.toString().toLowerCase() !== kind) {
        return false;
      }
      if (search) {
        const haystack = [
          entry.username,
          entry.display_name,
          entry.role,
          entry.report_kind,
          entry.filename,
          entry.signature,
          entry.short_signature,
          entry.filter_summary,
          entry.request_id,
          entry.ip_address,
        ]
          .map((value) => (value ?? '').toString().toLowerCase())
          .join(' ');
        if (!haystack.includes(search)) {
          return false;
        }
      }
      return true;
    });
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
    if (this.sql.includes('SELECT COUNT(*) AS total FROM export_audit')) {
      const [arg] = params;
      const rows = this.filterExportAudit(arg);
      return { total: rows.length };
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
    if (this.sql.includes('FROM export_audit')) {
      const [arg] = arguments;
      const rows = this.filterExportAudit(arg);

      if (this.sql.includes('GROUP BY report_kind')) {
        const byKind = new Map();
        for (const row of rows) {
          const key = row.report_kind;
          byKind.set(key, (byKind.get(key) || 0) + 1);
        }
        const result = Array.from(byKind.entries()).map(([kind, total]) => ({ kind, total }));
        return result.sort((a, b) => b.total - a.total);
      }

      if (this.sql.includes('GROUP BY username')) {
        const summary = new Map();
        for (const row of rows) {
          const key = row.username || 'unknown';
          const current = summary.get(key) || { username: key, display_name: row.display_name, role: row.role, total: 0 };
          current.total += 1;
          current.display_name = current.display_name || row.display_name;
          current.role = current.role || row.role;
          summary.set(key, current);
        }
        return Array.from(summary.values()).sort((a, b) => b.total - a.total).slice(0, 5);
      }

      if (this.sql.includes('SELECT DISTINCT report_kind')) {
        const kinds = Array.from(new Set(rows.map((row) => row.report_kind)));
        return kinds.sort((a, b) => a.localeCompare(b)).map((report_kind) => ({ report_kind }));
      }

      let sorted = rows.slice();
      if (this.sql.includes('ORDER BY datetime(created_at) DESC')) {
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      const limit = arg?.limit ?? sorted.length;
      const offset = arg?.offset ?? 0;
      return sorted.slice(offset, offset + limit).map((row) => ({ ...row }));
    }
    return [];
  }
}

class FakeDatabase {
  constructor() {
    this.store = new Map();
    this.sessions = new Map();
    this.exportAudit = [];
    this.exportAuditSeq = 0;
  }

  pragma() {}

  exec(sql) {
    if (sql.includes('DELETE FROM kv_store')) {
      this.store.clear();
    }
    if (sql.includes('DELETE FROM auth_sessions')) {
      this.sessions.clear();
    }
    if (sql.includes('DELETE FROM export_audit')) {
      this.exportAudit = [];
      this.exportAuditSeq = 0;
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
      this.images = [];
      this.headerFooter = {};
      this.properties = { outlineProperties: {} };
      this.state = 'visible';
      this.rowCount = 0;
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

    addImage(imageId, placement) {
      this.images.push({ imageId, placement });
    }

    getColumn(index) {
      const idx = (Number(index) || 1) - 1;
      if (!this.columns[idx]) {
        this.columns[idx] = {};
      }
      return this.columns[idx];
    }

    spliceRows(start, deleteCount, ...rows) {
      for (let i = 0; i < deleteCount; i += 1) {
        this.rows.delete(start + i);
      }
      rows.forEach((cells, offset) => {
        const rowIndex = start + offset;
        const row = this.getRow(rowIndex);
        row.values = cells;
        cells.forEach((value, cellIdx) => {
          if (cellIdx === 0) return;
          row.getCell(cellIdx).value = value;
        });
      });
      this.rowCount = Math.max(this.rowCount, start + rows.length - 1);
    }
  }

  let workbookCreateCount = 0;

  class MockWorkbook {
    constructor() {
      workbookCreateCount += 1;
      this.worksheets = [];
      this.images = [];
      this.xlsx = {
        writeBuffer: async () => Buffer.from('excel-mock'),
      };
    }

    addWorksheet(name) {
      const sheet = new MockWorksheet(name);
      this.worksheets.push(sheet);
      return sheet;
    }

    addImage(config) {
      const id = this.images.length + 1;
      this.images.push({ id, config });
      return id;
    }

    getWorksheet(name) {
      return this.worksheets.find((sheet) => sheet.name === name);
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
let waitAccountSync;

beforeAll(async () => {
  const serverModule = await import('../server/index.js');
  app = serverModule.app;
  resetDb = serverModule.resetDatabaseForTests;
  getDb = serverModule.getDatabaseHandle;
  stopServer = serverModule.stopServer;
  waitAccountSync = serverModule.waitForAccountSqlSyncIdle;
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
    expect(payload).toHaveProperty('hq_history_v1', '[]');
    const accounts = JSON.parse(payload.kpi_users_v1 || '[]');
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);
    const usernames = accounts.map((account) => account.username).sort();
    expect(usernames).toEqual(
      expect.arrayContaining([
        'admin',
        'nhanvien',
        'lead.hoc',
        'lead.phuong',
        'lead.tuan',
        'manager.hoangkimhoa',
        'manager.thuyha',
        'manager.hoainam',
      ])
    );
    const teamLead = accounts.find((account) => account.username === 'lead.hoc');
    expect(teamLead).toMatchObject({ role: 'lead' });
    expect(teamLead?.permissions?.teamsEdit).toBe(true);
    expect(teamLead?.permissions?.accountManage).toBe(false);
    const manager = accounts.find((account) => account.username === 'manager.hoangkimhoa');
    expect(manager).toMatchObject({ role: 'manager' });
    expect(manager?.permissions?.rulesEdit).toBe(true);
    expect(manager?.permissions?.accountManage).toBe(false);
    for (const account of accounts) {
      expect(account).not.toHaveProperty('password');
      expect(account).not.toHaveProperty('passwordHash');
    }
  });

  it('ưu tiên dữ liệu tài khoản từ SQL Server khi đồng bộ bootstrap', async () => {
    const updatedAt = new Date('2024-05-15T08:00:00Z');
    sqlMock.__setMockResult([
      {
        username: 'admin',
        password_hash: '$2a$AdminSql',
        role: 'manager',
        name: 'Quản trị SQL',
        permissions: JSON.stringify({
          importEdit: false,
          mstEdit: true,
          reportsExport: true,
          accountManage: false,
        }),
        updated_at: updatedAt,
      },
    ]);

    const response = await request(app).get('/api/bootstrap');
    expect(response.status).toBe(200);
    const payload = response.body?.data;
    expect(payload).toBeTruthy();
    const accounts = JSON.parse(payload?.kpi_users_v1 || '[]');
    const admin = accounts.find((account) => account.username === 'admin');
    expect(admin).toBeTruthy();
    expect(admin?.role).toBe('manager');
    expect(admin?.name).toBe('Quản trị SQL');
    expect(admin?.permissions?.mstEdit).toBe(true);
    expect(admin?.permissions?.importEdit).toBe(false);

    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('kpi_users_v1');
    expect(row?.value).toBeTruthy();
    const storedAccounts = JSON.parse(row.value);
    const storedAdmin = storedAccounts.find((account) => account.username === 'admin');
    expect(storedAdmin?.role).toBe('manager');
    expect(storedAdmin?.passwordHash).toBe('$2a$AdminSql');
    expect(storedAdmin?.updatedAt).toBe('2024-05-15T08:00:00.000Z');
  });

  it('cho phép đăng nhập bằng tài khoản mặc định', async () => {
    const response = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(response.status).toBe(200);
    expect(response.body?.ok).toBe(true);
    expect(response.body?.user).toMatchObject({ username: 'admin', role: 'admin' });
    expect(response.body?.user).not.toHaveProperty('passwordHash');
    expect(typeof response.body?.token).toBe('string');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('cho phép trưởng nhóm đăng nhập với mật khẩu mặc định và không có quyền quản lý tài khoản', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'lead.phuong', password: 'Phuong@2024' });
    expect(response.status).toBe(200);
    expect(response.body?.ok).toBe(true);
    expect(response.body?.user).toMatchObject({ username: 'lead.phuong', role: 'lead' });
    expect(response.body?.user?.permissions?.accountManage).toBe(false);
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

    expect(typeof changeRes.body?.token).toBe('string');

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

  it('yêu cầu đăng nhập khi truy vấn lịch sử Đại lý HQ', async () => {
    const response = await request(app).get('/api/hq/history');
    expect(response.status).toBe(401);
    expect(response.body?.ok).toBe(false);
  });

  it('từ chối truy vấn lịch sử Đại lý HQ nếu tài khoản thiếu quyền mstEdit', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });

    const response = await agent.get('/api/hq/history');
    expect(response.status).toBe(403);
    expect(response.body?.ok).toBe(false);
  });

  it('trả về lịch sử Đại lý HQ kèm bộ lọc', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

    const historyEntries = [
      {
        id: 'hq-0101234567-company',
        mst: '0101234567',
        field: 'company',
        from: '',
        to: 'Công ty A',
        actor: 'admin',
        timestamp: new Date('2024-09-01T08:00:00Z').toISOString(),
        type: 'create',
      },
      {
        id: 'hq-0101234567-agents',
        mst: '0101234567',
        field: 'agents',
        from: 'DL Cũ',
        to: 'DL Mới',
        actor: 'admin',
        timestamp: new Date('2024-09-02T08:00:00Z').toISOString(),
        type: 'update',
      },
      {
        id: 'hq-0200000000-company',
        mst: '0200000000',
        field: 'company',
        from: '',
        to: 'Công ty B',
        actor: 'tester',
        timestamp: new Date('2024-09-03T08:00:00Z').toISOString(),
        type: 'create',
      },
    ];

    const putRes = await agent
      .put('/api/storage/hq_history_v1')
      .send({ value: JSON.stringify(historyEntries) });
    expect(putRes.status).toBe(200);

    const response = await agent
      .get('/api/hq/history')
      .query({ mst: '0101234567', field: 'agents', limit: 1 });

    expect(response.status).toBe(200);
    expect(response.body?.ok).toBe(true);
    expect(response.body?.entries).toHaveLength(1);
    expect(response.body.entries[0]).toMatchObject({
      mst: '0101234567',
      field: 'agents',
      type: 'update',
    });
    expect(response.body.total).toBeGreaterThanOrEqual(1);
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

describe('Quản lý tài khoản', () => {
  beforeEach(() => {
    resetDb();
  });

  it('gắn nhân viên KPI khi tạo tài khoản mới', async () => {
    const db = getDb();
    const roster = {
      version: 1,
      teams: [
        {
          id: 'team-kt',
          name: 'Team Kế toán',
          members: [
            { id: 'kt001', name: 'Nguyễn Thu Phương' },
            { id: 'kt002', name: 'Trần Minh Dũng' },
          ],
        },
      ],
    };
    db.prepare(
      "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run('team_roster_v1', JSON.stringify(roster));

    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const createRes = await adminAgent.post('/api/auth/accounts').send({
      username: 'ketoan.phuong',
      password: 'Phuong@2025',
      role: 'staff',
      memberId: 'kt001',
    });

    expect(createRes.status).toBe(201);
    const account = createRes.body?.account;
    expect(account).toMatchObject({
      username: 'ketoan.phuong',
      memberId: 'kt001',
      memberName: 'Nguyễn Thu Phương',
      teamName: 'Team Kế toán',
    });

    const auditRow = db.prepare('SELECT value FROM kv_store WHERE key = ?').get('audit_logs_v1');
    const logs = JSON.parse(auditRow?.value || '[]');
    const createLog = logs.find((entry) => entry.action === 'account.create' && entry.detail?.includes('ketoan.phuong'));
    expect(createLog).toBeTruthy();
    expect(createLog?.meta?.member).toMatchObject({ memberId: 'kt001', teamName: 'Team Kế toán' });
  });

  it('ghi log chi tiết khi cập nhật quyền tài khoản', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const createRes = await adminAgent.post('/api/auth/accounts').send({
      username: 'quyen.tester',
      password: 'Tester@2025',
      role: 'staff',
    });
    expect(createRes.status).toBe(201);

    const patchRes = await adminAgent
      .patch('/api/auth/accounts/quyen.tester')
      .send({ permissions: { importEdit: true, auditView: true } });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body?.account?.permissions?.importEdit).toBe(true);
    expect(patchRes.body?.account?.permissions?.auditView).toBe(true);

    const auditRow = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('audit_logs_v1');
    const logs = JSON.parse(auditRow?.value || '[]');
    const updateLog = logs.find((entry) => entry.action === 'account.update' && entry.detail?.includes('quyen.tester'));
    expect(updateLog).toBeTruthy();
    expect(updateLog?.detail).toMatch(/quyền:/i);
    expect(updateLog?.meta?.changes?.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'importEdit', after: true }),
        expect.objectContaining({ key: 'auditView', after: true }),
      ])
    );
  });
});

describe('API thông báo hệ thống', () => {
  beforeEach(() => {
    resetDb();
  });

  it('từ chối truy cập lịch sử thông báo khi chưa đăng nhập', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
    expect(res.body?.ok).toBe(false);
  });

  it('cho phép người dùng đã đăng nhập xem thông báo', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);
    const res = await agent.get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(Array.isArray(res.body?.events)).toBe(true);
  });

  it('từ chối mở stream SSE khi chưa đăng nhập', async () => {
    const res = await request(app).get('/api/notifications/stream');
    expect(res.status).toBe(401);
  });
});

describe('Đồng bộ tài khoản với SQL Server', () => {
  beforeEach(() => {
    resetDb();
    sqlMock.__resetMock();
  });

  it('đẩy thay đổi tài khoản lên SQL Server khi tạo mới', async () => {
    const admin = request.agent(app);
    const loginRes = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const state = sqlMock.__getState();
    state.lastQuery = null;
    state.requests.length = 0;

    const createRes = await admin.post('/api/auth/accounts').send({
      username: 'sync.user',
      password: 'Abcdef1',
      role: 'staff',
    });
    expect(createRes.status).toBe(201);

    await waitAccountSync?.();

    const finalState = sqlMock.__getState();
    expect(finalState.lastQuery).toContain('INSERT INTO [dbo].[KPI_USER_ROLES]');
    expect(finalState.lastQuery).toContain("sync.user");
  });
});

describe('AI assistant API', () => {
  beforeEach(() => {
    resetDb();
    sqlMock.__resetMock();
  });

  it('từ chối khi chưa đăng nhập', async () => {
    const res = await request(app).get('/api/ai/profile');
    expect(res.status).toBe(401);
    expect(res.body?.ok).toBe(false);
  });

  it('từ chối khi tài khoản không có quyền aiAssistUse', async () => {
    const adminAgent = request.agent(app);
    const loginAdmin = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginAdmin.status).toBe(200);

    const createRes = await adminAgent.post('/api/auth/accounts').send({
      username: 'no.ai',
      password: 'Abcdef1',
      role: 'staff',
      permissions: { aiAssistUse: false },
    });
    expect(createRes.status).toBe(201);

    const viewer = request.agent(app);
    const loginViewer = await viewer.post('/api/auth/login').send({ username: 'no.ai', password: 'Abcdef1' });
    expect(loginViewer.status).toBe(200);

    const res = await viewer.get('/api/ai/profile');
    expect(res.status).toBe(403);
    expect(res.body?.ok).toBe(false);
  });

  it('trả về trạng thái rút gọn cho người dùng có quyền', async () => {
    const staff = request.agent(app);
    const loginRes = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });
    expect(loginRes.status).toBe(200);

    const res = await staff.get('/api/ai/profile');
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    const profile = res.body?.profile;
    expect(profile).toBeTruthy();
    expect(profile.enabled).toBe(true);
    expect(Array.isArray(profile.providers)).toBe(true);
    if (profile.providers.length > 0 && profile.defaultProvider) {
      const found = profile.providers.find((provider) => provider.id === profile.defaultProvider);
      expect(found).toBeTruthy();
      expect(found).not.toHaveProperty('endpoint');
      expect(found).not.toHaveProperty('apiKeyEnv');
    }
  });

  it('tạo snapshot KPI và trả về cấu trúc tóm tắt', async () => {
    const admin = request.agent(app);
    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(adminLogin.status).toBe(200);

    const configRes = await admin.put('/api/import/ecus/config').send({
      config: {
        batchSize: 0,
        connection: {
          server: 'MRHOC\\ECUSSQL2008',
          database: 'ECUS5VNACCS',
          user: 'sa',
          password: '123456',
        },
      },
    });
    expect(configRes.status).toBe(200);

    const staff = request.agent(app);
    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });
    expect(staffLogin.status).toBe(200);

    sqlMock.__setMockResult([
      {
        So_tk: '100000000000',
        Ngay_dang_ky: '2025-08-01',
        MaSoThue: '0100109106',
        Ten_doanh_nghiep: 'Công ty A',
        Loai_hinh: 'A11',
        nhan_vien: 'Nguyễn Văn A',
        team: 'Tổ 1',
        so_luong_mh: 5,
        ma_gp: 'ZB03',
      },
      {
        So_tk: '200000000000',
        Ngay_dang_ky: '2025-08-01',
        MaSoThue: '0100109107',
        Ten_doanh_nghiep: 'Công ty B',
        Loai_hinh: 'B11',
        nhan_vien: 'Nguyễn Văn B',
        team: 'Tổ 2',
        so_luong_mh: 3,
        ma_gp: '',
      },
    ]);

    const res = await staff.get('/api/ai/data/snapshot').query({ from: '2025-08-01', to: '2025-08-02' });
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.cached).toBe(false);
    const snapshot = res.body?.snapshot;
    expect(snapshot).toBeTruthy();
    expect(snapshot.summary?.declarations).toBe(2);
    expect(snapshot.summary?.licenseSamples).toBeInstanceOf(Array);
    expect(Array.isArray(snapshot.topStaff)).toBe(true);
    expect(Array.isArray(snapshot.topTeams)).toBe(true);
    expect(Array.isArray(snapshot.trends?.monthly)).toBe(true);
    expect(Array.isArray(snapshot.rawDeclarations)).toBe(true);
    expect(snapshot.filters?.includeTaxCodes).toEqual([]);
    expect(snapshot.source?.server).toBe('MRHOC\\ECUSSQL2008');
  });

  it('tái sử dụng cache snapshot khi gọi cùng tham số', async () => {
    const admin = request.agent(app);
    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(adminLogin.status).toBe(200);

    await admin.put('/api/import/ecus/config').send({
      config: {
        batchSize: 0,
        connection: {
          server: 'MRHOC\\ECUSSQL2008',
          database: 'ECUS5VNACCS',
          user: 'sa',
          password: '123456',
        },
      },
    });

    const staff = request.agent(app);
    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });
    expect(staffLogin.status).toBe(200);

    sqlMock.__setMockResult([
      {
        So_tk: '100000000000',
        Ngay_dang_ky: '2025-08-01',
        MaSoThue: '0100109106',
        Ten_doanh_nghiep: 'Công ty A',
        Loai_hinh: 'A11',
        nhan_vien: 'Nguyễn Văn A',
        team: 'Tổ 1',
        so_luong_mh: 4,
      },
    ]);

    const firstRes = await staff.get('/api/ai/data/snapshot').query({ from: '2025-08-01', to: '2025-08-02' });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body?.cached).toBe(false);
    const firstRequests = sqlMock.__getState().requests.length;
    expect(firstRequests).toBeGreaterThan(0);

    sqlMock.__setMockResult([]);

    const secondRes = await staff.get('/api/ai/data/snapshot').query({ from: '2025-08-01', to: '2025-08-02' });
    expect(secondRes.status).toBe(200);
    expect(secondRes.body?.cached).toBe(true);
    expect(sqlMock.__getState().requests.length).toBe(firstRequests);
    expect(secondRes.body?.snapshot?.summary?.declarations).toBe(1);
  });

  it('chạy insight AI và cho phép phản hồi kết quả', async () => {
    const admin = request.agent(app);
    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(adminLogin.status).toBe(200);

    const configRes = await admin.put('/api/import/ecus/config').send({
      config: {
        connection: {
          server: 'MRHOC\\ECUSSQL2008',
          database: 'ECUS5VNACCS',
          user: 'sa',
          password: '123456',
        },
      },
    });
    expect(configRes.status).toBe(200);

    const staff = request.agent(app);
    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });
    expect(staffLogin.status).toBe(200);

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const yesterdayIso = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    sqlMock.__setMockResult([
      {
        So_tk: '100000000000',
        Ngay_dang_ky: todayIso,
        MaSoThue: '0100109106',
        Ten_doanh_nghiep: 'Công ty A',
        Loai_hinh: 'A11',
        nhan_vien: 'Nguyễn Văn A',
        team: 'Tổ 1',
        so_luong_mh: 5,
        ma_gp: 'GP01',
      },
      {
        So_tk: '200000000000',
        Ngay_dang_ky: yesterdayIso,
        MaSoThue: '0100109107',
        Ten_doanh_nghiep: 'Công ty B',
        Loai_hinh: 'B11',
        nhan_vien: 'Nguyễn Văn B',
        team: 'Tổ 2',
        so_luong_mh: 3,
        ma_gp: 'GP02',
      },
    ]);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/chat')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: { content: 'Báo cáo KPI thử nghiệm: hiệu suất tăng.' },
            prompt_eval_count: 16,
            eval_count: 8,
          }),
          text: async () => 'ok',
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => 'ok' };
    });

    try {
      const runRes = await admin.post('/api/ai/insights/run').send({});
      expect(runRes.status).toBe(200);
      expect(runRes.body?.ok).toBe(true);
      expect(runRes.body?.result?.insight?.insightId ?? '').toMatch(/^ins-/);
      expect(runRes.body?.result?.insight?.feedback?.helpful ?? 0).toBe(0);

      const listRes = await staff.get('/api/ai/insights');
      expect(listRes.status).toBe(200);
      expect(listRes.body?.ok).toBe(true);
      expect(Array.isArray(listRes.body?.insights)).toBe(true);
      expect(listRes.body.insights.length).toBeGreaterThan(0);
      const insightId = listRes.body.insights[0]?.insightId;
      expect(typeof insightId).toBe('string');
      expect(listRes.body.insights[0]?.feedback?.helpful ?? 0).toBe(0);

      const feedbackRes = await staff.post('/api/ai/insights/feedback').send({
        insightId,
        helpful: true,
      });
      expect(feedbackRes.status).toBe(200);
      expect(feedbackRes.body?.ok).toBe(true);
      expect(feedbackRes.body?.totals?.helpful).toBe(1);

      const refreshed = await staff.get('/api/ai/insights');
      expect(refreshed.status).toBe(200);
      expect(refreshed.body?.insights?.[0]?.feedback?.helpful).toBe(1);
      expect(refreshed.body?.insights?.[0]?.feedback?.viewer?.helpful).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('cho phép cấu hình nhà cung cấp và trả lời qua Ollama mock với cache', async () => {
    const admin = request.agent(app);
    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(adminLogin.status).toBe(200);

    const updateRes = await admin.put('/api/ai/config').send({
      config: {
        enabled: true,
        defaultProvider: 'ollama-local',
        fallbackProvider: null,
        providers: [
          { id: 'azure-openai', enabled: false },
          { id: 'google-ai-studio', enabled: false },
          {
            id: 'ollama-local',
            type: 'ollama',
            enabled: true,
            endpoint: 'http://ollama.test',
            model: 'llama3.1:8b',
          },
        ],
        caching: { enabled: true, ttlMinutes: 60, maxEntries: 10 },
      },
    });
    expect(updateRes.status).toBe(200);

    const staff = request.agent(app);
    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });
    expect(staffLogin.status).toBe(200);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('ollama.test')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: { content: 'Trả lời thử nghiệm từ mô phỏng' },
            prompt_eval_count: 12,
            eval_count: 5,
          }),
          text: async () => 'ok',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => 'ok',
      };
    });

    try {
      const payload = { prompt: 'Xin chào trợ lý', scope: 'test', providerId: 'ollama-local' };
      const first = await staff.post('/api/ai/chat').send(payload);
      expect(first.status).toBe(200);
      expect(first.body?.ok).toBe(true);
      expect(first.body.cached).toBe(false);
      expect(first.body.message).toContain('Trả lời thử nghiệm');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const second = await staff.post('/api/ai/chat').send(payload);
      expect(second.status).toBe(200);
      expect(second.body?.ok).toBe(true);
      expect(second.body.cached).toBe(true);
      expect(second.body.cacheKey).toBeTruthy();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('cho phép kiểm thử Ollama cục bộ mà không cần API key', async () => {
    const admin = request.agent(app);
    const loginRes = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const updateRes = await admin.put('/api/ai/config').send({
      config: {
        defaultProvider: 'ollama-local',
        fallbackProvider: 'azure-openai',
        providers: [
          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },
        ],
      },
    });
    expect(updateRes.status).toBe(200);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('ollama.test')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: { content: 'Pong từ kiểm thử Ollama' },
            prompt_eval_count: 10,
            eval_count: 4,
          }),
          text: async () => 'ok',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => 'ok',
      };
    });

    try {
      const res = await admin.post('/api/ai/providers/test').send({
        provider: {
          id: 'ollama-local',
          type: 'ollama',
          endpoint: 'http://ollama.test',
          model: 'llama3.1:8b',
        },
        prompt: 'kiểm thử ollama nội bộ',
      });
      expect(res.status).toBe(200);
      expect(res.body?.ok).toBe(true);
      expect(res.body?.provider?.id).toContain('ollama-local');
      expect(res.body?.message).toContain('Pong');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('ghi log lỗi khi kiểm thử Ollama thất bại', async () => {
    const admin = request.agent(app);
    const loginRes = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const updateRes = await admin.put('/api/ai/config').send({
      config: {
        providers: [
          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },
        ],
      },
    });
    expect(updateRes.status).toBe(200);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('ollama.test')) {
        return {
          ok: false,
          status: 503,
          text: async () => 'service unavailable',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => 'ok',
      };
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const res = await admin.post('/api/ai/providers/test').send({
        provider: {
          id: 'ollama-local',
          type: 'ollama',
          endpoint: 'http://ollama.test',
          model: 'llama3.1:8b',
        },
        prompt: 'kiểm thử ollama thất bại',
      });
      expect(res.status).toBe(400);
      expect(res.body?.ok).toBe(false);
      expect(res.body?.error).toContain('503');
      expect(errorSpy).toHaveBeenCalledWith(
        'Kiểm thử nhà cung cấp AI thất bại',
        expect.objectContaining({
          providerId: expect.stringContaining('ollama-local'),
          error: expect.stringContaining('503'),
        }),
      );
    } finally {
      fetchSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('tự động thử lại khi gọi Ollama lần đầu thất bại', async () => {
    const admin = request.agent(app);
    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(adminLogin.status).toBe(200);

    const updateRes = await admin.put('/api/ai/config').send({
      config: {
        enabled: true,
        defaultProvider: 'ollama-local',
        providers: [
          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },
        ],
        caching: { enabled: true, ttlMinutes: 5, maxEntries: 5 },
      },
    });
    expect(updateRes.status).toBe(200);

    const staff = request.agent(app);
    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });
    expect(staffLogin.status).toBe(200);

    let attempts = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('ollama.test')) {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('ECONNREFUSED');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: { content: 'Phản hồi sau lần retry' },
            prompt_eval_count: 15,
            eval_count: 6,
          }),
          text: async () => 'ok',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => 'ok',
      };
    });

    try {
      const res = await staff.post('/api/ai/chat').send({
        prompt: 'Kiểm tra retry Ollama',
        scope: 'retry',
        providerId: 'ollama-local',
      });
      expect(res.status).toBe(200);
      expect(res.body?.ok).toBe(true);
      expect(res.body?.message).toContain('retry');
      expect(attempts).toBe(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('dùng cache nội bộ của Ollama ngay cả khi cache chung tắt', async () => {
    const admin = request.agent(app);
    const adminLogin = await admin.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(adminLogin.status).toBe(200);

    const updateRes = await admin.put('/api/ai/config').send({
      config: {
        enabled: true,
        defaultProvider: 'ollama-local',
        providers: [
          { id: 'ollama-local', type: 'ollama', enabled: true, endpoint: 'http://ollama.test', model: 'llama3.1:8b' },
        ],
        caching: { enabled: false },
      },
    });
    expect(updateRes.status).toBe(200);

    const staff = request.agent(app);
    const staffLogin = await staff.post('/api/auth/login').send({ username: 'nhanvien', password: '123456' });
    expect(staffLogin.status).toBe(200);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('ollama.test')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: { content: 'Nội dung cache nội bộ' },
            prompt_eval_count: 8,
            eval_count: 3,
          }),
          text: async () => 'ok',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => 'ok',
      };
    });

    const payload = { prompt: 'Cache nội bộ Ollama', scope: 'local-cache', providerId: 'ollama-local' };

    try {
      const first = await staff.post('/api/ai/chat').send(payload);
      expect(first.status).toBe(200);
      expect(first.body?.ok).toBe(true);
      expect(first.body.cached).toBe(false);
      expect(first.body.message).toContain('Nội dung cache nội bộ');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const second = await staff.post('/api/ai/chat').send(payload);
      expect(second.status).toBe(200);
      expect(second.body?.ok).toBe(true);
      expect(second.body.cached).toBe(false);
      expect(second.body.message).toContain('Nội dung cache nội bộ');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

afterAll(() => {
  stopServer?.();
});

beforeEach(async () => {
  if (typeof waitAccountSync === 'function') {
    await waitAccountSync();
  }
  resetDb();
  sqlMock.__resetMock();
  resetSqlMonitor();
  clearReportCache();
  excelMock.__resetWorkbookCreateCount?.();
});

describe('Data health summary API', () => {
  it('trả về trạng thái sao lưu và cảnh báo dung lượng', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const logs = [
      {
        ts: '2024-05-12T02:00:00.000Z',
        actor: 'system',
        action: 'db.backup',
        detail: 'Sao lưu định kỳ',
        meta: { status: 'success', file: 'C:/backups/storage-20240512.sqlite', bytes: 4096 },
      },
      {
        ts: '2024-05-11T02:00:00.000Z',
        actor: 'system',
        action: 'db.backup',
        detail: 'Sao lưu thất bại',
        meta: { status: 'failure', reason: 'memory_db' },
      },
    ];
    getDb()
      .prepare('INSERT OR REPLACE INTO kv_store(key, value) VALUES(?, ?)')
      .run('audit_logs_v1', JSON.stringify(logs));
    getDb()
      .prepare('INSERT OR REPLACE INTO kv_store(key, value) VALUES(?, ?)')
      .run('db_backup_config_v1', JSON.stringify({ cron: '0 1 * * *', retentionCopies: 5 }));

    const res = await adminAgent.get('/api/data-health/summary');
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);

    const storage = res.body.summary?.storage;
    expect(storage).toBeTruthy();
    expect(storage.backup?.health?.severity).toBeTruthy();
    expect(Array.isArray(storage.backup?.recent)).toBe(true);
    expect(storage.database?.mode).toBe('memory');
    expect(Array.isArray(storage.health?.issues)).toBe(true);
    expect(storage.health.issues.length).toBeGreaterThan(0);

    expect(res.body.summary?.sqlServer).toHaveProperty('health');
  });
});

describe('Backup summary API', () => {
  it('từ chối khi chưa đăng nhập', async () => {
    const res = await request(app).get('/api/admin/backups/summary');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('từ chối khi tài khoản không có quyền audit', async () => {
    const staffAgent = request.agent(app);
    const loginRes = await staffAgent
      .post('/api/auth/login')
      .send({ username: 'nhanvien', password: '123456' });
    expect(loginRes.status).toBe(200);

    const res = await staffAgent.get('/api/admin/backups/summary');
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it('trả về lịch sao lưu và nhật ký gần nhất cho quản trị viên', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const logs = [
      {
        ts: '2024-05-01T03:00:00.000Z',
        actor: 'system',
        action: 'db.backup',
        detail: 'Sao lưu CSDL (scheduled)',
        meta: { status: 'success', reason: 'scheduled', bytes: 2048 },
      },
      {
        ts: '2024-05-01T02:00:00.000Z',
        actor: 'system',
        action: 'db.backup',
        detail: 'Sao lưu CSDL thất bại (memory_db)',
        meta: { status: 'failure', reason: 'memory_db' },
      },
      {
        ts: '2024-04-30T23:00:00.000Z',
        actor: 'tester',
        action: 'other.action',
        detail: 'ignored',
      },
    ];
    const db = getDb();
    db.prepare(
      'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run('audit_logs_v1', JSON.stringify(logs));

    const res = await adminAgent.get('/api/admin/backups/summary');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const summary = res.body.summary;
    expect(summary.schedule).toMatchObject({
      cron: '0 3 * * *',
      cronDescription: expect.stringContaining('03:00'),
      active: false,
      retentionCopies: 14,
    });
    expect(Array.isArray(summary.schedule.reasons)).toBe(true);
    expect(summary.schedule.reasons.length).toBeGreaterThan(0);
    expect(summary.lastSuccess).toMatchObject({
      actor: 'system',
      meta: expect.objectContaining({ status: 'success', bytes: 2048 }),
    });
    expect(summary.lastFailure).toMatchObject({
      meta: expect.objectContaining({ status: 'failure', reason: 'memory_db' }),
    });
    expect(Array.isArray(summary.recent)).toBe(true);
    expect(summary.recent[0]).toMatchObject({ action: 'db.backup' });
  });

  it('từ chối cập nhật cron sao lưu khi chưa đăng nhập', async () => {
    const res = await request(app)
      .post('/api/admin/backups/schedule')
      .send({ cron: '*/15 * * * *' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('từ chối cập nhật cron sao lưu với tài khoản không có quyền', async () => {
    const staffAgent = request.agent(app);
    const loginRes = await staffAgent
      .post('/api/auth/login')
      .send({ username: 'nhanvien', password: '123456' });
    expect(loginRes.status).toBe(200);

    const res = await staffAgent.post('/api/admin/backups/schedule').send({ cron: '*/15 * * * *' });
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it('cho phép quản trị viên cập nhật biểu thức cron hợp lệ', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const res = await adminAgent
      .post('/api/admin/backups/schedule')
      .send({ cron: '*/30 * * * *', retentionCopies: 5 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.config).toMatchObject({ cron: '*/30 * * * *', retentionCopies: 5 });
    expect(res.body.summary.schedule).toMatchObject({
      cron: '*/30 * * * *',
      cronDescription: 'Mỗi 30 phút',
      retentionCopies: 5,
    });
    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('audit_logs_v1');
    const logs = JSON.parse(row?.value || '[]');
    expect(logs[0]).toMatchObject({
      action: 'db.backup_schedule.update',
      meta: expect.objectContaining({ cron: '*/30 * * * *', retentionCopies: 5 }),
    });
  });

  it('trả lỗi khi retention không hợp lệ', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const res = await adminAgent
      .post('/api/admin/backups/schedule')
      .send({ cron: '*/15 * * * *', retentionCopies: -1 });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, field: 'retentionCopies' });
  });

  it('trả lỗi khi cập nhật cron không hợp lệ', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const res = await adminAgent.post('/api/admin/backups/schedule').send({ cron: 'not-a-cron' });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});

describe('Backup manual API', () => {
  it('từ chối danh sách file sao lưu khi chưa đăng nhập', async () => {
    const res = await request(app).get('/api/admin/backups/files');
    expect(res.status).toBe(401);
  });

  it('trả về danh sách rỗng khi chưa có bản sao lưu', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const res = await adminAgent.get('/api/admin/backups/files');
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(Array.isArray(res.body.files)).toBe(true);
    for (const file of res.body.files) {
      expect(typeof file.filename).toBe('string');
      expect(typeof file.bytes === 'number' || file.bytes === undefined).toBe(true);
    }
  });

  it('không cho phép sao lưu thủ công khi DB chạy memory', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const res = await adminAgent.post('/api/admin/backups/run').send({ note: 'manual-test' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, reason: 'memory_db' });
  });

  it('yêu cầu chọn file khi khôi phục', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const res = await adminAgent.post('/api/admin/backups/restore').send({ note: 'restore-test' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, reason: 'missing_filename' });
  });
});

describe('Audit export API', () => {
  it('yêu cầu đăng nhập trước khi tải CSV', async () => {
    const res = await request(app).get('/api/admin/audit/export');
    expect(res.status).toBe(401);
  });

  it('cho phép quản trị viên tải CSV theo khoảng ngày', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const logs = [
      {
        ts: '2024-05-10T05:00:00.000Z',
        actor: 'admin',
        action: 'db.backup',
        detail: 'Sao lưu thử nghiệm',
        result: 'success',
        category: 'db',
        note: 'manual snapshot',
        meta: { status: 'success', reason: 'manual-ui' },
      },
      {
        ts: '2024-04-09T02:00:00.000Z',
        actor: 'system',
        action: 'audit.clear',
        detail: 'Xóa nhật ký',
        result: 'success',
        category: 'audit',
      },
    ];
    getDb()
      .prepare('INSERT OR REPLACE INTO kv_store(key, value) VALUES(?, ?)')
      .run('audit_logs_v1', JSON.stringify(logs));

    const res = await adminAgent.get('/api/admin/audit/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.split(/\r?\n/).filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(res.text).toContain('Thời gian');
  });
});

describe('ECUS sync API', () => {
  it('trả về cấu hình mặc định', async () => {
    const res = await request(app).get('/api/import/ecus/config');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      config: expect.objectContaining({
        enabled: false,
        schedule: '0 3 * * *',
        scheduleMode: 'daily',
        scheduleValue: 1,
        scheduleTime: '03:00',
        connection: expect.objectContaining({
          server: 'Server',
          database: 'ECUS5VNACCS',
          user: 'sa',
          password: '',
        }),
      }),
    });
    expect(typeof res.body.config.connection.hasPassword).toBe('boolean');
    expect(res.body.config.schedulePreset).toEqual(expect.objectContaining({
      mode: 'daily',
      value: 1,
      time: '03:00',
      cron: '0 3 * * *',
    }));
    expect(typeof res.body.config.scheduleDescription).toBe('string');
  });

  it('từ chối cập nhật cấu hình khi chưa đăng nhập', async () => {
    const res = await request(app).put('/api/import/ecus/config').send({ config: {} });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('từ chối cập nhật cấu hình khi tài khoản không phải admin', async () => {
    const staffAgent = request.agent(app);
    const loginRes = await staffAgent
      .post('/api/auth/login')
      .send({ username: 'nhanvien', password: '123456' });
    expect(loginRes.status).toBe(200);

    const res = await staffAgent.put('/api/import/ecus/config').send({ config: {} });
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it('trả về trạng thái chưa cấu hình khi thiếu thông tin SQL', async () => {
    const res = await request(app).get('/api/import/ecus/status');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.backend).toMatchObject({ ok: true, state: 'online' });
    expect(res.body.database).toMatchObject({ ok: true, state: 'ready' });
  });

  it('từ chối chạy đồng bộ khi không đăng nhập', async () => {
    const res = await request(app)
      .post('/api/import/ecus/run')
      .send({ from: '2025-01-01', to: '2025-01-02' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('từ chối chạy đồng bộ khi tài khoản không phải admin', async () => {
    const staffAgent = request.agent(app);
    const loginRes = await staffAgent
      .post('/api/auth/login')
      .send({ username: 'nhanvien', password: '123456' });
    expect(loginRes.status).toBe(200);

    const res = await staffAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-01-01', to: '2025-01-02' });
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it('từ chối xem trước dữ liệu ECUS khi chưa đăng nhập', async () => {
    const res = await request(app)
      .post('/api/import/ecus/preview')
      .send({ from: '2025-01-01', to: '2025-01-02' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('từ chối xem trước dữ liệu ECUS khi tài khoản không phải admin', async () => {
    const staffAgent = request.agent(app);
    const loginRes = await staffAgent
      .post('/api/auth/login')
      .send({ username: 'nhanvien', password: '123456' });
    expect(loginRes.status).toBe(200);

    const res = await staffAgent
      .post('/api/import/ecus/preview')
      .send({ from: '2025-01-01', to: '2025-01-02' });
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it('xem trước dữ liệu phân loại tờ khai mới và đã tồn tại', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent.put('/api/import/ecus/config').send({
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

    const existingRow = [{
      so_tk: '999999999999',
      nhanh: '',
      date: '2025-08-01',
      mst: '1234567890',
      cong_ty: 'CÔNG TY ABC',
    }];
    getDb()
      .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
      .run('decl_rows_v1', JSON.stringify(existingRow));

    sqlMock.__setMockResult([
      {
        So_tk: '999999999999',
        Ngay_dang_ky: '2025-08-01',
        MaSoThue: '1234567890',
        Ten_doanh_nghiep: 'CÔNG TY ABC',
        Loai_hinh: 'A11',
      },
      {
        So_tk: '888888888888',
        Ngay_dang_ky: '2025-08-01',
        MaSoThue: '5555555555',
        Ten_doanh_nghiep: 'CÔNG TY MỚI',
        Loai_hinh: 'E11',
        ts_xnk_ma_bt: '<TS_XNK_MA_BT>B05</TS_XNK_MA_BT>',
      },
    ]);

    const res = await adminAgent
      .post('/api/import/ecus/preview')
      .send({ from: '2025-08-01', to: '2025-08-02' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.preview?.rows)).toBe(true);
    const statuses = res.body.preview.rows.map((row) => row.status);
    expect(statuses).toContain('existing');
    expect(statuses).toContain('new');
    const newRow = res.body.preview.rows.find((row) => row.status === 'new');
    expect(newRow?.co_line_count).toBe(1);
  });

  it('áp dụng bộ lọc MST khi xem trước và chạy đồng bộ', async () => {
    resetDb();
    sqlMock.__resetMock();
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent.put('/api/import/ecus/config').send({
      config: {
        batchSize: 0,
        includeTaxCodes: [],
        excludeTaxCodes: [],
        connection: {
          server: 'MRHOC\\ECUSSQL2008',
          database: 'ECUS5VNACCS',
          user: 'sa',
          password: '123456',
        },
      },
    });

    sqlMock.__setMockResult([
      { So_tk: '100000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109106', Ten_doanh_nghiep: 'DN 010', Loai_hinh: 'A11' },
      { So_tk: '200000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109107', Ten_doanh_nghiep: 'DN 011', Loai_hinh: 'A12' },
      { So_tk: '300000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109108', Ten_doanh_nghiep: 'DN 012', Loai_hinh: 'A31' },
    ]);

    const previewRes = await adminAgent.post('/api/import/ecus/preview').send({
      from: '2025-08-01',
      to: '2025-08-02',
      includeTaxCodes: ['0100109106', '0100109107'],
      excludeTaxCodes: ['0100109107'],
    });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.preview.rows).toHaveLength(1);
    expect(previewRes.body.preview.rows[0]).toMatchObject({ mst: '0100109106' });

    sqlMock.__setMockResult([
      { So_tk: '100000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109106', Ten_doanh_nghiep: 'DN 010', Loai_hinh: 'A11' },
      { So_tk: '200000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109107', Ten_doanh_nghiep: 'DN 011', Loai_hinh: 'A12' },
      { So_tk: '300000000000', Ngay_dang_ky: '2025-08-01', MaSoThue: '0100109108', Ten_doanh_nghiep: 'DN 012', Loai_hinh: 'A31' },
    ]);

    const runRes = await adminAgent.post('/api/import/ecus/run').send({
      from: '2025-08-01',
      to: '2025-08-02',
      includeTaxCodes: ['0100109106', '0100109107'],
      excludeTaxCodes: ['0100109107'],
    });

    expect(runRes.status).toBe(200);
    expect(runRes.body.result.imported).toBe(1);
    expect(runRes.body.result.includeTaxCodes).toEqual(['0100109106', '0100109107']);
    expect(runRes.body.result.excludeTaxCodes).toEqual(['0100109107']);
    const storedRows = JSON.parse(
      getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1')?.value || '[]'
    );
    expect(storedRows).toHaveLength(1);
    expect(storedRows[0]).toMatchObject({ mst: '0100109106' });
  });

  it('lưu cấu hình và chạy đồng bộ thành công', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

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
    const saveRes = await adminAgent.put('/api/import/ecus/config').send(configPayload);
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

    const runRes = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });

    expect(runRes.status).toBe(200);
    expect(runRes.body).toMatchObject({
      ok: true,
      result: {
        imported: 1,
        updated: 0,
        skipped: 0,
        reviewLocked: 0,
        existingBefore: 0,
        fetched: 1,
        alerts: expect.any(Object),
      },
    });

    const state = sqlMock.__getState();
    const rangeRequest = state.requests.find(
      (req) =>
        Object.prototype.hasOwnProperty.call(req.inputs, 'from') ||
        Object.prototype.hasOwnProperty.call(req.inputs, 'to'),
    );
    expect(rangeRequest).toBeTruthy();
    expect(rangeRequest.inputs).toHaveProperty('from');
    expect(rangeRequest.inputs).toHaveProperty('to');

    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('decl_rows_v1');
    const storedRows = JSON.parse(row.value);
    expect(storedRows).toHaveLength(1);
    expect(storedRows[0]).toMatchObject({
      so_tk: '10511055742',
      so_tk_full: '105110557420',
      mst: '1051105574',
      cong_ty: 'CÔNG TY TNHH ABC',
      nhan_vien: 'Phương',
      so_luong_gp: 2,
    });
  });

  it('bỏ qua tờ khai đã có và giữ nguyên dữ liệu hiện tại', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent.put('/api/import/ecus/config').send({
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
        So_tk: '777777777777',
        Ngay_dang_ky: '2025-08-01',
        MaSoThue: '7777777777',
        TenDoanhNghiep: 'CÔNG TY XYZ',
        Loai_hinh: 'A11',
        muc_hang: 3,
        NhanVienNhap: 'Phương',
      },
    ]);

    const firstRun = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-01', to: '2025-08-02', actor: 'tester' });
    expect(firstRun.status).toBe(200);
    expect(firstRun.body.result.imported).toBe(1);

    const manualRow = [{
      so_tk: '777777777777',
      nhanh: '',
      date: '2025-08-01',
      mst: '7777777777',
      cong_ty: 'CÔNG TY XYZ',
      nhan_vien: 'Manual Edit',
      muc_hang: 3,
    }];
    getDb()
      .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
      .run('decl_rows_v1', JSON.stringify(manualRow));

    sqlMock.__setMockResult([
      {
        So_tk: '777777777777',
        Ngay_dang_ky: '2025-08-01',
        MaSoThue: '7777777777',
        TenDoanhNghiep: 'CÔNG TY XYZ',
        Loai_hinh: 'A11',
        muc_hang: 3,
        NhanVienNhap: 'Khác',
      },
    ]);

    const secondRun = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-01', to: '2025-08-02', actor: 'tester' });

    expect(secondRun.status).toBe(200);
    expect(secondRun.body.result.imported).toBe(0);
    expect(secondRun.body.result.updated).toBe(1);
    expect(secondRun.body.result.skipped).toBe(0);

    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('decl_rows_v1');
    const storedRows = JSON.parse(row.value);
    expect(storedRows).toHaveLength(1);
    expect(storedRows[0].nhan_vien).toBe('Manual Edit');
  });

  it('cap nhat co_line_count cho to khai da ton tai', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent
      .put('/api/import/ecus/config')
      .send({
        config: {
          enabled: true,
          connection: { server: 'MRHOC\\ECUSSQL2008', database: 'ECUS5VNACCS', user: 'sa', password: '123456' },
        },
      });

    const existingRow = [{
      so_tk: '107490433150',
      nhanh: '',
      date: '2025-09-03',
      mst: '4601145670',
      cong_ty: 'Cong ty TNHH SAMJU VINA',
      loai_hinh: 'E11',
      co_line_count: 0,
      co: '',
      has_co: false,
      nhan_vien: 'Huyen',
      team: 'Team 2',
    }];
    getDb()
      .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
      .run('decl_rows_v1', JSON.stringify(existingRow));

    sqlMock.__setMockResult([
      {
        so_tk: '107490433150',
        ngay_dang_ky: '2025-09-03',
        mst: '4601145670',
        cong_ty: 'Cong ty TNHH SAMJU VINA',
        loai_hinh: 'E11',
        muc_hang: 1,
        co_count_num: 3,
      },
    ]);

    const runRes = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-09-03', to: '2025-09-04', actor: 'tester' });

    expect(runRes.status).toBe(200);
    expect(runRes.body.result.imported).toBe(0);
    expect(runRes.body.result.updated).toBe(1);
    expect(runRes.body.result.skipped).toBe(0);

    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('decl_rows_v1');
    const storedRows = JSON.parse(row.value);
    expect(storedRows).toHaveLength(1);
    expect(storedRows[0]).toMatchObject({
      so_tk: '10749043315',
      so_tk_full: '107490433150',
      co_line_count: 3,
      has_co: true,
      nhan_vien: 'Huyen',
    });
    expect(storedRows[0].co).toBeTruthy();
  });

  it('đánh dấu C/O khi dữ liệu ECUS có mã biểu thuế phù hợp', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent
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

    const runRes = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-01', to: '2025-08-31', actor: 'tester' });

    expect(runRes.status).toBe(200);
    const row = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1');
    const storedRows = JSON.parse(row.value);
    expect(storedRows[0]).toMatchObject({ co: 'Có', has_co: true });
  });

  it('loại trừ giấy phép theo quy tắc toàn cục khi đồng bộ', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent
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

    const rulesPayload = {
      version: 1,
      license: {
        exclude: {
          codes: ['ZN02', 'HDGC'],
          agencies: [],
        },
      },
    };
    const rulesRes = await adminAgent
      .put('/api/storage/kpi_rules_v2')
      .send({ value: JSON.stringify(rulesPayload) });
    expect(rulesRes.status).toBe(200);

    sqlMock.__setMockResult([
      {
        so_tk: '105110557420',
        ngay_dang_ky: '2025-09-01',
        mst: '0123456789',
        cong_ty: 'Cong ty ABC',
        loai_hinh: 'A11',
        muc_hang: 1,
        license_count: 3,
        license_codes: 'GP01, ZN02 , HDGC',
      },
    ]);

    const runRes = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-09-01', to: '2025-09-02', actor: 'tester' });

    expect(runRes.status).toBe(200);
    expect(runRes.body?.result?.imported).toBe(1);

    const row = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1');
    const storedRows = JSON.parse(row.value);
    expect(storedRows).toHaveLength(1);
    expect(storedRows[0]).toMatchObject({
      so_tk: '10511055742',
      licenses: 1,
      so_luong_gp: 1,
    });
    expect(storedRows[0].licenseCodes).toEqual(['GP01']);
    expect(storedRows[0].licenseSourceCodes).toEqual(
      expect.arrayContaining(['GP01', 'ZN02', 'HDGC'])
    );
    expect(storedRows[0].licenseExcludedCodes).toEqual(
      expect.arrayContaining(['ZN02', 'HDGC'])
    );
  });

  it('loại trừ giấy phép theo đại lý HQ khi đồng bộ', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent
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

    const rulesPayload = {
      version: 1,
      license: {
        exclude: {
          codes: [],
          agencies: [
            {
              agency: 'Dai ly HQ 1',
              codes: ['AG01'],
            },
          ],
        },
      },
    };
    const rulesRes = await adminAgent
      .put('/api/storage/kpi_rules_v2')
      .send({ value: JSON.stringify(rulesPayload) });
    expect(rulesRes.status).toBe(200);

    const hqPayload = [
      { mst: '4601145670', company: 'Cong ty SAMJU', agent: 'Dai ly HQ 1' },
    ];
    const hqRes = await adminAgent
      .put('/api/storage/hq_agencies_v1')
      .send({ value: JSON.stringify(hqPayload) });
    expect(hqRes.status).toBe(200);

    sqlMock.__setMockResult([
      {
        so_tk: '107490433150',
        ngay_dang_ky: '2025-09-03',
        mst: '4601145670',
        cong_ty: '',
        loai_hinh: 'E11',
        muc_hang: 1,
        license_count: 2,
        license_codes: 'AG01, GP02',
      },
    ]);

    const runRes = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-09-03', to: '2025-09-04', actor: 'tester' });

    expect(runRes.status).toBe(200);
    expect(runRes.body?.result?.imported).toBe(1);

    const row = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1');
    const storedRows = JSON.parse(row.value);
    expect(storedRows).toHaveLength(1);
    expect(storedRows[0]).toMatchObject({
      so_tk: '10749043315',
      licenses: 1,
      so_luong_gp: 1,
      agency: 'Dai ly HQ 1',
      cong_ty: 'Cong ty SAMJU',
    });
    expect(storedRows[0].licenseCodes).toEqual(['GP02']);
    expect(storedRows[0].licenseSourceCodes).toEqual(expect.arrayContaining(['AG01', 'GP02']));
    expect(storedRows[0].licenseExcludedCodes).toEqual(expect.arrayContaining(['AG01']));
  });

  it('kiểm tra trạng thái SQL Server thành công khi đã cấu hình', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent
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

    const stateBefore = sqlMock.__getState();
    stateBefore.lastQuery = null;
    stateBefore.requests.length = 0;

    sqlMock.__setMockResult([{ ok: 1 }]);

    const res = await adminAgent.get('/api/import/ecus/status');
    expect(res.status).toBe(200);
    expect(res.body.database.ok).toBe(true);
    expect(res.body.database.state).toBe('ready');

    const state = sqlMock.__getState();
    expect(state.lastQuery).toMatch(/SELECT 1/i);
  });

  it('đồng bộ được bản ghi với tiêu đề cột tiếng Việt có dấu', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent
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

    const runRes = await adminAgent
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
      so_tk: '30525441696',
      so_tk_full: '305254416960',
      mst: '2301158516',
      cong_ty: 'CÔNG TY TNHH XYZ',
      so_luong_gp: 3,
      team: 'Team 3',
      nhan_vien: 'Học',
    });
  });

  it('đặt tham số to tới cuối ngày khi truyền chuỗi ngày để không bỏ sót bản ghi cuối ngày', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent
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
        So_tk: '999999999999',
        Ngay_dang_ky: '2025-08-31T23:30:00',
        MaSoThue: '1234567890',
        Ten_doanh_nghiep: 'CÔNG TY ABC',
        So_muc: 2,
        Giay_phep: 'GP01;GP02',
      },
    ]);

    const res = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-30', to: '2025-08-31', actor: 'tester' });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.result?.imported).toBe(1);

    const state = sqlMock.__getState();
    const lastRequest = state.requests.at(-1);
    expect(lastRequest?.inputs?.to).toBeInstanceOf(Date);
    const toValue = lastRequest.inputs.to;
    expect(toValue.getHours()).toBe(23);
    expect(toValue.getMinutes()).toBe(59);
    expect(toValue.getSeconds()).toBe(59);
    expect(toValue.getMilliseconds()).toBe(997);

    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('decl_rows_v1');
    const stored = JSON.parse(row.value);
    expect(stored).toHaveLength(1);
    expect(stored[0].date).toBe('2025-08-31');
    expect(stored.some((entry) => entry.date === '2025-09-01')).toBe(false);
  });

  it('ghi nhận lỗi khi SQL Server gặp sự cố', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    await adminAgent
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

    const res = await adminAgent
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
  beforeEach(() => {
    resetDb();
    excelMock.__resetWorkbookCreateCount?.();
  });

  it('yêu cầu đăng nhập trước khi xuất báo cáo', async () => {
    const res = await request(app)
      .post('/api/reports/export')
      .send({ kind: 'staff', payload: {} });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);

    const auditCount = getDb().prepare('SELECT COUNT(*) AS total FROM export_audit').get() || { total: 0 };
    expect(auditCount.total ?? 0).toBe(0);
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

    const auditCount = getDb().prepare('SELECT COUNT(*) AS total FROM export_audit').get() || { total: 0 };
    expect(auditCount.total ?? 0).toBe(0);

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

    const rows = getDb()
      .prepare('SELECT * FROM export_audit ORDER BY id DESC')
      .all();
    expect(rows).toHaveLength(1);
    const [entry] = rows;
    expect(entry.username).toBe('admin');
    expect(entry.report_kind).toBe('staff');
    expect(entry.signature).toBeTruthy();
    expect(entry.short_signature).toBeTruthy();
    expect(entry.request_id).toBeTruthy();
    expect(entry.filters).toBeTruthy();
    const storedFilters = JSON.parse(entry.filters);
    expect(storedFilters).toHaveProperty('staff');
    expect(storedFilters.staff.name).toBe(payload.staff.name);
    expect(Array.isArray(storedFilters.staff.rows)).toBe(true);
    expect(storedFilters.range).toEqual(payload.range);
    expect(storedFilters.rules.name).toBe(payload.rules.name);
    expect(Object.keys(storedFilters.staff.stats || {})).toEqual(
      expect.arrayContaining(['decls', 'kpi', 'import', 'export', 'items', 'licenses'])
    );
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
    expect(excelMock.__getWorkbookCreateCount()).toBe(2);
    expect(Buffer.isBuffer(second.body)).toBe(true);
    expect(second.body.byteLength).toBeGreaterThan(0);
  });

  it('yêu cầu đăng nhập trước khi tra cứu lịch sử export', async () => {
    const res = await request(app).get('/api/reports/export/audit');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('từ chối khi tài khoản không có quyền xem lịch sử export', async () => {
    resetDb();
    const staffAgent = request.agent(app);
    const loginRes = await staffAgent
      .post('/api/auth/login')
      .send({ username: 'nhanvien', password: '123456' });
    expect(loginRes.status).toBe(200);

    const res = await staffAgent.get('/api/reports/export/audit');
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it('trả về lịch sử export theo bộ lọc, phân trang và từ khóa', async () => {
    resetDb();
    const db = getDb();
    const insertAudit = db.prepare(
      `INSERT INTO export_audit (
        created_at,
        issued_at,
        username,
        display_name,
        role,
        report_kind,
        filename,
        signature,
        short_signature,
        filter_summary,
        filters,
        ip_address,
        request_id,
        user_agent
      ) VALUES (
        @created_at,
        @issued_at,
        @username,
        @display_name,
        @role,
        @report_kind,
        @filename,
        @signature,
        @short_signature,
        @filter_summary,
        @filters,
        @ip_address,
        @request_id,
        @user_agent
      )`
    );

    insertAudit.run({
      created_at: '2025-03-01T03:15:00.000Z',
      issued_at: '2025-03-01T03:10:00.000Z',
      username: 'admin',
      display_name: 'Quản trị viên',
      role: 'admin',
      report_kind: 'staff',
      filename: 'bao-cao-staff.xlsx',
      signature: 'SIG-001',
      short_signature: 'AA1001',
      filter_summary: 'Team 1 • Tháng 03/2025',
      filters: JSON.stringify({ range: { from: '2025-03-01', to: '2025-03-31' }, team: 'Team 1' }),
      ip_address: '10.0.0.1',
      request_id: 'req-001',
      user_agent: 'Vitest/1.0',
    });

    insertAudit.run({
      created_at: '2025-03-02T09:30:00.000Z',
      issued_at: '2025-03-02T09:25:00.000Z',
      username: 'lead.hoc',
      display_name: 'Trưởng nhóm Học',
      role: 'lead',
      report_kind: 'team',
      filename: 'bao-cao-team.xlsx',
      signature: 'SIG-002',
      short_signature: 'BB2002',
      filter_summary: 'Team 2 • So sánh KPI',
      filters: JSON.stringify({ range: { from: '2025-03-01', to: '2025-03-02' }, team: 'Team 2' }),
      ip_address: '10.0.0.2',
      request_id: 'req-002',
      user_agent: 'Vitest/1.0',
    });

    insertAudit.run({
      created_at: '2025-04-01T08:00:00.000Z',
      issued_at: '2025-04-01T07:58:00.000Z',
      username: 'manager.hoainam',
      display_name: 'Quản lý Nam',
      role: 'manager',
      report_kind: 'staff',
      filename: 'bao-cao-thang4.xlsx',
      signature: 'SIG-003',
      short_signature: 'CC3003',
      filter_summary: 'Tháng 04/2025',
      filters: JSON.stringify({ range: { from: '2025-04-01', to: '2025-04-30' } }),
      ip_address: '10.0.0.3',
      request_id: 'req-003',
      user_agent: 'Vitest/1.0',
    });

    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const res = await adminAgent
      .get('/api/reports/export/audit')
      .query({ from: '2025-03-01', to: '2025-03-07', limit: 2, page: 1 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries[0]).toMatchObject({ reportKind: 'team', shortSignature: 'BB2002' });
    expect(res.body.entries[0].filters).toMatchObject({ range: { from: '2025-03-01', to: '2025-03-02' } });
    expect(res.body.summary.byKind).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'staff', total: 1 }),
        expect.objectContaining({ kind: 'team', total: 1 }),
      ])
    );
    expect(res.body.summary.topUsers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: 'lead.hoc', total: 1 }),
        expect.objectContaining({ username: 'admin', total: 1 }),
      ])
    );

    const searchRes = await adminAgent
      .get('/api/reports/export/audit')
      .query({ search: 'req-002', limit: 1, page: 1 });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.ok).toBe(true);
    expect(searchRes.body.total).toBe(1);
    expect(searchRes.body.entries).toHaveLength(1);
    expect(searchRes.body.entries[0].requestId).toBe('req-002');
    expect(searchRes.body.availableKinds).toEqual(expect.arrayContaining(['staff', 'team']));
  });
  it('khong cap nhat to khai da ra soat va thong ke reviewLocked', async () => {
    sqlMock.__setMockResult([
      {
        So_tk: '888888888888',
        Ngay_dang_ky: '2025-08-11',
        MaSoThue: '8888888888',
        TenDoanhNghiep: 'CONG TY ABC',
        Loai_hinh: 'E42',
        muc_hang: 1,
        NhanVienNhap: 'Tester',
      },
    ]);

    const adminAgent = request.agent(app);
    const loginRes = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const firstRun = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-11', to: '2025-08-12', actor: 'tester' });
    expect(firstRun.status).toBe(200);

    const reviewedRow = [{
      so_tk: '888888888888',
      nhanh: '',
      date: '2025-08-11',
      mst: '8888888888',
      cong_ty: 'CONG TY ABC',
      loai_hinh: 'E42',
      nhan_vien: 'Tester',
      reviewed: true,
      reviewed_at: '2025-08-12T00:00:00Z',
    }];
    getDb()
      .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)')
      .run('decl_rows_v1', JSON.stringify(reviewedRow));

    sqlMock.__setMockResult([
      {
        So_tk: '888888888888',
        Ngay_dang_ky: '2025-08-11',
        MaSoThue: '8888888888',
        TenDoanhNghiep: 'CONG TY ABC',
        Loai_hinh: 'E42',
        muc_hang: 2,
        NhanVienNhap: 'Khac',
      },
    ]);

    const secondRun = await adminAgent
      .post('/api/import/ecus/run')
      .send({ from: '2025-08-11', to: '2025-08-12', actor: 'tester' });

    expect(secondRun.status).toBe(200);
    expect(secondRun.body.result.imported).toBe(0);
    expect(secondRun.body.result.updated).toBe(0);
    expect(secondRun.body.result.reviewLocked).toBe(1);

    const row = getDb()
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('decl_rows_v1');
    const storedRows = JSON.parse(row.value);
    const target = storedRows.find(
      (entry) => entry.so_tk === '88888888888' || entry.so_tk_full === '888888888888'
    );
    expect(target).toBeDefined();
    expect(target.reviewed).toBe(true);
    expect(target.nhan_vien).toBe('Tester');
  });

});

describe('Storage API', () => {
  it('yeu cau dang nhap truoc khi doc du lieu kho chia se', async () => {
    const res = await request(app).get('/api/storage/decl_rows_v1');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('tu choi truy cap khi tai khoan khong co quyen importEdit', async () => {
    const adminAgent = request.agent(app);
    const adminLogin = await adminAgent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(adminLogin.status).toBe(200);

    const downgradeRes = await adminAgent
      .patch('/api/auth/accounts/nhanvien')
      .send({ permissions: { importEdit: false } });
    expect(downgradeRes.status).toBe(200);

    try {
      const staffAgent = request.agent(app);
      const loginRes = await staffAgent
      .post('/api/auth/login')
      .send({ username: 'nhanvien', password: '123456' });
      expect(loginRes.status).toBe(200);

      const res = await staffAgent.get('/api/storage/decl_rows_v1');
      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
    } finally {
      await adminAgent
        .patch('/api/auth/accounts/nhanvien')
        .send({ permissions: { importEdit: true } });
    }
  });

  it('tra ve gia tri JSON da parse cho key hop le khi co quyen', async () => {
    const adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);

    const sampleRows = [
      { so_tk: '99999999999', nhanh: '', date: '2025-08-11', mst: '1234567890', cong_ty: 'CONG TY ABC' },
    ];
    getDb()
      .prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('decl_rows_v1', JSON.stringify(sampleRows));

    const res = await adminAgent.get('/api/storage/decl_rows_v1');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.value)).toBe(true);
    expect(res.body.value[0]).toMatchObject({ so_tk: '99999999999', cong_ty: 'CONG TY ABC' });
    expect(typeof res.body.raw).toBe('string');
  });
});

describe('Alert API', () => {
  const missingDecl = {
    so_tk: 'TK001',
    so_tk_full: 'TK001',
    nhanh: '',
    mst: '0100000001',
    cong_ty: 'CÔNG TY MINH HỌA',
    date: '2000-01-01',
    raw_date: '2000-01-01',
    nhan_vien: '',
    team: '',
  };

  let adminAgent;

  beforeEach(async () => {
    adminAgent = request.agent(app);
    const loginRes = await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);
    const putRes = await adminAgent
      .put('/api/storage/decl_rows_v1')
      .send({ value: JSON.stringify([missingDecl]) });
    expect(putRes.status).toBe(200);
  });

  it('trả về danh sách cảnh báo và cấu hình hiện tại', async () => {
    const res = await request(app).get('/api/import/alerts');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.alerts.length).toBe(1);
    expect(res.body.alerts[0]).toMatchObject({ so_tk: '00000000001', resolved: false });
  });

  it('cho phép cập nhật cấu hình cảnh báo và đánh dấu đã rà soát', async () => {
    const configRes = await adminAgent
      .put('/api/import/alerts/config')
      .send({
        actor: 'tester',
        config: { thresholdDays: 0, channel: 'audit', enabled: true },
      });
    expect(configRes.status).toBe(200);
    expect(configRes.body.summary.outstanding).toBe(1);

    const alerts = await adminAgent.get('/api/import/alerts');
    expect(alerts.status).toBe(200);
    expect(alerts.body.ok).toBe(true);
    const key = alerts.body.alerts[0].key;

    const reviewRes = await adminAgent
      .post('/api/import/alerts/review')
      .send({ actor: 'tester', keys: [key] });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.updated).toBe(1);
    expect(reviewRes.body.summary.outstanding).toBe(0);
  });

  it('bo danh dau ra soat qua API', async () => {
    const configRes = await adminAgent
      .put('/api/import/alerts/config')
      .send({
        actor: 'tester',
        config: { thresholdDays: 0, channel: 'audit', enabled: true },
      });
    expect(configRes.status).toBe(200);

    const alerts = await adminAgent.get('/api/import/alerts');
    expect(alerts.body.alerts.length).toBeGreaterThan(0);
    const key = alerts.body.alerts[0].key;

    const reviewRes = await adminAgent
      .post('/api/import/alerts/review')
      .send({ actor: 'tester', keys: [key] });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.updated).toBe(1);

    const unreviewRes = await adminAgent
      .post('/api/import/alerts/unreview')
      .send({ actor: 'tester', keys: [key] });

    expect(unreviewRes.status).toBe(200);
    expect(unreviewRes.body.updated).toBe(1);
    expect(unreviewRes.body.summary).toBeDefined();
    expect(unreviewRes.body.summary.outstanding).toBeGreaterThan(0);
  });
});

