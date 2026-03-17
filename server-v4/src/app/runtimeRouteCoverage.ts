import { moduleCatalog } from './module-catalog.js';

export type RuntimeModuleRouteCoverage = {
  id: string;
  routeCount: number;
  mutationRouteCount: number;
};

export const runtimeModuleRouteCoverage: readonly RuntimeModuleRouteCoverage[] = Object.freeze(
  moduleCatalog.map((domainModule) => {
    const routes = domainModule.routeGroups.flatMap((group) => group.routes);

    return {
      id: domainModule.id,
      routeCount: routes.length,
      mutationRouteCount: routes.filter((route) => route.method !== 'GET').length,
    } satisfies RuntimeModuleRouteCoverage;
  }),
);
