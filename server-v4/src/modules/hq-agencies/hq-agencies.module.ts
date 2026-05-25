import { createDomainModule } from '../create-domain-module.js';

export const hqAgenciesModule = createDomainModule({
  id: 'hq-agencies',
  basePath: '/api/v4/hq-agencies',
  description: 'Tax-code to HQ agency bindings and agency binding history.',
  schemaTargets: ['tax_code_agency_bindings', 'tax_code_agency_binding_agents', 'tax_code_agency_binding_events'],
  routeGroups: [
    {
      name: 'bindings',
      routes: [
        { method: 'GET', path: '/', purpose: 'List agency bindings by tax code or company.' },
        { method: 'POST', path: '/', purpose: 'Create or replace an agency binding.' },
        { method: 'DELETE', path: '/:taxCode', purpose: 'Remove an agency binding.' },
      ],
    },
    {
      name: 'history',
      routes: [
        { method: 'GET', path: '/history', purpose: 'Read agency binding history.' },
      ],
    },
  ],
});
