import { createDomainModule } from '../create-domain-module.js';

export const duplicatePolicyModule = createDomainModule({
  id: 'duplicate-policy',
  basePath: '/api/v4/duplicate-policy',
  description: 'Duplicate declaration policy configuration, locking state, and evaluation summary.',
  schemaTargets: ['duplicate_policy_config_v1', 'duplicate_policy_state_v1', 'decl_rows_v1'],
  routeGroups: [
    {
      name: 'policy',
      routes: [
        { method: 'GET', path: '/', purpose: 'Read duplicate-policy config, state, and summary.' },
        { method: 'PUT', path: '/', purpose: 'Update duplicate-policy config/state and trigger evaluation.' },
      ],
    },
  ],
});
