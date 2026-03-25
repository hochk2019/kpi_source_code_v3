/* eslint-env node */
/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { WAVE1_V4_MODULE_IDS, selectWave1V4Modules } from '../server/v4RolloutMount.js';

describe('v4 rollout wave-1 module selection', () => {
  it('keeps the requested module order and detects missing modules', () => {
    const moduleCatalog = [
      { id: 'auth' },
      { id: 'reporting' },
      { id: 'mst-assignments' },
      { id: 'teams' },
      { id: 'hq-agencies' },
    ];

    const result = selectWave1V4Modules(moduleCatalog);

    expect(WAVE1_V4_MODULE_IDS).toEqual([
      'reporting',
      'teams',
      'mst-assignments',
      'hq-agencies',
    ]);
    expect(result.selectedModules.map((entry) => entry.id)).toEqual([
      'reporting',
      'mst-assignments',
      'teams',
      'hq-agencies',
    ]);
    expect(result.missingModuleIds).toEqual([]);
  });

  it('reports any missing wave-1 modules from the compiled catalog', () => {
    const moduleCatalog = [
      { id: 'reporting' },
      { id: 'teams' },
    ];

    const result = selectWave1V4Modules(moduleCatalog);

    expect(result.selectedModules.map((entry) => entry.id)).toEqual(['reporting', 'teams']);
    expect(result.missingModuleIds).toEqual(['mst-assignments', 'hq-agencies']);
  });
});

