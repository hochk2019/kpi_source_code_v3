import type { DomainModule } from './domain-module.js';
import type { ImporterCompatTrafficSnapshot } from './importerCompatTraffic.js';

type CheckStatus = 'pass' | 'warn' | 'fail';

export type DeclarationShadowGroupStatus = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  canonicalRoutes: string[];
  compatRouteIds: string[];
  observedCompatHits: number;
  blockedCompatHits: number;
};

type DeclarationShadowGroupDefinition = {
  id: DeclarationShadowGroupStatus['id'];
  label: DeclarationShadowGroupStatus['label'];
  canonicalRoutes: string[];
  compatRouteIds: string[];
};

const DECLARATIONS_MODULE_ID = 'declarations';

const declarationShadowGroupDefinitions = Object.freeze([
  defineGroup(
    'declarations-shadow-ecus-preview-commit',
    'Declarations ECUS preview/commit shadow',
    ['POST /imports/ecus-preview', 'POST /imports/ecus-commit'],
    ['ecus-preview', 'ecus-run'],
  ),
  defineGroup(
    'declarations-shadow-alerts',
    'Declarations alerts config/review shadow',
    [
      'GET /imports/alerts',
      'GET /imports/alerts/config',
      'PUT /imports/alerts/config',
      'POST /imports/alerts/review',
      'POST /imports/alerts/unreview',
    ],
    ['alerts-list', 'alerts-config-read', 'alerts-config-write', 'alerts-review', 'alerts-unreview'],
  ),
  defineGroup(
    'declarations-shadow-co-discrepancy',
    'Declarations C/O discrepancy shadow',
    [
      'GET /imports/co-codes',
      'PUT /imports/co-codes',
      'GET /imports/co-discrepancy',
      'POST /imports/co-discrepancy/run',
      'PUT /imports/co-discrepancy/config',
    ],
    ['co-codes-read', 'co-codes-write', 'co-discrepancy-read', 'co-discrepancy-run', 'co-discrepancy-config-write'],
  ),
  defineGroup(
    'declarations-shadow-history-edit',
    'Declarations history/edit parity',
    ['PATCH /:declarationId', 'GET /:declarationId/events'],
    [],
  ),
] satisfies readonly DeclarationShadowGroupDefinition[]);

export function buildDeclarationsShadowStatus(input: {
  modules: readonly DomainModule[];
  importerCompat: ImporterCompatTrafficSnapshot;
}): {
  summary: string;
  groups: DeclarationShadowGroupStatus[];
} {
  const declarationsModule = input.modules.find((entry) => entry.id === DECLARATIONS_MODULE_ID);
  const declaredRoutes = new Set(
    (declarationsModule?.routeGroups ?? [])
      .flatMap((group) => group.routes)
      .map((route) => `${route.method} ${route.path}`),
  );
  const compatRoutes = new Map(
    input.importerCompat.routes.map((route) => [route.id, route] as const),
  );

  const groups = declarationShadowGroupDefinitions.map((group) => {
    const missingCanonicalRoutes = group.canonicalRoutes.filter((route) => !declaredRoutes.has(route));
    const missingCompatRouteIds = group.compatRouteIds.filter((routeId) => !compatRoutes.has(routeId));
    const observedCompatHits = group.compatRouteIds.reduce(
      (sum, routeId) => sum + (compatRoutes.get(routeId)?.hitCount ?? 0),
      0,
    );
    const blockedCompatHits = group.compatRouteIds.reduce(
      (sum, routeId) => sum + (compatRoutes.get(routeId)?.blockedCount ?? 0),
      0,
    );

    if (missingCanonicalRoutes.length > 0 || missingCompatRouteIds.length > 0) {
      const gaps = [
        missingCanonicalRoutes.length > 0
          ? `Missing canonical routes: ${missingCanonicalRoutes.join(', ')}.`
          : null,
        missingCompatRouteIds.length > 0
          ? `Missing compat telemetry ids: ${missingCompatRouteIds.join(', ')}.`
          : null,
      ]
        .filter(Boolean)
        .join(' ');

      return {
        id: group.id,
        label: group.label,
        status: 'fail',
        detail: gaps,
        canonicalRoutes: group.canonicalRoutes,
        compatRouteIds: group.compatRouteIds,
        observedCompatHits,
        blockedCompatHits,
      } satisfies DeclarationShadowGroupStatus;
    }

    if (observedCompatHits > 0) {
      return {
        id: group.id,
        label: group.label,
        status: 'warn',
        detail: `${observedCompatHits} legacy compat hit(s) still observed across ${formatCompatRouteIds(group.compatRouteIds)}. ${blockedCompatHits} hit(s) were blocked by the active compat guard.`,
        canonicalRoutes: group.canonicalRoutes,
        compatRouteIds: group.compatRouteIds,
        observedCompatHits,
        blockedCompatHits,
      } satisfies DeclarationShadowGroupStatus;
    }

    return {
      id: group.id,
      label: group.label,
      status: 'pass',
      detail:
        group.compatRouteIds.length > 0
          ? `Canonical routes are mounted and compat telemetry is wired for ${formatCompatRouteIds(group.compatRouteIds)} with no legacy hits observed since process start.`
          : 'Canonical declaration edit/history routes are mounted behind the v4 surface with no remaining compat alias to observe.',
      canonicalRoutes: group.canonicalRoutes,
      compatRouteIds: group.compatRouteIds,
      observedCompatHits,
      blockedCompatHits,
    } satisfies DeclarationShadowGroupStatus;
  });

  return {
    summary: summarizeGroups(groups),
    groups,
  };
}

function defineGroup(
  id: DeclarationShadowGroupDefinition['id'],
  label: DeclarationShadowGroupDefinition['label'],
  canonicalRoutes: DeclarationShadowGroupDefinition['canonicalRoutes'],
  compatRouteIds: DeclarationShadowGroupDefinition['compatRouteIds'],
): DeclarationShadowGroupDefinition {
  return {
    id,
    label,
    canonicalRoutes,
    compatRouteIds,
  };
}

function formatCompatRouteIds(routeIds: readonly string[]): string {
  if (routeIds.length === 0) {
    return 'no compat aliases';
  }

  return routeIds.join(', ');
}

function summarizeGroups(groups: readonly DeclarationShadowGroupStatus[]): string {
  const failed = groups.filter((group) => group.status === 'fail');
  if (failed.length > 0) {
    return `Declarations shadow rollout is blocked: ${failed.map((group) => group.label).join(', ')}.`;
  }

  const warned = groups.filter((group) => group.status === 'warn');
  if (warned.length > 0) {
    return `Declarations shadow rollout still sees legacy compat traffic for ${warned.map((group) => group.label).join(', ')}.`;
  }

  return 'Declarations shadow rollout gate is green for ECUS preview/commit, alerts workflows, C/O discrepancy, and declaration history/edit parity.';
}
