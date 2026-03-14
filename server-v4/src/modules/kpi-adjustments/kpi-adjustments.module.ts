import { createDomainModule } from '../create-domain-module.js';

export const kpiAdjustmentsModule = createDomainModule({
  id: 'kpi-adjustments',
  basePath: '/api/v4/kpi-adjustments',
  description: 'Adjustment submission, approval lifecycle, and policy configuration.',
  schemaTargets: ['kpi_adjustments', 'config_documents'],
  routeGroups: [
    {
      name: 'adjustments',
      routes: [
        { method: 'GET', path: '/', purpose: 'List KPI adjustments by month, staff, team, or status.' },
        { method: 'POST', path: '/', purpose: 'Submit a KPI adjustment request.' },
        { method: 'PATCH', path: '/:adjustmentId', purpose: 'Update or approve an existing adjustment.' },
      ],
    },
    {
      name: 'policies',
      routes: [
        { method: 'GET', path: '/settings', purpose: 'Read adjustment policy and auto-approval settings.' },
        { method: 'PUT', path: '/settings', purpose: 'Update adjustment policy settings.' },
      ],
    },
  ],
});
