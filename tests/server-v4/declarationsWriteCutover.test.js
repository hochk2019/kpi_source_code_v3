import { describe, expect, it } from 'vitest';

import { buildDeclarationWriteCutoverStatus } from '../../server-v4/src/app/declarationsWriteCutover.ts';
import { createEmptyImporterCompatTrafficSnapshot } from '../../server-v4/src/app/importerCompatTraffic.ts';

function createShadowGroup(overrides = {}) {
  return {
    id: 'declarations-shadow-alerts',
    label: 'Alerts config/review',
    status: 'pass',
    detail: 'Alerts routes are green.',
    compatRouteIds: ['alerts-list'],
    observedCompatHits: 0,
    blockedCompatHits: 0,
    ...overrides,
  };
}

describe('declarations write cutover policy', () => {
  it('is ready only when shadow parity is green and migrated compat routes are blocked with zero hits', () => {
    const status = buildDeclarationWriteCutoverStatus({
      shadowGroups: [createShadowGroup()],
      importerCompat: createEmptyImporterCompatTrafficSnapshot('block-migrated'),
    });

    expect(status).toMatchObject({
      readiness: 'ready',
      requiredGuardMode: 'block-migrated',
      observedGuardMode: 'block-migrated',
      observedMigratedCompatHits: 0,
      shadowGateStatus: 'pass',
    });
    expect(status.summary).toContain('ready');
  });

  it('holds cutover when compat guard mode is not enforcing migrated legacy blocks', () => {
    const status = buildDeclarationWriteCutoverStatus({
      shadowGroups: [createShadowGroup()],
      importerCompat: createEmptyImporterCompatTrafficSnapshot('off'),
    });

    expect(status).toMatchObject({
      readiness: 'hold',
      observedGuardMode: 'off',
      shadowGateStatus: 'pass',
    });
    expect(status.blockers).toContain(
      'Compat guard mode must be `block-migrated` before declarations write cutover.',
    );
  });

  it('blocks cutover when any declaration shadow group is still failing', () => {
    const status = buildDeclarationWriteCutoverStatus({
      shadowGroups: [
        createShadowGroup({
          id: 'declarations-shadow-ecus-preview-commit',
          label: 'ECUS preview/commit',
          status: 'fail',
          detail: 'Canonical ECUS routes are missing.',
        }),
      ],
      importerCompat: createEmptyImporterCompatTrafficSnapshot('block-migrated'),
    });

    expect(status).toMatchObject({
      readiness: 'blocked',
      shadowGateStatus: 'fail',
    });
    expect(status.detail).toContain('ECUS preview/commit');
  });
});
