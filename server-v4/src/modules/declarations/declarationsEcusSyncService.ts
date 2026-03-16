import { createRequire } from 'node:module';

import { normalizeStr } from '../../legacy/legacy-normalizers.js';
import {
  createDefaultEcusSyncConfig,
  formatEcusSyncConfigForClient,
  mergeEcusSyncConfig,
  normalizeEcusSyncConfig,
  type EcusSyncConfigDocument,
} from './ecusSyncConfig.js';
import type { DeclarationActor, DeclarationsStore } from './declarationsStore.js';
import { DeclarationsHttpError } from './declarationsService.js';

type SqlRequestLike = {
  timeout?: number;
  query: (statement: string) => Promise<unknown>;
};

type SqlPoolLike = {
  request: () => SqlRequestLike;
};

type SqlPoolManager = {
  getPool: (config: Record<string, unknown>) => Promise<SqlPoolLike>;
  close: () => Promise<void>;
};

type SqlBridgeModule = {
  buildSqlConnectionConfig: (config: unknown) => Record<string, unknown>;
  createSqlPoolManager: () => SqlPoolManager;
};

const require = createRequire(import.meta.url);
const { buildSqlConnectionConfig, createSqlPoolManager } =
  require('../../../../apps/ecus-bridge/src/sqlBridge.js') as SqlBridgeModule;

export type EcusSqlHealthCheck = (
  config: EcusSyncConfigDocument,
) => Promise<Record<string, unknown>>;

export function createDefaultEcusSqlHealthCheck(): EcusSqlHealthCheck {
  return async (config) => {
    const connectionConfig = buildSqlConnectionConfig(config);
    const server = normalizeStr(connectionConfig.server);
    const database = normalizeStr(connectionConfig.database);
    if (!server || !database) {
      return {
        ok: false,
        state: 'not_configured',
        message: 'Chưa cấu hình máy chủ hoặc cơ sở dữ liệu SQL Server',
      };
    }

    const sqlPoolManager = createSqlPoolManager();
    try {
      const pool = await sqlPoolManager.getPool(connectionConfig);
      const request = pool.request();
      const timeout = Number(connectionConfig.requestTimeout ?? 5000);
      if (Number.isFinite(timeout) && timeout > 0) {
        request.timeout = timeout;
      }

      await request.query('SELECT 1 AS ok');
      return {
        ok: true,
        state: 'ready',
        server,
        database,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorRecord = isRecord(error) ? error : {};
      return {
        ok: false,
        state: isSqlTimeoutError(error) ? 'timeout' : 'error',
        message: error instanceof Error ? error.message : 'Không thể kết nối SQL Server',
        code: errorRecord.code ?? null,
        number: errorRecord.number ?? null,
        checkedAt: new Date().toISOString(),
      };
    } finally {
      await sqlPoolManager.close();
    }
  };
}

export class DeclarationsEcusSyncService {
  constructor(
    private readonly store: DeclarationsStore,
    private readonly sqlHealthCheck: EcusSqlHealthCheck = createDefaultEcusSqlHealthCheck(),
  ) {}

  async readConfig(actor: DeclarationActor): Promise<
    ReturnType<typeof formatEcusSyncConfigForClient>
  > {
    this.requireSyncManager(actor);
    return formatEcusSyncConfigForClient(await this.readConfigInternal());
  }

  async updateConfig(
    actor: DeclarationActor,
    patch: Record<string, unknown>,
    options: {
      preservePassword?: boolean;
    } = {},
  ): Promise<ReturnType<typeof formatEcusSyncConfigForClient>> {
    this.requireSyncManager(actor);
    const current = await this.readConfigInternal();
    const merged = mergeEcusSyncConfig(current, patch, {
      preservePassword: options.preservePassword === true,
    });
    const next: EcusSyncConfigDocument = {
      ...merged,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.username,
    };
    const stored = await this.store.writeEcusSyncConfig(next, actor.username);
    return formatEcusSyncConfigForClient(stored);
  }

  async readStatus(actor: DeclarationActor): Promise<{
    backend: {
      ok: true;
      state: 'online';
      checkedAt: string;
    };
    database: Record<string, unknown>;
    config: ReturnType<typeof formatEcusSyncConfigForClient>;
  }> {
    this.requireSyncManager(actor);
    const config = await this.readConfigInternal();
    const [database] = await Promise.all([this.sqlHealthCheck(config)]);

    return {
      backend: {
        ok: true,
        state: 'online',
        checkedAt: new Date().toISOString(),
      },
      database: normalizeSqlHealthPayload(database),
      config: formatEcusSyncConfigForClient(config),
    };
  }

  private async readConfigInternal(): Promise<EcusSyncConfigDocument> {
    const stored = await this.store.readEcusSyncConfig();
    return stored ? normalizeEcusSyncConfig(stored) : createDefaultEcusSyncConfig();
  }

  private requireSyncManager(actor: DeclarationActor): void {
    if (actor.permissions?.syncManage === true) {
      return;
    }

    throw new DeclarationsHttpError(
      403,
      'forbidden',
      'Tài khoản hiện không có quyền quản lý đồng bộ ECUS.',
    );
  }
}

function normalizeSqlHealthPayload(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return { ...value };
  }

  return {
    ok: false,
    state: 'error',
    message: 'Không thể kiểm tra trạng thái SQL Server',
  };
}

function isSqlTimeoutError(value: unknown): boolean {
  const record = isRecord(value) ? value : {};
  const code = normalizeStr(record.code).toUpperCase();
  const message =
    value instanceof Error ? value.message.toLowerCase() : normalizeStr(record.message).toLowerCase();
  return code.includes('TIMEOUT') || message.includes('timeout') || message.includes('timed out');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
