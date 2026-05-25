import { createDomainModule } from '../create-domain-module.js';

export const dataHealthModule = createDomainModule({
  id: 'data-health',
  basePath: '/api/v4/data-health',
  description: 'Operational data-health summary for declarations, duplicate-policy, storage, and sync health.',
  schemaTargets: ['duplicate_policy_config_v1', 'duplicate_policy_state_v1', 'alerts_config_v1'],
  routeGroups: [
    {
      name: 'overview',
      routes: [{ method: 'GET', path: '/summary', purpose: 'Return data-health dashboard summary payload.' }],
    },
  ],
});

