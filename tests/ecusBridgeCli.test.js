import { describe, expect, it, vi } from 'vitest';

import {
  createStandaloneEcusBridgeCli,
  isDirectRun,
} from '../apps/ecus-bridge/src/bridgeCli.js';

function createFakeProcess(argv = ['node', 'E:\\GPT\\kpi_source_code_v4\\apps\\ecus-bridge\\src\\bridgeCli.js']) {
  const listeners = new Map();
  return {
    argv,
    on: vi.fn((event, handler) => {
      listeners.set(event, handler);
    }),
    off: vi.fn((event, handler) => {
      if (listeners.get(event) === handler) {
        listeners.delete(event);
      }
    }),
    getListener(event) {
      return listeners.get(event);
    },
  };
}

describe('ecus bridge cli', () => {
  it('starts the standalone bridge app and registers signal handlers', async () => {
    const server = {
      start: vi.fn(async () => ({
        host: '127.0.0.1',
        port: 9191,
        url: 'http://127.0.0.1:9191',
      })),
      stop: vi.fn(async () => {}),
    };
    const app = {
      server,
      sqlPoolManager: { close: vi.fn(async () => {}) },
    };
    const createAppImpl = vi.fn(() => app);
    const logger = { info: vi.fn(), error: vi.fn() };
    const processObject = createFakeProcess();

    const cli = createStandaloneEcusBridgeCli({
      createAppImpl,
      logger,
      processObject,
      exitImpl: vi.fn(),
    });
    const started = await cli.start();

    expect(createAppImpl).toHaveBeenCalledTimes(1);
    expect(server.start).toHaveBeenCalledTimes(1);
    expect(started).toEqual(
      expect.objectContaining({
        app,
        address: expect.objectContaining({
          url: 'http://127.0.0.1:9191',
        }),
      }),
    );
    expect(processObject.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processObject.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith(
      'Standalone ECUS bridge listening.',
      expect.objectContaining({
        url: 'http://127.0.0.1:9191',
      }),
    );
  });

  it('stops the bridge app and exits cleanly when it receives a signal', async () => {
    const stop = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const server = {
      start: vi.fn(async () => ({
        host: '127.0.0.1',
        port: 9191,
        url: 'http://127.0.0.1:9191',
      })),
      stop,
    };
    const app = {
      server,
      sqlPoolManager: { close },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const exitImpl = vi.fn();
    const processObject = createFakeProcess();

    const cli = createStandaloneEcusBridgeCli({
      createAppImpl: () => app,
      logger,
      processObject,
      exitImpl,
    });

    await cli.start();
    await cli.handleSignal('SIGINT');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(processObject.off).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processObject.off).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(exitImpl).toHaveBeenCalledWith(0);
    expect(logger.info).toHaveBeenCalledWith(
      'Received shutdown signal for standalone ECUS bridge.',
      expect.objectContaining({ signal: 'SIGINT' }),
    );
  });

  it('cleans up sql resources when the bridge server fails to start', async () => {
    const startupError = new Error('listen failed');
    const close = vi.fn(async () => {});
    const app = {
      server: {
        start: vi.fn(async () => {
          throw startupError;
        }),
        stop: vi.fn(async () => {}),
      },
      sqlPoolManager: { close },
    };
    const logger = { info: vi.fn(), error: vi.fn() };

    const cli = createStandaloneEcusBridgeCli({
      createAppImpl: () => app,
      logger,
      processObject: createFakeProcess(),
      exitImpl: vi.fn(),
    });

    await expect(cli.start()).rejects.toThrow('listen failed');
    expect(close).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to start standalone ECUS bridge.',
      startupError,
    );
  });

  it('detects direct execution from argv and module url', () => {
    expect(
      isDirectRun(
        'file:///E:/GPT/kpi_source_code_v4/apps/ecus-bridge/src/bridgeCli.js',
        ['node', 'E:\\GPT\\kpi_source_code_v4\\apps\\ecus-bridge\\src\\bridgeCli.js'],
      ),
    ).toBe(true);
    expect(
      isDirectRun(
        'file:///E:/GPT/kpi_source_code_v4/apps/ecus-bridge/src/bridgeCli.js',
        ['node', 'E:\\GPT\\kpi_source_code_v4\\tests\\ecusBridgeCli.test.js'],
      ),
    ).toBe(false);
  });
});
