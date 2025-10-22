import { describe, expect, it, beforeEach, vi } from 'vitest';



vi.mock('@/auth/localAuth.js', () => ({

  fetchWithAuth: vi.fn(),

}));



import { fetchWithAuth } from '@/auth/localAuth.js';

import {

  HQ_HISTORY_KEY,

  getHQHistoryEntries,

} from '@/lib/store.js';

import { clearStorageCache, setItem as sharedSetItem } from '@/lib/storageClient.js';

import {

  mergeHqHistoryEntries,

  refreshHQHistoryCache,

} from '@/lib/hqHistoryClient.js';



describe('hqHistoryClient', () => {

  beforeEach(() => {

    clearStorageCache();

    sharedSetItem(HQ_HISTORY_KEY, JSON.stringify([]));

    vi.clearAllMocks();

    fetchWithAuth.mockImplementation(async (url) => {

      if (typeof url === 'string' && url.includes('/api/storage/')) {

        return { ok: true, json: async () => ({ ok: true }) };

      }

      return { ok: true, json: async () => ({ entries: [], total: 0, limit: 50 }) };

    });

  });



  it('mergeHqHistoryEntries giữ lại bản ghi mới nhất theo id', () => {

    const existing = [

      {

        id: 'hq-0101-company',

        mst: '0101',

        field: 'company',

        from: '',

        to: 'Công ty A',

        actor: 'tester',

        timestamp: '2024-05-01T00:00:00.000Z',

        type: 'create',

      },

    ];

    const incoming = [

      {

        id: 'hq-0101-company',

        mst: '0101',

        field: 'company',

        from: 'Công ty A',

        to: 'Công ty B',

        actor: 'tester2',

        timestamp: '2024-06-01T00:00:00.000Z',

        type: 'update',

      },

    ];



    const merged = mergeHqHistoryEntries(existing, incoming, { limit: 10 });

    expect(merged).toHaveLength(1);

    expect(merged[0]).toMatchObject({

      mst: '0101',

      to: 'Công ty B',

      actor: 'tester2',

      type: 'update',

    });

  });



  it('refreshHQHistoryCache hợp nhất dữ liệu cục bộ nếu backend trả về rỗng', async () => {

    const localEntry = {

      id: 'hq-0202-company',

      mst: '0202',

      field: 'company',

      from: '',

      to: 'Doanh nghiệp X',

      actor: 'tester',

      timestamp: '2024-07-01T08:00:00.000Z',

      type: 'create',

    };

    sharedSetItem(HQ_HISTORY_KEY, JSON.stringify([localEntry]));



    const result = await refreshHQHistoryCache({ limit: 50 });

    expect(fetchWithAuth).toHaveBeenCalledWith(expect.stringContaining('/api/hq/history'), expect.any(Object));

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({ mst: '0202', to: 'Doanh nghiệp X' });



    const stored = getHQHistoryEntries();

    expect(stored[0]).toMatchObject({ mst: '0202', to: 'Doanh nghiệp X' });

  });

});

