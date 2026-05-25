/* eslint-env node */

/* @vitest-environment node */

import { beforeAll, describe, expect, it, vi } from 'vitest';

let runHealthcheck;
let IGNORED_BACKUP_ISSUE_CODES;

beforeAll(async () => {
  ({ runHealthcheck, IGNORED_BACKUP_ISSUE_CODES } = await import('../scripts/healthcheck-core.mjs'));
});

const DEFAULT_ENV = { KPI_DISABLE_CRON: '1' };

function createLogger() {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createHealthySnapshot(overrides = {}) {
  const { storage: storageOverrides, ...snapshotOverrides } = overrides;

  return {
    storage: {
      backup: {
        recent: [{ ts: '2026-03-24T11:12:50.061Z', meta: { status: 'success' } }],
      },
      database: { sizeLabel: '23 MB', sqliteStats: { pageCount: 200, freelistCount: 50 } },
      disk: { usedLabel: '2 GB', totalLabel: '10 GB', usedPercent: 20 },
      health: {
        severity: 'good',
        issues: [],
      },
      ...storageOverrides,
    },
    ...snapshotOverrides,
  };
}

function createServerModule({
  sqlOk = true,
  sqlStatus,
  sqlError = null,
  snapshot,
  dbAvailable = true,
  dbQueryError = null,
  dbInitState,
  snapshotError = null,
} = {}) {
  return {
    DB_FILE: 'test.sqlite',
    getDatabaseHandle() {
      if (!dbAvailable) {
        return null;
      }
      return {
        prepare() {
          return {
            get() {
              if (dbQueryError) {
                throw dbQueryError;
              }
              return 1;
            },
          };
        },
      };
    },
    getDatabaseInitState() {
      return dbInitState;
    },
    async checkSqlServerHealth() {
      if (sqlError) {
        throw sqlError;
      }
      if (sqlStatus) {
        return sqlStatus;
      }
      return sqlOk ? { ok: true } : { ok: false, state: 'error', message: 'SQL down' };
    },
    async getDataHealthSnapshot() {
      if (snapshotError) {
        throw snapshotError;
      }
      return snapshot;
    },
  };
}

async function runWithServerModule(serverModule, logger = createLogger()) {
  const exitCode = await runHealthcheck({
    logger,
    env: { ...DEFAULT_ENV },
    serverModule,
    startAt: Date.now(),
  });

  return { exitCode, logger };
}

describe('healthcheck core', () => {
  it('in remediation hint khi con backup_missing', async () => {
    const getDataHealthSnapshot = vi.fn(async () => ({
      storage: {
        backup: { recent: [] },
        database: { sizeLabel: '23 MB', sqliteStats: { pageCount: 100, freelistCount: 40 } },
        disk: { usedLabel: '1 GB', totalLabel: '10 GB', usedPercent: 10.4 },
        health: {
          severity: 'critical',
          issues: [{ code: 'backup_missing', message: 'Chưa ghi nhận bản sao lưu thành công nào.' }],
        },
      },
    }));

    const { exitCode, logger } = await runWithServerModule({
        ...createServerModule(),
        getDataHealthSnapshot,
    });

    expect(exitCode).toBe(0);
    expect(getDataHealthSnapshot).toHaveBeenCalledWith({
      backupHealth: { ignoreIssueCodes: IGNORED_BACKUP_ISSUE_CODES },
    });
    expect(logger.warn).toHaveBeenCalledWith('⚠️ Cảnh báo storage (critical):');
    expect(logger.warn).toHaveBeenCalledWith('   • Chưa ghi nhận bản sao lưu thành công nào.');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('pnpm backup:run'));
  });

  it('bao healthy storage va backup latest khi khong con issue', async () => {
    const { exitCode, logger } = await runWithServerModule(
      createServerModule({ snapshot: createHealthySnapshot() })
    );

    expect(exitCode).toBe(0);
    expect(logger.log).toHaveBeenCalledWith('✅ Dung lượng lưu trữ ổn định.');
    expect(logger.log).toHaveBeenCalledWith('   • Sao lưu gần nhất: 2026-03-24T11:12:50.061Z (success)');
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('pnpm backup:run'));
  });

  it('ghi warning khi SQLite vua duoc seed lai', async () => {
    const { exitCode, logger } = await runWithServerModule(
      createServerModule({
        dbInitState: {
          seeded: true,
          insertedEntries: 7,
        },
      })
    );

    expect(exitCode).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      '⚠️ Cảnh báo: SQLite vừa được seed lại với 7 khóa mặc định. Hãy kiểm tra và khôi phục sao lưu nếu cần.'
    );
  });

  it('ghi thong tin khi SQLite bo sung khoa mac dinh con thieu', async () => {
    const { exitCode, logger } = await runWithServerModule(
      createServerModule({
        dbInitState: {
          missingInserted: 3,
        },
      })
    );

    expect(exitCode).toBe(0);
    expect(logger.log).toHaveBeenCalledWith('ℹ️ SQLite đã bổ sung 3 khóa mặc định còn thiếu trong lần khởi động này.');
  });

  it('tra ve ma loi khi khong lay duoc ket noi SQLite', async () => {
    const { exitCode, logger } = await runWithServerModule(createServerModule({ dbAvailable: false }));

    expect(exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith('Không thể lấy kết nối SQLite.');
  });

  it('tra ve ma loi khi truy van SQLite that bai du da co ket noi', async () => {
    const { exitCode, logger } = await runWithServerModule(
      createServerModule({
        dbQueryError: new Error('database locked'),
      })
    );

    expect(exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith('❌ Không thể truy vấn SQLite:', 'database locked');
  });

  it('tra ve ma loi khi khong the tai backend', async () => {
    const logger = createLogger();

    const exitCode = await runHealthcheck({
      logger,
      env: { KPI_DISABLE_CRON: '1' },
      serverModuleLoader: async () => {
        throw new Error('backend missing');
      },
      startAt: Date.now(),
    });

    expect(exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith('Không thể tải backend để kiểm tra:', 'backend missing');
  });

  it('ghi canh bao va tiep tuc khi lay snapshot that bai', async () => {
    const { exitCode, logger } = await runWithServerModule(
      createServerModule({
        snapshotError: new Error('snapshot failed'),
      })
    );

    expect(exitCode).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith('⚠️ Không thể lấy báo cáo sức khỏe dữ liệu:', 'snapshot failed');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Hoàn tất health check sau'));
  });

  it('ghi canh bao thong tin khi SQL Server chua cau hinh', async () => {
    const { exitCode, logger } = await runWithServerModule(
      createServerModule({
        sqlStatus: { ok: false, state: 'not_configured' },
      })
    );

    expect(exitCode).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith('ℹ️ SQL Server chưa cấu hình — bỏ qua kiểm tra này.');
  });

  it('ghi canh bao khi SQL Server tra ve trang thai loi', async () => {
    const { exitCode, logger } = await runWithServerModule(
      createServerModule({
        sqlStatus: { ok: false, state: 'error', message: 'SQL down' },
      })
    );

    expect(exitCode).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith('⚠️ Không thể kết nối SQL Server:', 'SQL down');
  });

  it('ghi canh bao khi kiem tra SQL Server nem loi', async () => {
    const { exitCode, logger } = await runWithServerModule(
      createServerModule({
        sqlError: new Error('driver unavailable'),
      })
    );

    expect(exitCode).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith('⚠️ Không thể kiểm tra SQL Server:', 'driver unavailable');
  });

  it('ghi canh bao khi health snapshot bao SQL Server gap van de', async () => {
    const snapshot = createHealthySnapshot({
      sqlServer: {
        health: {
          ok: false,
          state: 'timeout',
          message: 'SQL Server timeout',
        },
      },
    });
    const { exitCode, logger } = await runWithServerModule(createServerModule({ snapshot }));

    expect(exitCode).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith('⚠️ SQL Server cảnh báo:', 'SQL Server timeout');
    expect(logger.log).toHaveBeenCalledWith('✅ Dung lượng lưu trữ ổn định.');
  });

  it('ghi canh bao khi khong the thong ke day du dung luong o dia', async () => {
    const snapshot = createHealthySnapshot({
      storage: {
        disk: {
          usedLabel: '2 GB',
          totalLabel: '10 GB',
          usedPercent: 20,
          error: 'statfs failed',
        },
      },
    });
    const { exitCode, logger } = await runWithServerModule(createServerModule({ snapshot }));

    expect(exitCode).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith('   • Không thể thống kê đầy đủ dung lượng ổ đĩa: statfs failed');
    expect(logger.log).toHaveBeenCalledWith('   • Ổ đĩa: 2 GB / 10 GB (20.0% đã dùng)');
  });
});
