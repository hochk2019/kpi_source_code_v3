import type { DeclarationShadowGroupStatus } from './declarationsShadowRollout.js';
import type { ImporterCompatTrafficSnapshot } from './importerCompatTraffic.js';

export type DeclarationWriteCutoverReadiness = 'ready' | 'hold' | 'blocked';

export type DeclarationWriteCutoverStatus = {
  readiness: DeclarationWriteCutoverReadiness;
  summary: string;
  detail: string;
  blockers: string[];
  recommendedWritePath: 'canonical-v4' | 'monolith-legacy';
  operatorAction: string;
  rollbackSteps: string[];
  verificationGates: Array<
    'postgresDeclarationsRoute' | 'legacyCompatRoutes' | 'importerCompatTraffic' | 'runtimeRoutes' | 'v4RolloutStatus'
  >;
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

const DECLARATION_WRITE_CUTOVER_VERIFICATION_GATES: DeclarationWriteCutoverStatus['verificationGates'] = [
  'postgresDeclarationsRoute',
  'legacyCompatRoutes',
  'importerCompatTraffic',
  'runtimeRoutes',
  'v4RolloutStatus',
];

const DECLARATION_WRITE_CUTOVER_ROLLBACK_STEPS: string[] = [
  'Set `KPI_API_IMPORTER_COMPAT_GUARD_MODE=off` and restart server-v4 to reopen migrated legacy importer routes.',
  'Route declarations/importer operators back to the monolith `/api/*` write flows until canonical parity is green again.',
  'Rerun the declarations QA matrix and confirm `v4RolloutStatus` is green before re-enabling the cutover.',
];

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
      recommendedWritePath: 'canonical-v4',
      operatorAction:
        'Route declarations/importer writes to canonical `/api/v4/declarations/*` endpoints, keep the compat guard at `block-migrated`, and watch rollout status during controlled QA.',
      rollbackSteps: DECLARATION_WRITE_CUTOVER_ROLLBACK_STEPS,
      verificationGates: DECLARATION_WRITE_CUTOVER_VERIFICATION_GATES,
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
    recommendedWritePath: 'monolith-legacy',
    operatorAction:
      readiness === 'blocked'
        ? 'Keep declarations/importer operators on the monolith `/api/*` write flows until shadow parity failures are fixed and the cutover gates return green.'
        : 'Keep declarations/importer operators on the monolith `/api/*` write flows until compat guard is `block-migrated` and canonical QA completes with zero migrated compat hits.',
    rollbackSteps: DECLARATION_WRITE_CUTOVER_ROLLBACK_STEPS,
    verificationGates: DECLARATION_WRITE_CUTOVER_VERIFICATION_GATES,
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
