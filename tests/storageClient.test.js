import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initSharedStorage,
  setItem as sharedSetItem,
  getItem as sharedGetItem,
  clearStorageCache,
  getSyncStatus,
  subscribeSyncStatus,
} from '@/lib/storageClient.js';

function createBootstrapResponse(data) {
  return {
    ok: true,
    json: async () => ({ data }),
  };
}

describe('storageClient remote đồng bộ lại khi server lên trễ', () => {
  beforeEach(() => {
    localStorage.clear();
    clearStorageCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    clearStorageCache();
    localStorage.clear();
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

    expect(storageWrites).toHaveLength(1);
    const saved = JSON.parse(storageWrites[0].body);
    expect(saved.value).toBe(payload);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
});
