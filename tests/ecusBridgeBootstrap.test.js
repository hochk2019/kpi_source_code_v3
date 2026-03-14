import { describe, expect, it, vi } from 'vitest';

import {
  createStandaloneEcusBridgeApp,
  createStandaloneEcusBridgeAppFromEnv,
} from '../apps/ecus-bridge/src/bridgeBootstrap.js';

describe('ecus bridge bootstrap', () => {
  it('composes the standalone bridge app from injected factories', () => {
    const sqlPoolManager = { close: vi.fn() };
    const bridgeService = { checkSqlServerHealth: vi.fn() };
    const apiClient = { fetchSyncConfig: vi.fn() };
    const runtime = { previewSync: vi.fn(), runSync: vi.fn() };
    const host = { getStatus: vi.fn(), previewSync: vi.fn(), runSync: vi.fn() };
    const server = { start: vi.fn(), stop: vi.fn() };

    const createSqlPoolManagerImpl = vi.fn(() => sqlPoolManager);
    const createBridgeServiceImpl = vi.fn(() => bridgeService);
    const createApiClientImpl = vi.fn(() => apiClient);
    const createRuntimeImpl = vi.fn(() => runtime);
    const createHostImpl = vi.fn(() => host);
    const createHttpServerImpl = vi.fn(() => server);
    const fetchImpl = vi.fn();

    const app = createStandaloneEcusBridgeApp({
      baseUrl: 'http://core.local',
      bridgeToken: 'bridge-token',
      controlToken: 'control-token',
      hostname: '127.0.0.1',
      port: 9191,
      fetchImpl,
      createSqlPoolManagerImpl,
      createBridgeServiceImpl,
      createApiClientImpl,
      createRuntimeImpl,
      createHostImpl,
      createHttpServerImpl,
    });

    expect(createSqlPoolManagerImpl).toHaveBeenCalledTimes(1);
    expect(createApiClientImpl).toHaveBeenCalledWith({
      baseUrl: 'http://core.local',
      token: 'bridge-token',
      fetchImpl,
    });
    expect(createBridgeServiceImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        sqlPoolManager,
        getEcusConfig: expect.any(Function),
        normalizeMST: expect.any(Function),
        normalizeStr: expect.any(Function),
      }),
    );
    expect(createRuntimeImpl).toHaveBeenCalledWith({ bridgeService, apiClient });
    expect(createHostImpl).toHaveBeenCalledWith({ runtime, bridgeService });
    expect(createHttpServerImpl).toHaveBeenCalledWith({
      host,
      controlToken: 'control-token',
      hostname: '127.0.0.1',
      port: 9191,
    });
    expect(app).toEqual({
      sqlPoolManager,
      bridgeService,
      apiClient,
      runtime,
      host,
      server,
    });
  });

  it('reads standalone bridge settings from env-style input', () => {
    const createApiClientImpl = vi.fn(() => ({ fetchSyncConfig: vi.fn() }));
    const createBridgeServiceImpl = vi.fn(() => ({ checkSqlServerHealth: vi.fn() }));
    const createRuntimeImpl = vi.fn(() => ({ previewSync: vi.fn(), runSync: vi.fn() }));
    const createHostImpl = vi.fn(() => ({ getStatus: vi.fn(), previewSync: vi.fn(), runSync: vi.fn() }));
    const createHttpServerImpl = vi.fn(() => ({ start: vi.fn(), stop: vi.fn() }));
    const createSqlPoolManagerImpl = vi.fn(() => ({ close: vi.fn() }));

    createStandaloneEcusBridgeAppFromEnv({
      env: {
        KPI_CORE_API_URL: 'http://core.example',
        KPI_ECUS_BRIDGE_TOKEN: 'bridge-token',
        ECUS_BRIDGE_CONTROL_TOKEN: 'control-token',
        ECUS_BRIDGE_HOST: '0.0.0.0',
        ECUS_BRIDGE_PORT: '9393',
      },
      createSqlPoolManagerImpl,
      createBridgeServiceImpl,
      createApiClientImpl,
      createRuntimeImpl,
      createHostImpl,
      createHttpServerImpl,
    });

    expect(createApiClientImpl).toHaveBeenCalledWith({
      baseUrl: 'http://core.example',
      token: 'bridge-token',
      fetchImpl: fetch,
    });
    expect(createHttpServerImpl).toHaveBeenCalledWith({
      host: expect.any(Object),
      controlToken: 'control-token',
      hostname: '0.0.0.0',
      port: 9393,
    });
  });
});
