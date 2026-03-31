import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';



let initSharedStorage;

let sharedSetItem;

let sharedGetItem;

let resetStorageClientForTestsFn;

let getSyncStatus;

let subscribeSyncStatus;

let refreshSharedKeys;



function createBootstrapResponse(data) {

  return {

    ok: true,

    json: async () => ({ data }),

  };

}



async function waitForCondition(check, tries = 10) {

  for (let attempt = 0; attempt < tries; attempt += 1) {

    if (check()) {

      return true;

    }

    await Promise.resolve();

  }

  return check();

}



describe('storageClient remote đồng bộ lại khi server lên trễ', () => {

  beforeEach(async () => {

    vi.useFakeTimers();

    vi.resetModules();

    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const storageModule = await import('@/lib/storageClient.js');

    initSharedStorage = storageModule.initSharedStorage;

    sharedSetItem = storageModule.setItem;

    sharedGetItem = storageModule.getItem;

    resetStorageClientForTestsFn = storageModule.resetStorageClientForTests;

    getSyncStatus = storageModule.getSyncStatus;

    subscribeSyncStatus = storageModule.subscribeSyncStatus;

    refreshSharedKeys = storageModule.refreshSharedKeys;

    resetStorageClientForTestsFn();

  });



  afterEach(() => {

    vi.restoreAllMocks();

    vi.unstubAllGlobals();

    vi.useRealTimers();

    resetStorageClientForTestsFn?.();

  });



  it('tự động flush dữ liệu pending khi kết nối server thành công sau đó', async () => {

    const bootstrapQueue = [

      { kind: 'error' },

      { kind: 'success', data: { decl_rows_v1: '[]' } },

    ];

    const storageWrites = [];



    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        const next = bootstrapQueue.shift() ?? { kind: 'success', data: {} };

        if (next.kind === 'error') {

          throw new Error('offline');

        }

        return createBootstrapResponse(next.data);

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        storageWrites.push({ url, body: init?.body });

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);



    const payload = JSON.stringify([{ so_tk: 'TK-RETRY-001' }]);

    sharedSetItem('decl_rows_v1', payload);

    expect(sharedGetItem('decl_rows_v1')).toBe(payload);

    expect(storageWrites).toHaveLength(0);



    await vi.advanceTimersByTimeAsync(5000);

    await Promise.resolve();

    await Promise.resolve();

    await Promise.resolve();



    expect(storageWrites).toHaveLength(1);

    const saved = JSON.parse(storageWrites[0].body);

    expect(saved.value).toBe(payload);

    expect(fetchMock).toHaveBeenCalledTimes(3);

  });



  it('đồng bộ cấu hình Đại lý HQ lên server khi có kết nối', async () => {

    const storageWrites = [];

    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        return createBootstrapResponse({ hq_agencies_v1: '[]', hq_history_v1: '[]' });

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        storageWrites.push({ url, body: init?.body });

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(true);



    const payload = JSON.stringify([{ mst: '0100109106', agency: 'Test HQ' }]);

    sharedSetItem('hq_agencies_v1', payload);



    await Promise.resolve();

    await Promise.resolve();



    expect(storageWrites).toHaveLength(1);

    expect(storageWrites[0].url).toContain('/api/storage/hq_agencies_v1');

    const saved = JSON.parse(storageWrites[0].body);

    expect(saved.value).toBe(payload);

  });



  it('đồng bộ lịch sử Gán MST lên server khi lưu thay đổi', async () => {

    const storageWrites = [];

    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        return createBootstrapResponse({ mst_history_v1: '[]', hq_history_v1: '[]' });

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        storageWrites.push({ url, body: init?.body });

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(true);



    const payload = JSON.stringify([

      {

        id: 'mst-0100109106-20230901',

        mst: '0100109106',

        field: 'person_import',

        from: 'Lan',

        to: 'Hạnh',

        actor: 'tester',

        timestamp: new Date().toISOString(),

        rowKey: '0100109106__2023-09-01',

        type: 'update',

      },

    ]);

    sharedSetItem('mst_history_v1', payload);



    await Promise.resolve();

    await Promise.resolve();



    expect(storageWrites).toHaveLength(1);

    expect(storageWrites[0].url).toContain('/api/storage/mst_history_v1');

    const saved = JSON.parse(storageWrites[0].body);

    expect(saved.value).toBe(payload);

  });

  it('đồng bộ ghim Command Center lên server khi lưu thay đổi', async () => {

    const storageWrites = [];

    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        return createBootstrapResponse({ kpi_command_center_pins_v1: '[]' });

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        storageWrites.push({ url, body: init?.body });

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(true);



    const payload = JSON.stringify(['navigate:hq']);

    sharedSetItem('kpi_command_center_pins_v1', payload);



    await Promise.resolve();

    await Promise.resolve();



    expect(storageWrites).toHaveLength(1);

    expect(storageWrites[0].url).toContain('/api/storage/kpi_command_center_pins_v1');

    const saved = JSON.parse(storageWrites[0].body);

    expect(saved.value).toBe(payload);

  });



  it('đồng bộ lịch sử Đại lý HQ lên server khi lưu thay đổi', async () => {

    const storageWrites = [];

    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        return createBootstrapResponse({ hq_history_v1: '[]' });

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        storageWrites.push({ url, body: init?.body });

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(true);



    const payload = JSON.stringify([

      {

        id: 'hq-0101234567-company',

        mst: '0101234567',

        field: 'company',

        from: '',

        to: 'Công ty A',

        actor: 'tester',

        timestamp: new Date().toISOString(),

        type: 'create',

      },

    ]);

    sharedSetItem('hq_history_v1', payload);



    await Promise.resolve();

    await Promise.resolve();



    expect(storageWrites).toHaveLength(1);

    expect(storageWrites[0].url).toContain('/api/storage/hq_history_v1');

    const saved = JSON.parse(storageWrites[0].body);

    expect(saved.value).toBe(payload);

  });



  it('phát sự kiện chờ backend khi hàng đợi chưa thể đồng bộ', async () => {

    const bootstrapQueue = [

      { kind: 'error' },

      { kind: 'success', data: { decl_rows_v1: '[]' } },

    ];

    const storageWrites = [];

    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        const next = bootstrapQueue.shift() ?? { kind: 'success', data: {} };

        if (next.kind === 'error') {

          throw new Error('offline');

        }

        return createBootstrapResponse(next.data);

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        storageWrites.push({ url, body: init?.body });

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(false);



    const events = [];

    const unsubscribe = subscribeSyncStatus((status) => {

      events.push(status);

    });



    const payload = JSON.stringify([{ so_tk: 'CHO-BACKEND' }]);

    sharedSetItem('decl_rows_v1', payload);



    const waitingStatus = getSyncStatus();

    expect(waitingStatus.waitingForBackend).toBe(true);

    expect(waitingStatus.pendingWrites).toBe(1);



    await vi.advanceTimersByTimeAsync(5000);

    await Promise.resolve();



    const finalStatus = getSyncStatus();

    expect(finalStatus.waitingForBackend).toBe(false);

    expect(finalStatus.pendingWrites).toBe(0);

    expect(storageWrites).toHaveLength(1);



    unsubscribe();



    expect(events.some((status) => status.waitingForBackend)).toBe(true);

  });



  it('không lập lịch retry trùng lặp khi đã có timer đang chờ', async () => {

    const fetchMock = vi.fn(async (input) => {

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        throw new Error('offline');

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);



    const firstDelay = setTimeoutSpy.mock.calls[0]?.[1];

    expect(firstDelay).toBe(5000);



    sharedSetItem('decl_rows_v1', JSON.stringify([{ so_tk: 'RETRY-ONCE' }]));

    sharedSetItem('decl_rows_v1', JSON.stringify([{ so_tk: 'RETRY-TWICE' }]));



    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);



    await vi.advanceTimersByTimeAsync(firstDelay ?? 0);

    await Promise.resolve();



    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

  });



  it('tăng backoff đúng một lần khi flushPending thất bại', async () => {

    const storageWrites = [];

    let bootstrapCalls = 0;

    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        bootstrapCalls += 1;

        if (bootstrapCalls === 1) {

          return createBootstrapResponse({ decl_rows_v1: '[]' });

        }

        throw new Error('offline');

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        storageWrites.push({ url, body: init?.body });

        throw new Error('failed to write');

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(true);

    const beforeFailureDelay = getSyncStatus().retryDelayMs;

    expect(beforeFailureDelay).toBe(5000);



    const payload = JSON.stringify([{ so_tk: 'FLUSH-RETRY' }]);

    sharedSetItem('decl_rows_v1', payload);



    await Promise.resolve();

    await Promise.resolve();

    await Promise.resolve();



    const remoteDisabled = await waitForCondition(() => !getSyncStatus().remoteEnabled);

    expect(remoteDisabled).toBe(true);



    const statusAfterFailure = getSyncStatus();

    expect(statusAfterFailure.remoteEnabled).toBe(false);

    expect(statusAfterFailure.pendingWrites).toBe(1);

    const expectedDelay = Math.min(

      Math.max(Math.floor(beforeFailureDelay * 1.5), 5000),

      60000,

    );

    expect(statusAfterFailure.retryDelayMs).toBe(expectedDelay);

    expect(storageWrites).toHaveLength(1);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);



    await vi.advanceTimersByTimeAsync(statusAfterFailure.retryDelayMs);

    await Promise.resolve();

    await Promise.resolve();



    expect(fetchMock).toHaveBeenCalledTimes(3);

    const afterRetry = getSyncStatus();

    const expectedAfterRetryDelay = Math.min(

      Math.max(Math.floor(expectedDelay * 1.5), 5000),

      60000,

    );

    expect(afterRetry.retryDelayMs).toBe(expectedAfterRetryDelay);

  });



  it('giu queue moi nhat khi write dang chay bi loi va rollback gia tri cu', async () => {

    const storageWrites = [];

    let startedFirstWriteResolve;

    let releaseFirstWrite;

    const firstWriteStarted = new Promise((resolve) => {

      startedFirstWriteResolve = resolve;

    });

    const firstWriteGate = new Promise((resolve) => {

      releaseFirstWrite = resolve;

    });

    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        return createBootstrapResponse({ decl_rows_v1: '[]' });

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        storageWrites.push({ url, body: init?.body });

        if (storageWrites.length === 1) {

          startedFirstWriteResolve?.();

          await firstWriteGate;

          throw new Error('failed to write');

        }

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);

    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(true);

    const firstPayload = JSON.stringify([{ so_tk: 'ROLLBACK-OLD' }]);

    const secondPayload = JSON.stringify([{ so_tk: 'ROLLBACK-NEW' }]);

    sharedSetItem('decl_rows_v1', firstPayload);

    await firstWriteStarted;

    sharedSetItem('decl_rows_v1', secondPayload);

    releaseFirstWrite?.();

    const remoteDisabled = await waitForCondition(() => !getSyncStatus().remoteEnabled);

    expect(remoteDisabled).toBe(true);

    const statusAfterFailure = getSyncStatus();

    expect(statusAfterFailure.pendingWrites).toBe(1);

    expect(statusAfterFailure.lastRollback).toMatchObject({

      key: 'decl_rows_v1',

      restoredPreviousValue: false,

    });

    await vi.advanceTimersByTimeAsync(statusAfterFailure.retryDelayMs);

    await Promise.resolve();

    await Promise.resolve();

    expect(storageWrites).toHaveLength(2);

    const replayedPayload = JSON.parse(storageWrites[1].body);

    expect(replayedPayload.value).toBe(secondPayload);

  });



  it('lam moi cache voi refreshSharedKeys khi backend tra ve du lieu moi', async () => {

    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap')) {

        return createBootstrapResponse({ decl_rows_v1: '[]' });

      }

      if (url.includes('/api/storage/decl_rows_v1') && method === 'GET') {

        const rows = [{ so_tk: 'REFRESH-001', nhanh: '', date: '2025-08-11' }];

        return {

          ok: true,

          json: async () => ({

            ok: true,

            key: 'decl_rows_v1',

            value: rows,

            raw: JSON.stringify(rows),

          }),

        };

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(true);

    expect(sharedGetItem('decl_rows_v1')).toBe('[]');



    const result = await refreshSharedKeys(['decl_rows_v1'], { baseUrl: '' });

    expect(Array.isArray(result['decl_rows_v1'])).toBe(true);

    expect(result['decl_rows_v1'][0]).toMatchObject({ so_tk: 'REFRESH-001' });



    const cached = sharedGetItem('decl_rows_v1');

    expect(JSON.parse(cached)).toEqual([{ so_tk: 'REFRESH-001', nhanh: '', date: '2025-08-11' }]);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/storage/decl_rows_v1'), expect.objectContaining({ method: 'GET' }));

  });

  it('bootstrap voi che do shared-light roi tai them deferred keys', async () => {

    const fetchMock = vi.fn(async (input, init) => {

      const method = (init?.method || 'GET').toUpperCase();

      const url = typeof input === 'string' ? input : input?.url ?? '';

      if (url.includes('/api/bootstrap?mode=shared-light')) {

        return {

          ok: true,

          json: async () => ({

            data: { kpi_users_v1: '[]' },

            mode: 'shared-light',

            deferredKeys: ['decl_rows_v1'],

          }),

        };

      }

      if (url.includes('/api/storage/decl_rows_v1') && method === 'GET') {

        const rows = [{ so_tk: 'LIGHT-001', nhanh: '', date: '2025-08-11' }];

        return {

          ok: true,

          json: async () => ({

            ok: true,

            key: 'decl_rows_v1',

            value: rows,

            raw: JSON.stringify(rows),

          }),

        };

      }

      if (url.includes('/api/storage/') && method === 'PUT') {

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ ok: true }) };

    });

    vi.stubGlobal('fetch', fetchMock);



    const initial = await initSharedStorage({ baseUrl: '' });

    expect(initial).toBe(true);

    expect(JSON.parse(sharedGetItem('decl_rows_v1'))).toEqual([

      { so_tk: 'LIGHT-001', nhanh: '', date: '2025-08-11' },

    ]);

    expect(fetchMock).toHaveBeenCalledWith(

      expect.stringContaining('/api/bootstrap?mode=shared-light'),

      expect.objectContaining({ cache: 'no-store' })

    );

    expect(fetchMock).toHaveBeenCalledWith(

      expect.stringContaining('/api/storage/decl_rows_v1'),

      expect.objectContaining({ method: 'GET' })

    );

  });

});

describe('storageClient giới hạn dung lượng khi backend trả về 413', () => {

  let setSharedItem;

  let waitSharedWrites;

  let getStatus;

  let refreshKeys;

  let clearCache;

  let storageLimitMessage;

  beforeEach(async () => {

    vi.resetModules();

    vi.spyOn(console, 'error').mockImplementation(() => {});

    const storageModule = await import('@/lib/storageClient.js');

    setSharedItem = storageModule.setItem;

    waitSharedWrites = storageModule.waitForSharedWrites;

    getStatus = storageModule.getSyncStatus;

    refreshKeys = storageModule.refreshSharedKeys;

    clearCache = storageModule.resetStorageClientForTests;

    storageLimitMessage = storageModule.STORAGE_LIMIT_ERROR_MESSAGE;

    clearCache();

    global.fetch = vi.fn();

  });

  afterEach(() => {

    vi.restoreAllMocks();

    vi.unstubAllGlobals();

    clearCache?.();

  });

  it('ghi nhận trạng thái lỗi dung lượng để giao diện hiển thị', async () => {

    global.fetch.mockImplementation(async (url, options = {}) => {

      const method = (options.method || 'GET').toUpperCase();

      if (method === 'GET') {

        return {

          ok: true,

          status: 200,

          json: async () => ({ data: {} }),

        };

      }

      return {

        ok: false,

        status: 413,

        statusText: 'Payload Too Large',

      };

    });

    await refreshKeys(['decl_rows_v1']);

    setSharedItem('decl_rows_v1', 'test-data');

    await waitSharedWrites({ timeoutMs: 50 });

    await Promise.resolve();

    const status = getStatus();

    expect(status.lastError).toBe(storageLimitMessage);
    expect(status.lastErrorCode).toBe('payload_too_large');
    expect(status.lastErrorRetryable).toBe(false);

    expect(status.waitingForBackend).toBe(true);
    expect(status.nextRetryAt).toBeNull();

  });

});

