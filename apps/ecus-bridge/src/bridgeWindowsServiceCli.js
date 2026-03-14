import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SERVICE_NAME = 'KpiEcusBridge';
const DEFAULT_DISPLAY_NAME = 'KPI ECUS Bridge';
const DEFAULT_DESCRIPTION = 'KPI v4 standalone ECUS bridge service';
const DEFAULT_START_TYPE = 'auto';

function resolveDefaultCliPath(metaUrl = import.meta.url) {
  if (typeof metaUrl === 'string' && metaUrl.startsWith('file:')) {
    return fileURLToPath(new URL('./bridgeCli.js', metaUrl));
  }
  return path.resolve('apps/ecus-bridge/src/bridgeCli.js');
}

function getLoggerMethod(logger, methodName) {
  if (logger && typeof logger[methodName] === 'function') {
    return logger[methodName].bind(logger);
  }
  return () => {};
}

function trimText(value, fallback = '') {
  const text = `${value ?? fallback}`.trim();
  return text || fallback;
}

function normalizeComparablePath(value) {
  return path.resolve(String(value || '')).replace(/\\/gu, '/').toLowerCase();
}

function commandOptions() {
  return {
    encoding: 'utf8',
    windowsHide: true,
  };
}

function quoteBinPath(value) {
  const escaped = String(value || '').replace(/"/gu, '\\"');
  return `"${escaped}"`;
}

function isMissingService(result) {
  const output = `${result?.stdout || ''}\n${result?.stderr || ''}`;
  return output.includes('FAILED 1060');
}

function isAlreadyStopped(result) {
  const output = `${result?.stdout || ''}\n${result?.stderr || ''}`;
  return output.includes('FAILED 1062');
}

function ensureWindows(platform) {
  if (platform !== 'win32') {
    throw new Error('Standalone ECUS bridge Windows service commands only run on Windows.');
  }
}

function runScCommand(spawnSyncImpl, args) {
  return spawnSyncImpl('sc.exe', args, commandOptions());
}

function ensureSuccessfulCommand(result, errorMessage) {
  if (result?.error) {
    throw result.error;
  }
  if (result?.status === 0) {
    return result;
  }
  const output = `${result?.stdout || ''}\n${result?.stderr || ''}`.trim();
  throw new Error(output ? `${errorMessage}\n${output}` : errorMessage);
}

export function buildStandaloneEcusBridgeServiceDefinition({
  serviceName = DEFAULT_SERVICE_NAME,
  displayName = DEFAULT_DISPLAY_NAME,
  description = DEFAULT_DESCRIPTION,
  nodeExe = process.execPath,
  cliPath = resolveDefaultCliPath(),
  startType = DEFAULT_START_TYPE,
} = {}) {
  const resolvedNodeExe = path.resolve(nodeExe);
  const resolvedCliPath = path.resolve(cliPath);
  return {
    serviceName: trimText(serviceName, DEFAULT_SERVICE_NAME),
    displayName: trimText(displayName, DEFAULT_DISPLAY_NAME),
    description: trimText(description, DEFAULT_DESCRIPTION),
    nodeExe: resolvedNodeExe,
    cliPath: resolvedCliPath,
    startType: trimText(startType, DEFAULT_START_TYPE),
    binPath: `${quoteBinPath(resolvedNodeExe)} ${quoteBinPath(resolvedCliPath)}`,
  };
}

export function createStandaloneEcusBridgeWindowsServiceManager({
  platform = process.platform,
  spawnSyncImpl = spawnSync,
  env = process.env,
} = {}) {
  function buildDefinition(overrides = {}) {
    return buildStandaloneEcusBridgeServiceDefinition({
      serviceName: overrides.serviceName || env.ECUS_BRIDGE_SERVICE_NAME,
      displayName: overrides.displayName || env.ECUS_BRIDGE_SERVICE_DISPLAY_NAME,
      description: overrides.description || env.ECUS_BRIDGE_SERVICE_DESCRIPTION,
      nodeExe: overrides.nodeExe || env.ECUS_BRIDGE_NODE_EXE || process.execPath,
      cliPath: overrides.cliPath || env.ECUS_BRIDGE_CLI_PATH,
      startType: overrides.startType || env.ECUS_BRIDGE_SERVICE_START_TYPE,
    });
  }

  async function status(overrides = {}) {
    ensureWindows(platform);
    const definition = buildDefinition(overrides);
    const result = runScCommand(spawnSyncImpl, ['query', definition.serviceName]);
    if (result?.status === 0) {
      return {
        exists: true,
        serviceName: definition.serviceName,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
      };
    }
    if (isMissingService(result)) {
      return {
        exists: false,
        serviceName: definition.serviceName,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
      };
    }
    ensureSuccessfulCommand(result, `Failed to query Windows service ${definition.serviceName}.`);
    return {
      exists: true,
      serviceName: definition.serviceName,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  }

  async function install(overrides = {}) {
    ensureWindows(platform);
    const definition = buildDefinition(overrides);
    const currentStatus = await status({ serviceName: definition.serviceName });
    if (currentStatus.exists) {
      return {
        installed: false,
        alreadyInstalled: true,
        definition,
      };
    }

    const createResult = runScCommand(spawnSyncImpl, [
      'create',
      definition.serviceName,
      'binPath=',
      definition.binPath,
      'start=',
      definition.startType,
      'DisplayName=',
      definition.displayName,
    ]);
    ensureSuccessfulCommand(
      createResult,
      `Failed to create Windows service ${definition.serviceName}.`,
    );

    const descriptionResult = runScCommand(spawnSyncImpl, [
      'description',
      definition.serviceName,
      definition.description,
    ]);
    ensureSuccessfulCommand(
      descriptionResult,
      `Failed to describe Windows service ${definition.serviceName}.`,
    );

    return {
      installed: true,
      definition,
    };
  }

  async function remove(overrides = {}) {
    ensureWindows(platform);
    const definition = buildDefinition(overrides);
    const currentStatus = await status({ serviceName: definition.serviceName });
    if (!currentStatus.exists) {
      return {
        removed: false,
        existed: false,
        serviceName: definition.serviceName,
      };
    }

    const stopResult = runScCommand(spawnSyncImpl, ['stop', definition.serviceName]);
    if (stopResult?.status !== 0 && !isAlreadyStopped(stopResult)) {
      ensureSuccessfulCommand(
        stopResult,
        `Failed to stop Windows service ${definition.serviceName}.`,
      );
    }

    const deleteResult = runScCommand(spawnSyncImpl, ['delete', definition.serviceName]);
    ensureSuccessfulCommand(
      deleteResult,
      `Failed to delete Windows service ${definition.serviceName}.`,
    );

    return {
      removed: true,
      existed: true,
      serviceName: definition.serviceName,
    };
  }

  return {
    install,
    remove,
    status,
  };
}

export function isDirectRun(metaUrl = import.meta.url, argv = process.argv) {
  if (!metaUrl || !Array.isArray(argv) || !argv[1]) {
    return false;
  }
  return normalizeComparablePath(fileURLToPath(metaUrl)) === normalizeComparablePath(argv[1]);
}

export async function runStandaloneEcusBridgeWindowsServiceCli({
  argv = process.argv,
  logger = console,
  createManagerImpl = createStandaloneEcusBridgeWindowsServiceManager,
} = {}) {
  const info = getLoggerMethod(logger, 'info');
  const errorLog = getLoggerMethod(logger, 'error');
  const command = trimText(argv?.[2], 'status').toLowerCase();
  const manager = createManagerImpl();

  try {
    let result;
    if (command === 'install') {
      result = await manager.install();
    } else if (command === 'remove' || command === 'uninstall') {
      result = await manager.remove();
    } else if (command === 'status') {
      result = await manager.status();
    } else {
      throw new Error(`Unknown bridge service command: ${command}`);
    }

    info('Standalone ECUS bridge service command completed.', {
      command,
      result,
    });
    return result;
  } catch (error) {
    errorLog('Standalone ECUS bridge service command failed.', error);
    throw error;
  }
}

if (isDirectRun()) {
  runStandaloneEcusBridgeWindowsServiceCli().catch((error) => {
    console.error('Standalone ECUS bridge service command failed.', error);
    process.exit(1);
  });
}
