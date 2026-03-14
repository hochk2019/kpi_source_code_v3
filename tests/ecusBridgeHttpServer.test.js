import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStandaloneEcusBridgeHttpServer } from '../apps/ecus-bridge/src/bridgeHttpServer.js';

async function readJson(response) {
  return response.json();
}

describe('ecus bridge http server', () => {
  let runningServer = null;

  afterEach(async () => {
    if (runningServer) {
      await runningServer.stop();
      runningServer = null;
    }
  });

  it('serves health snapshots without requiring control auth', async () => {
    const host = {
      getStatus: vi.fn(async ({ refreshHealth }) => ({
        busy: false,
        activeOperation: null,
        health: {
          ok: true,
          state: refreshHealth ? 'ready' : 'cached',
        },
      })),
      previewSync: vi.fn(),
      runSync: vi.fn(),
    };

    runningServer = createStandaloneEcusBridgeHttpServer({
      host,
      controlToken: 'bridge-secret',
    });
    const { url } = await runningServer.start();

    const response = await fetch(`${url}/health`);
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        service: 'ecus-bridge',
        status: expect.objectContaining({
          health: expect.objectContaining({
            ok: true,
            state: 'ready',
          }),
        }),
      }),
    );
    expect(host.getStatus).toHaveBeenCalledWith({ refreshHealth: true });
  });

  it('rejects protected routes when the control token is missing or invalid', async () => {
    const host = {
      getStatus: vi.fn(async () => ({ busy: false, activeOperation: null, health: null })),
      previewSync: vi.fn(),
      runSync: vi.fn(),
    };

    runningServer = createStandaloneEcusBridgeHttpServer({
      host,
      controlToken: 'bridge-secret',
    });
    const { url } = await runningServer.start();

    const missing = await fetch(`${url}/status`);
    const invalid = await fetch(`${url}/status`, {
      headers: {
        Authorization: 'Bearer nope',
      },
    });

    expect(missing.status).toBe(401);
    expect(await readJson(missing)).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'Thiếu bridge control token.',
      }),
    );
    expect(invalid.status).toBe(403);
    expect(await readJson(invalid)).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'Bridge control token không hợp lệ.',
      }),
    );
  });

  it('forwards authenticated run requests to the bridge host', async () => {
    const host = {
      getStatus: vi.fn(async () => ({ busy: false, activeOperation: null, health: null })),
      previewSync: vi.fn(),
      runSync: vi.fn(async (payload) => ({
        imported: 4,
        actor: payload.actor,
        reason: payload.reason,
      })),
    };

    runningServer = createStandaloneEcusBridgeHttpServer({
      host,
      controlToken: 'bridge-secret',
    });
    const { url } = await runningServer.start();

    const response = await fetch(`${url}/sync/run`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer bridge-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actor: 'bridge-service',
        reason: 'scheduled',
        from: '2026-03-01',
        to: '2026-03-02',
      }),
    });
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(host.runSync).toHaveBeenCalledWith({
      actor: 'bridge-service',
      reason: 'scheduled',
      from: '2026-03-01',
      to: '2026-03-02',
    });
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          imported: 4,
          actor: 'bridge-service',
          reason: 'scheduled',
        }),
      }),
    );
  });

  it('maps busy host errors to HTTP 409 responses', async () => {
    const host = {
      getStatus: vi.fn(async () => ({ busy: true, activeOperation: 'run', health: null })),
      previewSync: vi.fn(async () => {
        const error = new Error('ECUS bridge đang bận xử lý run');
        error.code = 'bridge_busy';
        error.activeOperation = 'run';
        throw error;
      }),
      runSync: vi.fn(),
    };

    runningServer = createStandaloneEcusBridgeHttpServer({
      host,
      controlToken: 'bridge-secret',
    });
    const { url } = await runningServer.start();

    const response = await fetch(`${url}/sync/preview`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer bridge-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: '2026-03-01', to: '2026-03-03' }),
    });
    const payload = await readJson(response);

    expect(response.status).toBe(409);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'ECUS bridge đang bận xử lý run',
        code: 'bridge_busy',
        activeOperation: 'run',
      }),
    );
  });
});
