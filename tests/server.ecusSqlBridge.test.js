import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  connectionPools,
  getSecureSqlCredentialsMock,
  queryMock,
} = vi.hoisted(() => ({
  connectionPools: [],
  getSecureSqlCredentialsMock: vi.fn(() => ({
    server: 'SECURE-SRV',
    database: 'SECURE-DB',
    user: 'secure-user',
    password: 'secure-pass',
  })),
  queryMock: vi.fn(),
}));

class MockConnectionPool {
  constructor(config) {
    this.config = config;
    this.connected = false;
    this.connect = vi.fn(async () => {
      this.connected = true;
      return this;
    });
    this.close = vi.fn(async () => {
      this.connected = false;
    });
    this.request = vi.fn(() => ({
      timeout: undefined,
      input: vi.fn().mockReturnThis(),
      query: queryMock,
    }));
    connectionPools.push(this);
  }
}

vi.mock('../apps/ecus-bridge/src/bridgeSecureCredentials.js', () => ({
  getSecureSqlCredentials: getSecureSqlCredentialsMock,
}));

vi.mock('mssql', () => ({
  default: {
    NVarChar: Symbol.for('mssql.NVarChar'),
    ConnectionPool: MockConnectionPool,
  },
}));

async function importModule() {
  return import('../apps/ecus-bridge/src/sqlBridge.js');
}

describe('ecus sql bridge', () => {
  beforeEach(() => {
    connectionPools.length = 0;
    getSecureSqlCredentialsMock.mockClear();
    queryMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('builds SQL connection config from app config plus secure credentials', async () => {
    const module = await importModule();

    const connectionConfig = module.buildSqlConnectionConfig({
      connection: {
        server: '  APP-SRV  ',
        options: { encrypt: true },
        port: '1435',
        connectionTimeout: '7000',
        requestTimeout: '8000',
        pool: { max: 10 },
      },
    });

    expect(getSecureSqlCredentialsMock).toHaveBeenCalledTimes(1);
    expect(connectionConfig).toEqual({
      server: 'APP-SRV',
      database: 'SECURE-DB',
      user: 'secure-user',
      password: 'secure-pass',
      options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      port: 1435,
      connectionTimeout: 7000,
      requestTimeout: 8000,
      pool: { max: 10 },
    });
  });

  it('caches pagination capability detection per server/database pair', async () => {
    queryMock.mockResolvedValue({
      recordset: [
        {
          productVersion: '10.50.6000.34',
          edition: 'Express Edition',
          compatibilityLevel: 100,
        },
      ],
    });

    const module = await importModule();
    module.resetSqlCapabilityCache();

    const request = {
      timeout: undefined,
      input: vi.fn().mockReturnThis(),
      query: queryMock,
    };
    const pool = {
      request: vi.fn(() => request),
    };

    const first = await module.resolveSqlPaginationCapabilities(
      pool,
      { server: 'LEGACY-SQL', database: 'ECUS5VNACCS' },
      4500,
    );
    const second = await module.resolveSqlPaginationCapabilities(
      pool,
      { server: 'LEGACY-SQL', database: 'ECUS5VNACCS' },
      4500,
    );

    expect(first).toEqual({
      productVersion: '10.50.6000.34',
      edition: 'Express Edition',
      compatibilityLevel: 100,
      supportsOffsetFetch: false,
    });
    expect(second).toEqual(first);
    expect(pool.request).toHaveBeenCalledTimes(1);
    expect(request.input).toHaveBeenCalledWith('dbName', Symbol.for('mssql.NVarChar'), 'ECUS5VNACCS');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('reuses a pool for the same core config and recreates it when the server changes', async () => {
    const module = await importModule();
    const manager = module.createSqlPoolManager();

    const first = await manager.getPool({
      server: 'SRV-01',
      database: 'ECUS',
      user: 'sa',
      password: 'secret',
      requestTimeout: 9000,
    });
    const second = await manager.getPool({
      server: 'SRV-01',
      database: 'ECUS',
      user: 'sa',
      password: 'secret',
      requestTimeout: 12000,
    });
    const third = await manager.getPool({
      server: 'SRV-02',
      database: 'ECUS',
      user: 'sa',
      password: 'secret',
      requestTimeout: 12000,
    });

    expect(first).toBe(second);
    expect(connectionPools).toHaveLength(2);
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(third).not.toBe(first);

    await manager.close();
    expect(third.close).toHaveBeenCalledTimes(1);
  });
});
