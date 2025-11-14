import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let store;
let storageClient;
let auth;
let fetchMock;
let refreshKeysMock;

async function waitFor(condition, { timeout = 1000, interval = 10 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('Timed out waiting for condition');
}

beforeEach(async () => {
  vi.resetModules();
  storageClient = await import('@/lib/storageClient.js');
  auth = await import('@/auth/localAuth.js');

  storageClient.clearStorageCache();
  storageClient.setItem('decl_rows_v1', JSON.stringify([
    { so_tk: 'TK-0001', nhanh: 'A1', trang_thai: 'cũ' },
  ]));
  storageClient.setItem('decl_sync_queue_v1', JSON.stringify({ jobs: [] }));
  storageClient.setItem('decl_sync_history_v1', JSON.stringify([]));

  store = await import('@/lib/store.js');

  fetchMock = vi.spyOn(auth, 'fetchWithAuth').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      result: {
        imported: 1,
        skipped: 0,
        reviewLocked: 0,
        runAt: '2024-09-02T01:00:00Z',
      },
    }),
  });

  refreshKeysMock = vi.spyOn(storageClient, 'refreshSharedKeys').mockImplementation(async () => {
    storageClient.setItem('decl_rows_v1', JSON.stringify([
      { so_tk: 'TK-0001', nhanh: 'A1', trang_thai: 'cap-nhat' },
      { so_tk: 'TK-0002', nhanh: 'B2', trang_thai: 'moi' },
    ]));
  });
});

afterEach(() => {
  fetchMock?.mockRestore();
  refreshKeysMock?.mockRestore();
});

describe('decl sync queue integration', () => {
  it('processes queued jobs and updates progress snapshot', async () => {
    const job = store.enqueueDeclSyncJob({
      actor: 'linh.nguyen',
      from: '2024-09-01',
      to: '2024-09-02',
      includeTaxCodes: ['0101'],
    });

    expect(job.status).toBe('pending');

    await waitFor(() => store.getDeclSyncQueue().jobs[0]?.status === 'completed');

    const queue = store.getDeclSyncQueue();
    expect(queue.jobs).toHaveLength(1);
    const completed = queue.jobs[0];
    expect(completed.status).toBe('completed');
    expect(completed.step).toBe('completed');
    expect(completed.result).toEqual({ imported: 1, skipped: 0, reviewLocked: 0 });
    expect(completed.message).toMatch(/Đã đồng bộ 1/);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/import/ecus/run',
      expect.objectContaining({ method: 'POST' })
    );
    expect(refreshKeysMock).toHaveBeenCalledWith(
      [store.DECL_KEY, store.DECL_SYNC_HISTORY_KEY],
      expect.objectContaining({ jobId: completed.id })
    );

    const progress = store.getDeclSyncProgress();
    expect(progress.status).toBe('success');
    expect(progress.step).toBe('completed');
    expect(progress.rowsBefore).toBe(1);
    expect(progress.rowsAfter).toBe(2);
    expect(progress.diff).toMatchObject({ added: 1, updated: 1, removed: 0 });
    expect(progress.hasConflicts).toBe(false);

    const storedRows = JSON.parse(storageClient.getItem(store.DECL_KEY));
    expect(storedRows).toHaveLength(2);
    expect(storedRows[0].trang_thai).toBe('cap-nhat');
    expect(storedRows[1].so_tk).toBe('00000000002');
  });
});
