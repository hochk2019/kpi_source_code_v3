import { createDomainModule } from '../create-domain-module.js';

export const declarationsModule = createDomainModule({
  id: 'declarations',
  basePath: '/api/v4/declarations',
  description: 'Declaration fact ingestion, patching, search, and event history.',
  schemaTargets: [
    'declarations',
    'declaration_license_codes',
    'declaration_events',
    'config_documents',
    'kpi_declaration_results',
  ],
  routeGroups: [
    {
      name: 'ingestion',
      routes: [
        { method: 'GET', path: '/imports/ecus-config', purpose: 'Read the effective ECUS bridge sync configuration.' },
        { method: 'POST', path: '/imports/ecus-preview', purpose: 'Preview ECUS declarations before commit.' },
        { method: 'POST', path: '/imports/ecus-commit', purpose: 'Persist ECUS declarations into the fact store.' },
      ],
    },
    {
      name: 'co-monitoring',
      routes: [
        { method: 'GET', path: '/imports/co-codes', purpose: 'Read preferential C/O tax code configuration.' },
        { method: 'PUT', path: '/imports/co-codes', purpose: 'Update preferential C/O tax code configuration.' },
        { method: 'GET', path: '/imports/co-discrepancy', purpose: 'Read C/O discrepancy monitor config and state.' },
        {
          method: 'POST',
          path: '/imports/co-discrepancy/run',
          purpose: 'Run the C/O discrepancy monitor immediately.',
        },
        {
          method: 'PUT',
          path: '/imports/co-discrepancy/config',
          purpose: 'Update the C/O discrepancy monitor configuration.',
        },
      ],
    },
    {
      name: 'alerts',
      routes: [
        { method: 'GET', path: '/imports/alerts', purpose: 'Evaluate and list outstanding declaration alerts.' },
        { method: 'GET', path: '/imports/alerts/config', purpose: 'Read the declaration alert configuration.' },
        { method: 'PUT', path: '/imports/alerts/config', purpose: 'Update the declaration alert configuration.' },
        { method: 'POST', path: '/imports/alerts/review', purpose: 'Mark declaration alerts as reviewed.' },
        { method: 'POST', path: '/imports/alerts/unreview', purpose: 'Clear reviewed flags from declaration alerts.' },
      ],
    },
    {
      name: 'rows',
      routes: [
        { method: 'GET', path: '/', purpose: 'Query declaration rows with filter criteria.' },
        { method: 'PATCH', path: '/:declarationId', purpose: 'Patch editable declaration fields.' },
        { method: 'GET', path: '/:declarationId/events', purpose: 'Read declaration history and delete events.' },
      ],
    },
  ],
});
