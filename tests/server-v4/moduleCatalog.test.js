import { describe, expect, it } from 'vitest';

import { moduleCatalog } from '../../server-v4/src/index.ts';

describe('server-v4 module catalog', () => {
  it('tracks the expected domain boundaries', () => {
    expect(moduleCatalog.map((entry) => entry.id)).toEqual([
      'auth',
      'backup',
      'declarations',
      'mst-assignments',
      'teams',
      'hq-agencies',
      'kpi-rules',
      'kpi-adjustments',
      'reporting',
    ]);
  });

  it('keeps unique base paths and explicit layers for every module', () => {
    const basePaths = new Set(moduleCatalog.map((entry) => entry.basePath));

    expect(basePaths.size).toBe(moduleCatalog.length);

    for (const entry of moduleCatalog) {
      expect(entry.layers.controller).toMatch(/Controller$/);
      expect(entry.layers.service).toMatch(/Service$/);
      expect(entry.layers.repository).toMatch(/Repository$/);
      expect(entry.routeGroups.length).toBeGreaterThan(0);
      expect(entry.schemaTargets.length).toBeGreaterThan(0);
    }
  });
});
