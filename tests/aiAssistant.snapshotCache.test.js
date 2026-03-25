import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildSnapshotCacheKey,
  getLocalSnapshotCacheEntry,
  pruneLocalSnapshotCache,
  storeLocalSnapshotCacheEntry,
  writeLocalSnapshotCache,
} from '@/components/ai-assistant/snapshotCache.js';

describe('aiAssistant snapshot cache helpers', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('stores and returns a defensive clone for a cache entry', () => {
    const snapshot = { summary: { declarations: 12 } };

    storeLocalSnapshotCacheEntry('2026-03-01|2026-03-31', snapshot, 1_000);

    const cached = getLocalSnapshotCacheEntry('2026-03-01|2026-03-31', 1_000);
    expect(cached).toMatchObject({
      key: '2026-03-01|2026-03-31',
      cachedAt: 1_000,
      snapshot: { summary: { declarations: 12 } },
    });

    cached.snapshot.summary.declarations = 99;

    expect(getLocalSnapshotCacheEntry('2026-03-01|2026-03-31', 1_000)?.snapshot.summary.declarations).toBe(12);
  });

  it('prunes malformed and expired entries before lookup', () => {
    writeLocalSnapshotCache({
      version: 1,
      entries: [
        { key: 'expired', cachedAt: 0, snapshot: { summary: { declarations: 1 } } },
        { key: '', cachedAt: 399_000, snapshot: { summary: { declarations: 2 } } },
        { key: 'fresh', cachedAt: 399_000, snapshot: { summary: { declarations: 3 } } },
      ],
    });

    const cache = pruneLocalSnapshotCache(400_000);

    expect(cache.entries).toHaveLength(1);
    expect(cache.entries[0].key).toBe('fresh');
    expect(getLocalSnapshotCacheEntry('expired', 400_000)).toBeNull();
  });

  it('builds cache keys from range params', () => {
    expect(buildSnapshotCacheKey({ from: '2026-03-01', to: '2026-03-31' })).toBe('2026-03-01|2026-03-31');
    expect(buildSnapshotCacheKey({})).toBe('|');
  });
});
