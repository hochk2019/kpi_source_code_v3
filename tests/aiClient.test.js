/* @vitest-environment jsdom */

import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@/auth/localAuth.js', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '@/auth/localAuth.js';
import {
  fetchAiConfig,
  fetchAiInsights,
  fetchAiSnapshotHistoryEntry,
} from '@/lib/aiClient.js';

describe('aiClient canonical routes', () => {
  beforeEach(() => {
    fetchWithAuth.mockReset();
  });

  it('loads AI config from canonical /api/v4 endpoint', async () => {
    fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, config: { enabled: true }, cacheSummary: [] }),
    });

    await fetchAiConfig();

    expect(fetchWithAuth).toHaveBeenCalledWith('/api/v4/ai/config', { signal: undefined });
  });

  it('builds insights query from canonical /api/v4 endpoint', async () => {
    fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, insights: [], meta: {} }),
    });

    await fetchAiInsights({ limit: 12, historyLimit: 5 });

    expect(fetchWithAuth).toHaveBeenCalledWith('/api/v4/ai/insights?limit=12&historyLimit=5', { signal: undefined });
  });

  it('loads snapshot history entry from canonical /api/v4 endpoint', async () => {
    fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, entry: { id: 'snap-1' } }),
    });

    await fetchAiSnapshotHistoryEntry('snap-1');

    expect(fetchWithAuth).toHaveBeenCalledWith('/api/v4/ai/data/snapshot/history/snap-1', { signal: undefined });
  });
});
