import { describe, expect, it } from 'vitest';

import {
  createImporterCompatTrafficTracker,
  getImporterCompatRouteDefinition,
} from '../../server-v4/src/app/importerCompatTraffic.ts';

describe('importer compat traffic tracker', () => {
  it('tracks only the remaining migrated importer compat routes after declarations aliases retire', () => {
    const tracker = createImporterCompatTrafficTracker({
      guardMode: 'block-migrated',
    });
    const migratedRoute = getImporterCompatRouteDefinition('GET', '/api/import/alerts');
    const retiredRoute = getImporterCompatRouteDefinition('GET', '/api/import/deleted-declarations');

    expect(migratedRoute).not.toBeNull();
    expect(retiredRoute).toBeNull();
    expect(tracker.shouldBlock(migratedRoute)).toBe(true);

    tracker.record(migratedRoute, {
      blocked: true,
      now: '2026-03-16T00:00:00.000Z',
    });

    const snapshot = tracker.snapshot();

    expect(snapshot).toMatchObject({
      guardMode: 'block-migrated',
      totals: {
        hits: 1,
        migratedHits: 1,
        legacyOnlyHits: 0,
        blockedHits: 1,
      },
    });

    expect(snapshot.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'alerts-list',
          kind: 'migrated',
          hitCount: 1,
          blockedCount: 1,
          lastHitAt: '2026-03-16T00:00:00.000Z',
        }),
      ]),
    );
  });
});
