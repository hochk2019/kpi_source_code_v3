export type ImporterCompatRouteKind = 'migrated' | 'legacy-only';
export type ImporterCompatGuardMode = 'off' | 'block-migrated';

export type ImporterCompatRouteDefinition = {
  id: string;
  method: 'GET' | 'POST' | 'PUT';
  legacyPath: string;
  kind: ImporterCompatRouteKind;
  canonicalPath: string | null;
};

export type ImporterCompatTrafficRouteSnapshot = ImporterCompatRouteDefinition & {
  hitCount: number;
  blockedCount: number;
  lastHitAt: string | null;
};

export type ImporterCompatTrafficSnapshot = {
  guardMode: ImporterCompatGuardMode;
  totals: {
    hits: number;
    migratedHits: number;
    legacyOnlyHits: number;
    blockedHits: number;
  };
  routes: ImporterCompatTrafficRouteSnapshot[];
};

export type ImporterCompatTrafficTracker = {
  guardMode: ImporterCompatGuardMode;
  shouldBlock(route: ImporterCompatRouteDefinition): boolean;
  record(
    route: ImporterCompatRouteDefinition,
    options?: {
      blocked?: boolean;
      now?: Date | string;
    },
  ): void;
  snapshot(): ImporterCompatTrafficSnapshot;
};

const importerCompatRouteDefinitions = Object.freeze([
  defineRoute('ecus-preview', 'POST', '/api/import/ecus/preview', 'migrated', '/api/v4/declarations/imports/ecus-preview'),
  defineRoute('ecus-run', 'POST', '/api/import/ecus/run', 'migrated', '/api/v4/declarations/imports/ecus-commit'),
  defineRoute('alerts-list', 'GET', '/api/import/alerts', 'migrated', '/api/v4/declarations/imports/alerts'),
  defineRoute('alerts-config-read', 'GET', '/api/import/alerts/config', 'migrated', '/api/v4/declarations/imports/alerts/config'),
  defineRoute('alerts-config-write', 'PUT', '/api/import/alerts/config', 'migrated', '/api/v4/declarations/imports/alerts/config'),
  defineRoute('alerts-review', 'POST', '/api/import/alerts/review', 'migrated', '/api/v4/declarations/imports/alerts/review'),
  defineRoute('alerts-unreview', 'POST', '/api/import/alerts/unreview', 'migrated', '/api/v4/declarations/imports/alerts/unreview'),
  defineRoute('co-codes-read', 'GET', '/api/import/co-codes', 'migrated', '/api/v4/declarations/imports/co-codes'),
  defineRoute('co-codes-write', 'PUT', '/api/import/co-codes', 'migrated', '/api/v4/declarations/imports/co-codes'),
  defineRoute('co-discrepancy-read', 'GET', '/api/import/co-discrepancy', 'migrated', '/api/v4/declarations/imports/co-discrepancy'),
  defineRoute('co-discrepancy-run', 'POST', '/api/import/co-discrepancy/run', 'migrated', '/api/v4/declarations/imports/co-discrepancy/run'),
  defineRoute('co-discrepancy-config-write', 'PUT', '/api/import/co-discrepancy/config', 'migrated', '/api/v4/declarations/imports/co-discrepancy/config'),
] satisfies readonly ImporterCompatRouteDefinition[]);

const routeDefinitionMap = new Map(
  importerCompatRouteDefinitions.map((route) => [toRouteKey(route.method, route.legacyPath), route] as const),
);

export function listImporterCompatRouteDefinitions(): readonly ImporterCompatRouteDefinition[] {
  return importerCompatRouteDefinitions;
}

export function getImporterCompatRouteDefinition(
  method: string,
  legacyPath: string,
): ImporterCompatRouteDefinition | null {
  return routeDefinitionMap.get(toRouteKey(method, legacyPath)) ?? null;
}

export function createEmptyImporterCompatTrafficSnapshot(
  guardMode: ImporterCompatGuardMode = 'off',
): ImporterCompatTrafficSnapshot {
  return {
    guardMode,
    totals: {
      hits: 0,
      migratedHits: 0,
      legacyOnlyHits: 0,
      blockedHits: 0,
    },
    routes: importerCompatRouteDefinitions.map((route) => ({
      ...route,
      hitCount: 0,
      blockedCount: 0,
      lastHitAt: null,
    })),
  };
}

export function createImporterCompatTrafficTracker(
  options: {
    guardMode?: ImporterCompatGuardMode;
  } = {},
): ImporterCompatTrafficTracker {
  const guardMode = options.guardMode ?? 'off';
  const counters = new Map(
    importerCompatRouteDefinitions.map((route) => [
      route.id,
      {
        hitCount: 0,
        blockedCount: 0,
        lastHitAt: null as string | null,
      },
    ]),
  );

  return {
    guardMode,
    shouldBlock(route) {
      return guardMode === 'block-migrated' && route.kind === 'migrated';
    },
    record(route, options = {}) {
      const entry = counters.get(route.id);
      if (!entry) {
        return;
      }
      entry.hitCount += 1;
      if (options.blocked) {
        entry.blockedCount += 1;
      }
      entry.lastHitAt = normalizeTimestamp(options.now);
    },
    snapshot() {
      const routes = importerCompatRouteDefinitions.map((route) => {
        const entry = counters.get(route.id);
        return {
          ...route,
          hitCount: entry?.hitCount ?? 0,
          blockedCount: entry?.blockedCount ?? 0,
          lastHitAt: entry?.lastHitAt ?? null,
        } satisfies ImporterCompatTrafficRouteSnapshot;
      });

      return {
        guardMode,
        totals: {
          hits: routes.reduce((sum, route) => sum + route.hitCount, 0),
          migratedHits: routes
            .filter((route) => route.kind === 'migrated')
            .reduce((sum, route) => sum + route.hitCount, 0),
          legacyOnlyHits: routes
            .filter((route) => route.kind === 'legacy-only')
            .reduce((sum, route) => sum + route.hitCount, 0),
          blockedHits: routes.reduce((sum, route) => sum + route.blockedCount, 0),
        },
        routes,
      } satisfies ImporterCompatTrafficSnapshot;
    },
  };
}

export function describeImporterCompatTraffic(snapshot: ImporterCompatTrafficSnapshot): string {
  const migratedRoutes = snapshot.routes.filter((route) => route.kind === 'migrated' && route.hitCount > 0);

  if (snapshot.totals.migratedHits === 0) {
    return snapshot.totals.legacyOnlyHits > 0
      ? `No migrated legacy importer traffic has been observed since process start. Legacy-only compat hits: ${snapshot.totals.legacyOnlyHits}.`
      : 'No legacy importer compat traffic has been observed since process start.';
  }

  const routeList = migratedRoutes
    .map((route) => `${route.method} ${route.legacyPath} (${route.hitCount})`)
    .join(', ');
  const blockedText =
    snapshot.totals.blockedHits > 0
      ? ` ${snapshot.totals.blockedHits} migrated hit(s) were blocked by guard mode ${snapshot.guardMode}.`
      : '';

  return `${snapshot.totals.migratedHits} migrated legacy importer compat hit(s) observed since process start via ${routeList}.${blockedText}`;
}

function defineRoute(
  id: string,
  method: ImporterCompatRouteDefinition['method'],
  legacyPath: string,
  kind: ImporterCompatRouteKind,
  canonicalPath: string | null = null,
): ImporterCompatRouteDefinition {
  return {
    id,
    method,
    legacyPath,
    kind,
    canonicalPath,
  };
}

function toRouteKey(method: string, legacyPath: string): string {
  return `${method.trim().toUpperCase()} ${legacyPath.trim()}`;
}

function normalizeTimestamp(value: Date | string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const normalized = value.trim();
  return normalized || new Date().toISOString();
}
