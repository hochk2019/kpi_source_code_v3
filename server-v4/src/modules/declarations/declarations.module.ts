import { createDomainModule } from '../create-domain-module.js';

export const declarationsModule = createDomainModule({
  id: 'declarations',
  basePath: '/api/v4/declarations',
  description: 'Declaration fact ingestion, patching, search, and event history.',
  schemaTargets: ['declarations', 'declaration_license_codes', 'declaration_events', 'kpi_declaration_results'],
  routeGroups: [
    {
      name: 'ingestion',
      routes: [
        { method: 'POST', path: '/imports/ecus-preview', purpose: 'Preview ECUS declarations before commit.' },
        { method: 'POST', path: '/imports/ecus-commit', purpose: 'Persist ECUS declarations into the fact store.' },
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
