/* eslint-env node */
/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  LEGACY_V4_MODULE_IDS,
  WAVE1_V4_MODULE_IDS,
  WAVE2_V4_MODULE_IDS,
  selectLegacyV4Modules,
  selectWave1V4Modules,
} from '../server/v4RolloutMount.js';

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

describe('legacy server-v4 module selection', () => {
  it('mounts wave-1 and wave-2 modules through the shared legacy selector', () => {
    const moduleCatalog = [
      { id: 'auth' },
      { id: 'reporting' },
      { id: 'teams' },
      { id: 'mst-assignments' },
      { id: 'hq-agencies' },
      { id: 'kpi-rules' },
      { id: 'kpi-adjustments' },
      { id: 'declarations' },
    ];

    const result = selectLegacyV4Modules(moduleCatalog);

    expect(WAVE2_V4_MODULE_IDS).toEqual(['kpi-rules', 'kpi-adjustments']);
    expect(LEGACY_V4_MODULE_IDS).toEqual([
      'reporting',
      'teams',
      'mst-assignments',
      'hq-agencies',
      'kpi-rules',
      'kpi-adjustments',
    ]);
    expect(result.selectedModules.map((entry) => entry.id)).toEqual(LEGACY_V4_MODULE_IDS);
    expect(result.missingModuleIds).toEqual([]);
  });

  it('reports any missing wave-2 modules from the compiled catalog', () => {
    const moduleCatalog = [
      { id: 'reporting' },
      { id: 'teams' },
      { id: 'mst-assignments' },
      { id: 'hq-agencies' },
      { id: 'kpi-rules' },
    ];

    const result = selectLegacyV4Modules(moduleCatalog);

    expect(result.selectedModules.map((entry) => entry.id)).toEqual([
      'reporting',
      'teams',
      'mst-assignments',
      'hq-agencies',
      'kpi-rules',
    ]);
    expect(result.missingModuleIds).toEqual(['kpi-adjustments']);
  });
});
