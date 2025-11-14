import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';



let initSharedStorage;

let sharedSetItem;

let sharedGetItem;

let clearStorageCacheFn;

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

    clearStorageCacheFn = storageModule.clearStorageCache;

    getSyncStatus = storageModule.getSyncStatus;

    subscribeSyncStatus = storageModule.subscribeSyncStatus;

    refreshSharedKeys = storageModule.refreshSharedKeys;

    clearStorageCacheFn();

  });



  afterEach(() => {

    vi.restoreAllMocks();

    vi.unstubAllGlobals();

    vi.useRealTimers();

    clearStorageCacheFn?.();

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

    await vi.advanceTimersByTimeAsync(1000);

    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(2000);

    await Promise.resolve();



    const remoteDisabled = await waitForCondition(() => !getSyncStatus().remoteEnabled);

    expect(remoteDisabled).toBe(true);



    const statusAfterFailure = getSyncStatus();

    expect(statusAfterFailure.remoteEnabled).toBe(false);

    expect(statusAfterFailure.pendingWrites).toBe(1);

    const expectedDelay = Math.min(

      60000,

      Math.max(5000, 5000 * 2 ** Math.max(0, (statusAfterFailure.retryAttempts || 1) - 1)),

    );

    expect(statusAfterFailure.retryDelayMs).toBe(expectedDelay);

    expect(storageWrites.length).toBeGreaterThanOrEqual(3);

    const timerDelays = setTimeoutSpy.mock.calls.map((call) => call?.[1]);

    const scheduleRetryCalls = timerDelays.filter((delay) => (delay ?? 0) >= statusAfterFailure.retryDelayMs);

    expect(scheduleRetryCalls.length).toBe(1);



    await vi.advanceTimersByTimeAsync(statusAfterFailure.retryDelayMs);

    await Promise.resolve();

    await Promise.resolve();



    expect(fetchMock).toHaveBeenCalledTimes(5);

    const afterRetry = getSyncStatus();

    const expectedAfterRetryDelay = Math.min(

      60000,

      Math.max(5000, 5000 * 2 ** Math.max(0, (afterRetry.retryAttempts || 1) - 1)),

    );

    expect(afterRetry.retryDelayMs).toBe(expectedAfterRetryDelay);

  });

  it('retry sendWrite với backoff khi gặp lỗi mạng tạm thời', async () => {
    const storageWrites = [];
    let writeAttempts = 0;
    const fetchMock = vi.fn(async (input, init) => {
      const method = (init?.method || 'GET').toUpperCase();
      const url = typeof input === 'string' ? input : input?.url ?? '';
      if (url.includes('/api/bootstrap')) {
        return createBootstrapResponse({ decl_rows_v1: '[]' });
      }
      if (url.includes('/api/storage/') && method === 'PUT') {
        writeAttempts += 1;
        if (writeAttempts < 3) {
          throw new Error('offline');
        }
        storageWrites.push({ url, body: init?.body });
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const initial = await initSharedStorage({ baseUrl: '' });
    expect(initial).toBe(true);

    const payload = JSON.stringify([{ so_tk: 'TK-RETRY-SUCCESS' }]);
    sharedSetItem('decl_rows_v1', payload);

    await Promise.resolve();
    expect(writeAttempts).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(writeAttempts).toBe(2);

    await vi.advanceTimersByTimeAsync(2000);
    await Promise.resolve();
    expect(writeAttempts).toBe(3);

    expect(storageWrites).toHaveLength(1);
    const saved = JSON.parse(storageWrites[0].body);
    expect(saved.value).toBe(payload);

    const status = getSyncStatus();
    expect(status.pendingWrites).toBe(0);
    expect(status.waitingForBackend).toBe(false);
  });

  it('ghi log thân thiện khi sendWrite thất bại sau nhiều lần thử', async () => {
    const fetchMock = vi.fn(async (input, init) => {
      const method = (init?.method || 'GET').toUpperCase();
      const url = typeof input === 'string' ? input : input?.url ?? '';
      if (url.includes('/api/bootstrap')) {
        return createBootstrapResponse({ decl_rows_v1: '[]' });
      }
      if (url.includes('/api/storage/') && method === 'PUT') {
        return { ok: false, status: 500, statusText: 'Internal Server Error' };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const initial = await initSharedStorage({ baseUrl: '' });
    expect(initial).toBe(true);

    const payload = JSON.stringify([{ so_tk: 'TK-RETRY-FAIL' }]);
    sharedSetItem('decl_rows_v1', payload);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    const status = getSyncStatus();
    expect(status.waitingForBackend).toBe(true);
    expect(status.pendingWrites).toBe(1);
    expect(status.lastError).toContain('Không thể đồng bộ khóa "decl_rows_v1" lên máy chủ');
    expect(status.lastError).toContain('Hệ thống sẽ tự thử lại');
    expect(status.errorLog[0].message).toBe(status.lastError);
    expect(status.errorLog[0].attempts).toBeGreaterThanOrEqual(3);

    vi.clearAllTimers();
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

    vi.useFakeTimers();

    const storageModule = await import('@/lib/storageClient.js');

    setSharedItem = storageModule.setItem;

    waitSharedWrites = storageModule.waitForSharedWrites;

    getStatus = storageModule.getSyncStatus;

    refreshKeys = storageModule.refreshSharedKeys;

    clearCache = storageModule.clearStorageCache;

    storageLimitMessage = storageModule.STORAGE_LIMIT_ERROR_MESSAGE;

    clearCache();

    global.fetch = vi.fn();

  });

  afterEach(() => {

    vi.restoreAllMocks();

    vi.unstubAllGlobals();

    clearCache?.();

    vi.useRealTimers();

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

    const waitPromise = waitSharedWrites({ timeoutMs: 50 });

    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(1000);

    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(2000);

    await Promise.resolve();

    await waitPromise;

    const status = getStatus();

    expect(status.lastError).toContain(storageLimitMessage);

    expect(status.waitingForBackend).toBe(true);

    vi.clearAllTimers();

  });

});

