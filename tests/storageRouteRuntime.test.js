import { describe, expect, it, vi } from 'vitest';

import { createStorageRouteRuntime } from '@kpi/backend-shared/runtime';

function createHarness(overrides = {}) {
  const deps = {
    getValue: vi.fn(() => '[]'),
    upsertValue: vi.fn(),
    deleteValue: vi.fn(),
    safeParse: vi.fn((value, fallback) => {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }),
    evaluateDeclarationAlerts: vi.fn(),
    refreshEcusSchedule: vi.fn(),
    applyCoCodeConfig: vi.fn(),
    getCoCodeConfig: vi.fn(() => ({ whitelist: ['A12'], blacklist: [] })),
    refreshCoDiscrepancySchedule: vi.fn(),
    defaultCoCodeConfig: { whitelist: [], blacklist: [] },
    ...overrides,
  };

  return {
    deps,
    runtime: createStorageRouteRuntime(deps),
  };
}

describe('createStorageRouteRuntime', () => {
  it('persists storage puts and triggers declaration alert evaluation for decl rows', () => {
    const { runtime, deps } = createHarness();
    const rows = [{ so_tk: '1029384756', nhanh: 'Blue' }];

    const result = runtime.putStorageValue('decl_rows_v1', rows, {
      actor: 'alice',
      source: 'api',
    });

    expect(deps.upsertValue).toHaveBeenCalledWith('decl_rows_v1', rows, {
      actor: 'alice',
      source: 'api',
    });
    expect(deps.evaluateDeclarationAlerts).toHaveBeenCalledWith({
      actor: 'alice',
      reason: 'storage-put',
    });
    expect(result).toEqual({ ok: true });
  });

  it('refreshes the ECUS schedule after ecus config writes', () => {
    const { runtime, deps } = createHarness();

    runtime.putStorageValue('ecus_sync_config_v1', { enabled: true }, {
      actor: 'alice',
      source: 'api',
    });

    expect(deps.upsertValue).toHaveBeenCalledWith('ecus_sync_config_v1', { enabled: true }, {
      actor: 'alice',
      source: 'api',
    });
    expect(deps.refreshEcusSchedule).toHaveBeenCalledTimes(1);
  });

  it('patches declaration rows by simple key and re-evaluates alerts', () => {
    const existingRows = [
      { so_tk: '1001', nhanh: 'A', value: 1 },
      { so_tk: '1002', nhanh: 'B', value: 2 },
    ];
    const { runtime, deps } = createHarness({
      getValue: vi.fn(() => JSON.stringify(existingRows)),
    });

    const result = runtime.patchDeclarationRows(
      [
        {
          key: '1002_B',
          row: { so_tk: '1002', nhanh: 'B', value: 99 },
        },
      ],
      {
        actor: 'alice',
        source: 'api-patch',
      }
    );

    expect(deps.upsertValue).toHaveBeenCalledWith(
      'decl_rows_v1',
      JSON.stringify([
        { so_tk: '1001', nhanh: 'A', value: 1 },
        { so_tk: '1002', nhanh: 'B', value: 99 },
      ]),
      {
        actor: 'alice',
        source: 'api-patch',
      }
    );
    expect(deps.evaluateDeclarationAlerts).toHaveBeenCalledWith({
      actor: 'alice',
      reason: 'storage-patch',
    });
    expect(result).toEqual({
      ok: true,
      updated: 1,
      totalStored: 2,
    });
  });

  it('resets CO tax code runtime state back to defaults on delete', () => {
    const { runtime, deps } = createHarness();

    const result = runtime.deleteStorageValue('co_tax_code_config_v1', {
      actor: 'alice',
      source: 'api-delete',
    });

    expect(deps.deleteValue).toHaveBeenCalledWith('co_tax_code_config_v1', {
      actor: 'alice',
      source: 'api-delete',
    });
    expect(deps.applyCoCodeConfig).toHaveBeenCalledWith({
      whitelist: [],
      blacklist: [],
    });
    expect(result).toEqual({ ok: true });
  });

  it('refreshes CO discrepancy scheduling after relevant writes and deletes', () => {
    const { runtime, deps } = createHarness();

    runtime.putStorageValue('co_discrepancy_config_v1', { enabled: true }, {
      actor: 'alice',
      source: 'api',
    });
    runtime.deleteStorageValue('co_discrepancy_config_v1', {
      actor: 'alice',
      source: 'api-delete',
    });

    expect(deps.refreshCoDiscrepancySchedule).toHaveBeenCalledTimes(2);
  });
});
