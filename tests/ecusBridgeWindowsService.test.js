import { describe, expect, it, vi } from 'vitest';

import {
  buildStandaloneEcusBridgeServiceDefinition,
  createStandaloneEcusBridgeWindowsServiceManager,
  runStandaloneEcusBridgeWindowsServiceCli,
} from '../apps/ecus-bridge/src/bridgeWindowsServiceCli.js';

describe('ecus bridge windows service cli', () => {
  it('builds a stable Windows service definition for the bridge process', () => {
    const definition = buildStandaloneEcusBridgeServiceDefinition({
      nodeExe: 'C:\\Program Files\\nodejs\\node.exe',
      cliPath: 'E:\\GPT\\kpi_source_code_v4\\apps\\ecus-bridge\\src\\bridgeCli.js',
      serviceName: 'KpiEcusBridge',
      displayName: 'KPI ECUS Bridge',
    });

    expect(definition).toEqual(
      expect.objectContaining({
        serviceName: 'KpiEcusBridge',
        displayName: 'KPI ECUS Bridge',
        binPath: '"C:\\Program Files\\nodejs\\node.exe" "E:\\GPT\\kpi_source_code_v4\\apps\\ecus-bridge\\src\\bridgeCli.js"',
      }),
    );
  });

  it('installs the bridge as a Windows service via sc.exe', async () => {
    const spawnSyncImpl = vi
      .fn()
      .mockReturnValueOnce({
        status: 1,
        stdout: '[SC] EnumQueryServicesStatus:OpenService FAILED 1060:\r\n',
        stderr: '',
      })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

    const manager = createStandaloneEcusBridgeWindowsServiceManager({
      platform: 'win32',
      spawnSyncImpl,
    });
    const result = await manager.install({
      nodeExe: 'C:\\Program Files\\nodejs\\node.exe',
      cliPath: 'E:\\GPT\\kpi_source_code_v4\\apps\\ecus-bridge\\src\\bridgeCli.js',
    });

    expect(result).toEqual(
      expect.objectContaining({
        installed: true,
        definition: expect.objectContaining({
          serviceName: 'KpiEcusBridge',
        }),
      }),
    );
    expect(spawnSyncImpl).toHaveBeenNthCalledWith(
      2,
      'sc.exe',
      expect.arrayContaining([
        'create',
        'KpiEcusBridge',
        'binPath=',
        '"C:\\Program Files\\nodejs\\node.exe" "E:\\GPT\\kpi_source_code_v4\\apps\\ecus-bridge\\src\\bridgeCli.js"',
      ]),
      expect.any(Object),
    );
    expect(spawnSyncImpl).toHaveBeenNthCalledWith(
      3,
      'sc.exe',
      expect.arrayContaining(['description', 'KpiEcusBridge']),
      expect.any(Object),
    );
  });

  it('removes the bridge service and tolerates a stopped instance', async () => {
    const spawnSyncImpl = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: 'STATE              : 1  STOPPED\r\n', stderr: '' })
      .mockReturnValueOnce({
        status: 1,
        stdout: '[SC] ControlService FAILED 1062:\r\n',
        stderr: '',
      })
      .mockReturnValueOnce({ status: 0, stdout: '[SC] DeleteService SUCCESS\r\n', stderr: '' });

    const manager = createStandaloneEcusBridgeWindowsServiceManager({
      platform: 'win32',
      spawnSyncImpl,
    });
    const result = await manager.remove();

    expect(result).toEqual(
      expect.objectContaining({
        removed: true,
        existed: true,
      }),
    );
    expect(spawnSyncImpl).toHaveBeenNthCalledWith(
      3,
      'sc.exe',
      ['delete', 'KpiEcusBridge'],
      expect.any(Object),
    );
  });

  it('dispatches the install command through the CLI wrapper', async () => {
    const install = vi.fn(async () => ({
      installed: true,
      definition: {
        serviceName: 'KpiEcusBridge',
      },
    }));
    const manager = { install };
    const createManagerImpl = vi.fn(() => manager);
    const logger = { info: vi.fn(), error: vi.fn() };

    const result = await runStandaloneEcusBridgeWindowsServiceCli({
      argv: ['node', 'bridgeWindowsServiceCli.js', 'install'],
      logger,
      createManagerImpl,
    });

    expect(createManagerImpl).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        installed: true,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Standalone ECUS bridge service command completed.',
      expect.objectContaining({
        command: 'install',
      }),
    );
  });
});
