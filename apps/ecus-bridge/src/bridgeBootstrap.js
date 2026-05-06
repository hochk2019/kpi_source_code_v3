import { createEcusBridgeService } from '../../../packages/backend-shared/src/ecus/bridgeService.js';

import { createEcusBridgeApiClient } from './bridgeApiClient.js';
import { createStandaloneEcusBridgeHost } from './bridgeHost.js';
import { createStandaloneEcusBridgeHttpServer } from './bridgeHttpServer.js';
import { createStandaloneEcusBridgeRuntime } from './bridgeRuntime.js';
import { createSqlPoolManager } from './sqlBridge.js';

const DEFAULT_HOSTNAME = '127.0.0.1';
const DEFAULT_PORT = 0;

function normalizeStr(value) {
  return `${value ?? ''}`.trim();
}

function normalizeMST(value) {
  return normalizeStr(value).replace(/\s+/gu, '');
}

function toNullableString(value) {
  const text = normalizeStr(value);
  return text || null;
}

function toISODate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeRangeDate(value, { isEnd = false } = {}) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (isEnd) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function toPort(value, fallback = DEFAULT_PORT) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : fallback;
}

function buildBridgeServiceDeps({ sqlPoolManager, logger }) {
  return {
    getEcusConfig: () => ({ connection: {} }),
    sqlPoolManager,
    loadAccountRecords: () => [],
    persistAccountRecords: () => {},
    sortAccountRecords: (records) => records,
    normalizeAccountRecordForStorage: (record) => record ?? {},
    normalizeRoleKey: (role) => normalizeStr(role) || 'user',
    normalizePermissionsForRole: (permissions) => permissions ?? {},
    normalizeAccountUpdatedAt: (value) => new Date(value ?? Date.now()).toISOString(),
    toNullableString,
    normalizeMST,
    normalizeStr,
    toISODate,
    safeParse,
    getValue: () => null,
    upsertValue: () => {},
    normalizeRangeDate,
    logger,
  };
}

export function createStandaloneEcusBridgeApp({
  baseUrl,
  bridgeToken,
  controlToken = '',
  hostname = DEFAULT_HOSTNAME,
  port = DEFAULT_PORT,
  fetchImpl = globalThis.fetch,
  logger = console,
  createSqlPoolManagerImpl = createSqlPoolManager,
  createBridgeServiceImpl = createEcusBridgeService,
  createApiClientImpl = createEcusBridgeApiClient,
  createRuntimeImpl = createStandaloneEcusBridgeRuntime,
  createHostImpl = createStandaloneEcusBridgeHost,
  createHttpServerImpl = createStandaloneEcusBridgeHttpServer,
} = {}) {
  const sqlPoolManager = createSqlPoolManagerImpl();
  const apiClient = createApiClientImpl({
    baseUrl,
    token: bridgeToken,
    fetchImpl,
  });
  const bridgeService = createBridgeServiceImpl(
    buildBridgeServiceDeps({ sqlPoolManager, logger }),
  );
  const runtime = createRuntimeImpl({ bridgeService, apiClient });
  const host = createHostImpl({ runtime, bridgeService });
  const server = createHttpServerImpl({
    host,
    controlToken,
    hostname,
    port,
  });

  return {
    sqlPoolManager,
    bridgeService,
    apiClient,
    runtime,
    host,
    server,
  };
}

export function createStandaloneEcusBridgeAppFromEnv({
  env = process.env,
  ...overrides
} = {}) {
  return createStandaloneEcusBridgeApp({
    baseUrl: normalizeStr(env.KPI_CORE_API_URL || env.ECUS_CORE_API_URL),
    bridgeToken: normalizeStr(env.KPI_ECUS_BRIDGE_TOKEN || env.ECUS_BRIDGE_TOKEN),
    controlToken: normalizeStr(env.ECUS_BRIDGE_CONTROL_TOKEN),
    hostname: normalizeStr(env.ECUS_BRIDGE_HOST) || DEFAULT_HOSTNAME,
    port: toPort(env.ECUS_BRIDGE_PORT, DEFAULT_PORT),
    ...overrides,
  });
}
