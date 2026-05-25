import { describe, expect, it } from 'vitest';

import { resolveApiRuntimeConfig } from '../../apps/api/src/apiRuntimeConfig.js';

describe('api runtime config', () => {
  it('reads the importer compat guard mode from env', () => {
    const config = resolveApiRuntimeConfig(
      {},
      {
        KPI_API_IMPORTER_COMPAT_GUARD_MODE: 'block-migrated',
      },
    );

    expect(config.importerCompatGuardMode).toBe('block-migrated');
  });
});
