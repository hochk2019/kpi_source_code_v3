import type { DeclarationShadowGroupStatus } from './declarationsShadowRollout.js';
import type { ImporterCompatTrafficSnapshot } from './importerCompatTraffic.js';

export type DeclarationWriteCutoverReadiness = 'ready' | 'hold' | 'blocked';

export type DeclarationWriteCutoverStatus = {
  readiness: DeclarationWriteCutoverReadiness;
  summary: string;
  detail: string;
  blockers: string[];
  requiredGuardMode: 'block-migrated';
  observedGuardMode: ImporterCompatTrafficSnapshot['guardMode'];
  observedMigratedCompatHits: number;
  observedBlockedCompatHits: number;
  shadowGateStatus: 'pass' | 'warn' | 'fail';
  shadowGroups: Array<{
    id: string;
    label: string;
    status: DeclarationShadowGroupStatus['status'];
  }>;
};

export function buildDeclarationWriteCutoverStatus(input: {
  shadowGroups: DeclarationShadowGroupStatus[];
  importerCompat: ImporterCompatTrafficSnapshot;
}): DeclarationWriteCutoverStatus {
  const failedGroups = input.shadowGroups.filter((group) => group.status === 'fail');
  const warnedGroups = input.shadowGroups.filter((group) => group.status === 'warn');
  const blockers: string[] = [];

  if (failedGroups.length > 0) {
    blockers.push(`Shadow parity is still failing for: ${failedGroups.map((group) => group.label).join(', ')}.`);
  }

  if (input.importerCompat.guardMode !== 'block-migrated') {
    blockers.push('Compat guard mode must be `block-migrated` before declarations write cutover.');
  }

  if (input.importerCompat.totals.migratedHits > 0) {
    blockers.push(
      `Observed ${input.importerCompat.totals.migratedHits} migrated compat hit(s) since process start; restart the process and rerun canonical QA until the count stays at zero.`,
    );
  }

  if (warnedGroups.length > 0) {
    blockers.push(`Shadow parity still warns for: ${warnedGroups.map((group) => group.label).join(', ')}.`);
  }

  const readiness =
    failedGroups.length > 0 ? 'blocked' : blockers.length > 0 ? 'hold' : 'ready';
  const shadowGateStatus =
    failedGroups.length > 0 ? 'fail' : warnedGroups.length > 0 ? 'warn' : 'pass';

  if (readiness === 'ready') {
    return {
      readiness,
      summary:
        'Declarations write cutover is ready: compat guard blocks migrated legacy paths and canonical QA stayed clean.',
      detail:
        'All declaration shadow groups are green, compat guard mode is `block-migrated`, and no migrated compat hits were observed since process start.',
      blockers: [],
      requiredGuardMode: 'block-migrated',
      observedGuardMode: input.importerCompat.guardMode,
      observedMigratedCompatHits: input.importerCompat.totals.migratedHits,
      observedBlockedCompatHits: input.importerCompat.totals.blockedHits,
      shadowGateStatus,
      shadowGroups: input.shadowGroups.map((group) => ({
        id: group.id,
        label: group.label,
        status: group.status,
      })),
    };
  }

  return {
    readiness,
    summary:
      readiness === 'blocked'
        ? 'Declarations write cutover is blocked until declaration shadow parity is fixed.'
        : 'Declarations write cutover is on hold pending compat guard and clean canonical QA.',
    detail: blockers.join(' '),
    blockers,
    requiredGuardMode: 'block-migrated',
    observedGuardMode: input.importerCompat.guardMode,
    observedMigratedCompatHits: input.importerCompat.totals.migratedHits,
    observedBlockedCompatHits: input.importerCompat.totals.blockedHits,
    shadowGateStatus,
    shadowGroups: input.shadowGroups.map((group) => ({
      id: group.id,
      label: group.label,
      status: group.status,
    })),
  };
}
