import { createDomainModule } from '../create-domain-module.js';

export const kpiRulesModule = createDomainModule({
  id: 'kpi-rules',
  basePath: '/api/v4/kpi-rules',
  description: 'Rule-set versioning and active KPI rule selection.',
  schemaTargets: ['kpi_rule_sets', 'kpi_declaration_results'],
  routeGroups: [
    {
      name: 'rule-sets',
      routes: [
        { method: 'GET', path: '/', purpose: 'List KPI rule sets and active version.' },
        { method: 'GET', path: '/history', purpose: 'Return recent KPI rule-set history entries.' },
        { method: 'POST', path: '/', purpose: 'Create a new KPI rule-set draft.' },
        { method: 'POST', path: '/:ruleSetId/activate', purpose: 'Activate a rule set for downstream KPI recomputation.' },
      ],
    },
  ],
});
