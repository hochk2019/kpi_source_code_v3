import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let initSharedStorage;
let sharedSetItem;
let sharedGetItem;
let refreshSharedKeys;
let resetStorageClientForTestsFn;

function createSuccessResponse(data) {
  return {
    ok: true,
    json: async () => data,
  };
}

describe('storageClient Direct Connection Mode', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => { });

    const storageModule = await import('@/lib/storageClient.js');
    initSharedStorage = storageModule.initSharedStorage;
    sharedSetItem = storageModule.setItem;
    sharedGetItem = storageModule.getItem;
    refreshSharedKeys = storageModule.refreshSharedKeys;
    resetStorageClientForTestsFn = storageModule.resetStorageClientForTests;
    resetStorageClientForTestsFn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetStorageClientForTestsFn?.();
  });

  it('initSharedStorage returns true unconditionally in direct mode', async () => {
    const result = await initSharedStorage({ baseUrl: 'http://localhost.test' });
    expect(result).toBe(true);
  });

  it('setItem pushes directly to backend and updates cache', async () => {
    const fetchMock = vi.fn(async () => createSuccessResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await initSharedStorage({ baseUrl: '' });

    const payload = JSON.stringify([{ so_tk: 'TEST-1' }]);
    await sharedSetItem('decl_rows_v1', payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v4/shared-sync/storage/decl_rows_v1');
    expect(sharedGetItem('decl_rows_v1')).toBe(payload);
  });

  it('refreshSharedKeys fetches values from backend and updates cache', async () => {
    const fetchMock = vi.fn(async () => createSuccessResponse({ raw: '["data"]', value: ['data'] }));
    vi.stubGlobal('fetch', fetchMock);

    await initSharedStorage({ baseUrl: '' });

    const results = await refreshSharedKeys(['test_key']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results['test_key']).toEqual(['data']);
    expect(sharedGetItem('test_key')).toBe('["data"]');
  });

  it('refreshSharedKeys handles missing values correctly', async () => {
    const fetchMock = vi.fn(async () => createSuccessResponse({ raw: null, value: null }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await refreshSharedKeys(['test_key_null']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results['test_key_null']).toBe(null);
    expect(sharedGetItem('test_key_null')).toBe(null);
  });
});
