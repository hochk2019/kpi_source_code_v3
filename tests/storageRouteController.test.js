import { describe, expect, it, vi } from 'vitest';

import { createStorageRouteController } from '@kpi/backend-shared/runtime';

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined,
  };

  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((payload) => {
    res.body = payload;
    return res;
  });

  return res;
}

function createHarness(overrides = {}) {
  const deps = {
    getValue: vi.fn(),
    safeParse: vi.fn((raw, fallback) => {
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }),
    storageRouteRuntime: {
      putStorageValue: vi.fn(() => ({ ok: true })),
      patchDeclarationRows: vi.fn(() => ({ ok: true, updated: 1, totalStored: 1 })),
      deleteStorageValue: vi.fn(() => ({ ok: true })),
    },
    getSessionContext: vi.fn(() => null),
    resolveActor: vi.fn(() => 'fallback.actor'),
    permissionRequirements: {
      decl_rows_v1: 'importEdit',
    },
    reportScheduleStorageKey: 'kpi_report_schedule_v1',
    ...overrides,
  };

  return {
    deps,
    controller: createStorageRouteController(deps),
  };
}

describe('createStorageRouteController', () => {
  it('blocks direct report schedule writes through the generic storage API', () => {
    const { controller, deps } = createHarness();
    const req = {
      params: { key: deps.reportScheduleStorageKey },
      body: { value: [] },
    };
    const res = createRes();

    controller.putStorageValue(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      ok: false,
      error: 'Khoá này chỉ chỉnh sửa qua API lịch báo cáo KPI',
    });
    expect(deps.storageRouteRuntime.putStorageValue).not.toHaveBeenCalled();
  });

  it('blocks account storage mutations through the generic storage API', () => {
    const { controller, deps } = createHarness();
    const req = {
      params: { key: 'kpi_users_v1' },
    };
    const res = createRes();

    controller.deleteStorageValue(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      ok: false,
      error: 'Khoá này chỉ chỉnh sửa qua API tài khoản',
    });
    expect(deps.storageRouteRuntime.deleteStorageValue).not.toHaveBeenCalled();
  });

  it('requires authentication for protected storage keys', () => {
    const { controller } = createHarness();
    const req = {
      params: { key: 'decl_rows_v1' },
    };
    const res = createRes();

    controller.getStorageValue(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({
      ok: false,
      error: 'Bạn cần đăng nhập để thao tác với dữ liệu này',
    });
  });

  it('returns parsed JSON payloads for readable storage keys', () => {
    const { controller } = createHarness({
      getSessionContext: vi.fn(() => ({
        account: {
          username: 'admin',
          permissions: { importEdit: true },
        },
      })),
      getValue: vi.fn(() => '[{"id":"row-1"}]'),
    });
    const req = {
      params: { key: 'decl_rows_v1' },
    };
    const res = createRes();

    controller.getStorageValue(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      key: 'decl_rows_v1',
      value: [{ id: 'row-1' }],
      raw: '[{"id":"row-1"}]',
    });
  });

  it('rejects PATCH for keys other than declaration rows', () => {
    const { controller } = createHarness();
    const req = {
      params: { key: 'team_roster_v1' },
      body: { updates: [{ key: 'row', row: { id: 1 } }] },
    };
    const res = createRes();

    controller.patchStorageValue(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.body).toEqual({
      ok: false,
      error: 'Khoá này chưa hỗ trợ PATCH',
    });
  });

  it('maps invalid current declaration data to a 500 response', () => {
    const { controller } = createHarness({
      getSessionContext: vi.fn(() => ({
        account: {
          username: 'admin',
          permissions: { importEdit: true },
        },
      })),
      storageRouteRuntime: {
        putStorageValue: vi.fn(() => ({ ok: true })),
        patchDeclarationRows: vi.fn(() => ({ ok: false, invalidCurrentData: true })),
        deleteStorageValue: vi.fn(() => ({ ok: true })),
      },
    });
    const req = {
      params: { key: 'decl_rows_v1' },
      body: {
        updates: [{ key: '1001_A', row: { so_tk: '1001', nhanh: 'A' } }],
      },
    };
    const res = createRes();

    controller.patchStorageValue(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      ok: false,
      error: 'Dữ liệu hiện tại không hợp lệ',
    });
  });

  it('forwards actor and source metadata into runtime mutations', () => {
    const { controller, deps } = createHarness({
      getSessionContext: vi.fn(() => ({
        account: {
          username: 'storage.admin',
          permissions: { importEdit: true },
        },
      })),
    });
    const req = {
      params: { key: 'decl_rows_v1' },
      body: { value: [{ so_tk: '1001' }] },
    };
    const res = createRes();

    controller.putStorageValue(req, res);

    expect(deps.storageRouteRuntime.putStorageValue).toHaveBeenCalledWith(
      'decl_rows_v1',
      [{ so_tk: '1001' }],
      {
        actor: 'storage.admin',
        source: 'api',
      }
    );
    expect(res.body).toEqual({ ok: true });
  });
});
