import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  preparedExecutions: [],
  queryHandler: vi.fn(async () => ({ recordset: [] })),
  transactionInstances: [],
}));

function createRequest(owner = null) {
  const request = {
    owner,
    timeout: undefined,
    input: vi.fn().mockReturnThis(),
    query: vi.fn(async (sqlText) => mockState.queryHandler(sqlText, { owner, request })),
  };
  return request;
}

vi.mock('mssql', () => {
  class MockTransaction {
    constructor(pool) {
      this.pool = pool;
      this.begin = vi.fn(async () => {});
      this.commit = vi.fn(async () => {});
      this.rollback = vi.fn(async () => {});
      mockState.transactionInstances.push(this);
    }
  }

  class MockRequest {
    constructor(owner) {
      const request = createRequest(owner);
      this.input = request.input;
      this.query = request.query;
      Object.defineProperty(this, 'timeout', {
        get() {
          return request.timeout;
        },
        set(value) {
          request.timeout = value;
        },
      });
    }
  }

  class MockPreparedStatement {
    constructor(owner) {
      this.owner = owner;
      this.input = vi.fn();
      this.prepare = vi.fn(async () => {});
      this.execute = vi.fn(async (params) => {
        mockState.preparedExecutions.push(params);
        return {};
      });
      this.unprepare = vi.fn(async () => {});
    }
  }

  return {
    default: {
      Int: Symbol.for('mssql.Int'),
      NVarChar: vi.fn((length = null) => ({ type: 'NVarChar', length })),
      DateTime: Symbol.for('mssql.DateTime'),
      Transaction: MockTransaction,
      Request: MockRequest,
      PreparedStatement: MockPreparedStatement,
    },
  };
});

async function importModule() {
  return import('../server/ecus/bridgeService.js');
}

function buildServiceFactory(module, overrides = {}) {
  const persistAccountRecords = vi.fn();
  const recordSqlTimeout = vi.fn();
  const base = {
    getEcusConfig: () => ({}),
    sqlPoolManager: {
      getPool: vi.fn(async () => ({
        request: vi.fn(() => createRequest()),
      })),
    },
    loadAccountRecords: () => [],
    persistAccountRecords,
    sortAccountRecords: (records) => records.sort((left, right) => left.username.localeCompare(right.username)),
    normalizeAccountRecordForStorage: (record) => ({
      username: `${record?.username ?? ''}`.trim(),
      passwordHash: `${record?.passwordHash ?? ''}`.trim(),
      role: `${record?.role ?? ''}`.trim() || 'user',
      name: `${record?.name ?? record?.username ?? ''}`.trim(),
      permissions: record?.permissions ?? {},
      updatedAt: new Date(record?.updatedAt ?? Date.now()).toISOString(),
      memberId: record?.memberId ?? null,
      memberName: record?.memberName ?? null,
      teamId: record?.teamId ?? null,
      teamName: record?.teamName ?? null,
    }),
    normalizeRoleKey: (role) => `${role ?? ''}`.trim() || 'user',
    normalizePermissionsForRole: (permissions) => permissions ?? {},
    normalizeAccountUpdatedAt: (value) => new Date(value ?? Date.now()).toISOString(),
    toNullableString: (value) => {
      const text = `${value ?? ''}`.trim();
      return text || null;
    },
    normalizeMST: (value) => `${value ?? ''}`.trim(),
    normalizeStr: (value) => `${value ?? ''}`.trim(),
    toISODate: (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
    },
    safeParse: (value, fallback) => {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    getValue: vi.fn(() => null),
    upsertValue: vi.fn(),
    normalizeRangeDate: (value, { isEnd = false } = {}) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      if (isEnd) {
        date.setHours(23, 59, 59, 999);
      }
      return date;
    },
    recordSqlTimeout,
    isSqlTimeoutError: (error) => String(error?.message || '').toLowerCase().includes('timeout'),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
    buildConnectionConfig: () => ({ server: 'LEGACY-SQL', database: 'ECUS5VNACCS' }),
    resolvePaginationCapabilities: vi.fn(async () => ({ supportsOffsetFetch: true })),
    requestTimeoutDefault: 4321,
    defaultSyncConfig: {
      query: 'SELECT mst FROM dbo.ECUS_DECLARATIONS',
      batchSize: 50,
    },
  };

  const deps = { ...base, ...overrides };
  return {
    service: module.createEcusBridgeService(deps),
    deps,
    persistAccountRecords,
    recordSqlTimeout,
  };
}

describe('ecus bridge service', () => {
  beforeEach(() => {
    mockState.preparedExecutions.length = 0;
    mockState.transactionInstances.length = 0;
    mockState.queryHandler.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('uses the default ECUS query when declaration config does not provide one', async () => {
    const module = await importModule();
    const pool = {
      request: vi.fn(() => createRequest()),
    };
    mockState.queryHandler.mockResolvedValue({
      recordset: [{ mst: '0312345678' }],
    });

    const { service, deps } = buildServiceFactory(module, {
      sqlPoolManager: {
        getPool: vi.fn(async () => pool),
      },
      resolvePaginationCapabilities: vi.fn(async () => ({ supportsOffsetFetch: false })),
    });

    const batches = [];
    for await (const batch of service.fetchDeclarations(
      { from: '2026-03-01', to: '2026-03-05' },
      { query: '', batchSize: 25 },
    )) {
      batches.push(batch);
    }

    expect(batches).toEqual([[{ mst: '0312345678' }]]);
    expect(deps.sqlPoolManager.getPool).toHaveBeenCalledTimes(1);
    expect(pool.request).toHaveBeenCalledTimes(1);
    expect(mockState.queryHandler).toHaveBeenCalledWith(
      expect.stringContaining(deps.defaultSyncConfig.query),
      expect.any(Object),
    );
  });

  it('normalizes MST history rows before pushing them to SQL Server', async () => {
    const module = await importModule();
    const pool = {
      request: vi.fn(() => createRequest()),
    };
    mockState.queryHandler.mockResolvedValue({ recordset: [] });

    const { service } = buildServiceFactory(module, {
      sqlPoolManager: {
        getPool: vi.fn(async () => pool),
      },
    });

    await service.scheduleMstHistorySyncFromJson(
      JSON.stringify([
        {
          mst: ' 0312345678 ',
          field: 'company',
          from: 'A',
          to: 'B',
          actor: 'ops',
          timestamp: '2026-03-01T08:00:00.000Z',
        },
      ]),
    );

    expect(mockState.transactionInstances).toHaveLength(1);
    expect(mockState.transactionInstances[0].begin).toHaveBeenCalledTimes(1);
    expect(mockState.transactionInstances[0].commit).toHaveBeenCalledTimes(1);
    expect(mockState.preparedExecutions).toHaveLength(1);
    expect(mockState.preparedExecutions[0]).toMatchObject({
      mst: '0312345678',
      field: 'company',
      actor: 'ops',
      from: 'A',
      to: 'B',
    });
  });

  it('pulls fresher account rows from SQL Server into local storage', async () => {
    const module = await importModule();
    const pool = {
      request: vi.fn(() => createRequest()),
    };
    mockState.queryHandler.mockImplementation(async (sqlText) => {
      if (sqlText.includes('SELECT username, password_hash')) {
        return {
          recordset: [
            {
              username: 'alice',
              password_hash: 'hash-new',
              role: 'admin',
              name: 'Alice',
              permissions: '{"alerts":true}',
              updated_at: '2026-03-02T00:00:00.000Z',
              member_id: 'm-1',
              member_name: 'Alice',
              team_id: 't-1',
              team_name: 'Ops',
            },
          ],
        };
      }
      return { recordset: [] };
    });

    const currentRecords = [
      {
        username: 'alice',
        passwordHash: 'hash-old',
        role: 'user',
        name: 'Alice',
        permissions: {},
        updatedAt: '2026-03-01T00:00:00.000Z',
        memberId: null,
        memberName: null,
        teamId: null,
        teamName: null,
      },
    ];

    const { service, persistAccountRecords } = buildServiceFactory(module, {
      sqlPoolManager: {
        getPool: vi.fn(async () => pool),
      },
      loadAccountRecords: () => currentRecords,
    });

    const changed = await service.maybeSyncAccountsFromSql({ force: true });

    expect(changed).toBe(true);
    expect(persistAccountRecords).toHaveBeenCalledWith(
      [
        {
          username: 'alice',
          passwordHash: 'hash-new',
          role: 'admin',
          name: 'Alice',
          permissions: { alerts: true },
          updatedAt: '2026-03-02T00:00:00.000Z',
          memberId: 'm-1',
          memberName: 'Alice',
          teamId: 't-1',
          teamName: 'Ops',
        },
      ],
      { skipSqlSync: true },
    );
  });

  it('reports timeout state and records telemetry when SQL health check times out', async () => {
    const module = await importModule();
    const pool = {
      request: vi.fn(() => createRequest()),
    };
    mockState.queryHandler.mockRejectedValue(new Error('timeout while connecting'));

    const { service, recordSqlTimeout } = buildServiceFactory(module, {
      sqlPoolManager: {
        getPool: vi.fn(async () => pool),
      },
    });

    const result = await service.checkSqlServerHealth();

    expect(result).toMatchObject({
      ok: false,
      state: 'timeout',
    });
    expect(recordSqlTimeout).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { actor: 'healthcheck', reason: 'status-check' },
      }),
    );
  });
});
