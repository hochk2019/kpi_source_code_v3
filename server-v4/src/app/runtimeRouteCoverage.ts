export type RuntimeModuleRouteCoverage = {
  id: string;
  routeCount: number;
  mutationRouteCount: number;
};

export const runtimeModuleRouteCoverage: readonly RuntimeModuleRouteCoverage[] = Object.freeze([
  {
    id: 'auth',
    routeCount: 6,
    mutationRouteCount: 4,
  },
  {
    id: 'declarations',
    routeCount: 3,
    mutationRouteCount: 1,
  },
  {
    id: 'hq-agencies',
    routeCount: 4,
    mutationRouteCount: 2,
  },
  {
    id: 'kpi-adjustments',
    routeCount: 5,
    mutationRouteCount: 3,
  },
  {
    id: 'kpi-rules',
    routeCount: 3,
    mutationRouteCount: 2,
  },
  {
    id: 'mst-assignments',
    routeCount: 2,
    mutationRouteCount: 0,
  },
  {
    id: 'reporting',
    routeCount: 6,
    mutationRouteCount: 2,
  },
  {
    id: 'teams',
    routeCount: 2,
    mutationRouteCount: 1,
  },
]);
