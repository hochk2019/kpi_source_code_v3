import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStandaloneEcusBridgeAppFromEnv } from './bridgeBootstrap.js';

function getLoggerMethod(logger, methodName) {
  if (logger && typeof logger[methodName] === 'function') {
    return logger[methodName].bind(logger);
  }
  return () => {};
}

function normalizeComparablePath(value) {
  return path.resolve(String(value || '')).replace(/\\/gu, '/').toLowerCase();
}

async function closeSqlPoolManager(app) {
  if (typeof app?.sqlPoolManager?.close !== 'function') {
    return;
  }
  await app.sqlPoolManager.close();
}

function ensureAppContract(app) {
  if (!app || typeof app !== 'object') {
    throw new Error('Standalone ECUS bridge CLI requires an app instance.');
  }
  if (typeof app.server?.start !== 'function') {
    throw new Error('Standalone ECUS bridge CLI requires app.server.start().');
  }
  if (typeof app.server?.stop !== 'function') {
    throw new Error('Standalone ECUS bridge CLI requires app.server.stop().');
  }
}

export function isDirectRun(metaUrl = import.meta.url, argv = process.argv) {
  if (!metaUrl || !Array.isArray(argv) || !argv[1]) {
    return false;
  }
  return normalizeComparablePath(fileURLToPath(metaUrl)) === normalizeComparablePath(argv[1]);
}

export function createStandaloneEcusBridgeCli({
  createAppImpl = createStandaloneEcusBridgeAppFromEnv,
  logger = console,
  processObject = process,
  exitImpl = (code) => processObject.exit(code),
} = {}) {
  const info = getLoggerMethod(logger, 'info');
  const errorLog = getLoggerMethod(logger, 'error');

  let app = null;
  let address = null;
  let signalHandlers = null;
  let stopPromise = null;
  let started = false;

  function unregisterSignalHandlers() {
    if (!signalHandlers) {
      return;
    }
    for (const [signal, handler] of signalHandlers.entries()) {
      processObject.off(signal, handler);
    }
    signalHandlers = null;
  }

  async function stop({ reason = 'shutdown' } = {}) {
    if (stopPromise) {
      return stopPromise;
    }

    stopPromise = (async () => {
      unregisterSignalHandlers();

      const shutdownErrors = [];
      if (typeof app?.server?.stop === 'function') {
        try {
          await app.server.stop();
        } catch (error) {
          shutdownErrors.push(error);
        }
      }
      try {
        await closeSqlPoolManager(app);
      } catch (error) {
        shutdownErrors.push(error);
      }

      started = false;
      info('Standalone ECUS bridge stopped.', { reason, address });

      if (shutdownErrors.length > 0) {
        throw shutdownErrors[0];
      }
      return { app, address };
    })();

    return stopPromise;
  }

  async function handleSignal(signal) {
    info('Received shutdown signal for standalone ECUS bridge.', { signal });
    try {
      await stop({ reason: `signal:${signal}` });
      exitImpl(0);
    } catch (error) {
      errorLog('Failed to stop standalone ECUS bridge.', error);
      exitImpl(1);
    }
  }

  function registerSignalHandlers() {
    if (signalHandlers) {
      return;
    }
    signalHandlers = new Map(
      ['SIGINT', 'SIGTERM'].map((signal) => [signal, () => handleSignal(signal)]),
    );
    for (const [signal, handler] of signalHandlers.entries()) {
      processObject.on(signal, handler);
    }
  }

  async function start() {
    if (started) {
      return { app, address };
    }

    app = createAppImpl();
    ensureAppContract(app);

    try {
      address = await app.server.start();
      started = true;
      registerSignalHandlers();
      info('Standalone ECUS bridge listening.', address);
      return { app, address };
    } catch (error) {
      try {
        await closeSqlPoolManager(app);
      } catch (closeError) {
        errorLog('Failed to close standalone ECUS bridge SQL resources.', closeError);
      }
      errorLog('Failed to start standalone ECUS bridge.', error);
      throw error;
    }
  }

  return {
    start,
    stop,
    handleSignal,
    getApp() {
      return app;
    },
    getAddress() {
      return address;
    },
  };
}

export async function runStandaloneEcusBridgeCli(options = {}) {
  const cli = createStandaloneEcusBridgeCli(options);
  await cli.start();
  return cli;
}

if (isDirectRun()) {
  runStandaloneEcusBridgeCli().catch((error) => {
    console.error('Failed to start standalone ECUS bridge.', error);
    process.exit(1);
  });
}
