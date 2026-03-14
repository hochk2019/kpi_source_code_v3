import { createDomainModule } from '../create-domain-module.js';

export const mstAssignmentsModule = createDomainModule({
  id: 'mst-assignments',
  basePath: '/api/v4/mst-assignments',
  description: 'Temporal MST assignment management with effective date ranges.',
  schemaTargets: ['mst_assignments', 'mst_assignment_events'],
  routeGroups: [
    {
      name: 'assignments',
      routes: [
        { method: 'GET', path: '/', purpose: 'Query assignments by tax code, team, or effective range.' },
        { method: 'GET', path: '/resolve', purpose: 'Resolve the effective MST assignment for a target date.' },
        { method: 'POST', path: '/', purpose: 'Create an MST assignment window.' },
        { method: 'PATCH', path: '/:assignmentId', purpose: 'Update an MST assignment window.' },
      ],
    },
    {
      name: 'history',
      routes: [
        { method: 'GET', path: '/history', purpose: 'Read MST assignment change history.' },
      ],
    },
  ],
});
