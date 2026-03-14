import { createDomainModule } from '../create-domain-module.js';

export const teamsModule = createDomainModule({
  id: 'teams',
  basePath: '/api/v4/teams',
  description: 'Team roster, member directory, and membership lookup boundaries.',
  schemaTargets: ['teams', 'team_members'],
  routeGroups: [
    {
      name: 'teams',
      routes: [
        { method: 'GET', path: '/__meta', purpose: 'Read module metadata for teams.' },
        { method: 'GET', path: '/', purpose: 'List active teams and roster summaries.' },
        { method: 'PUT', path: '/', purpose: 'Replace the active team roster snapshot.' },
        { method: 'POST', path: '/', purpose: 'Create a team.' },
        { method: 'PATCH', path: '/:teamId', purpose: 'Update team metadata.' },
      ],
    },
    {
      name: 'members',
      routes: [
        { method: 'POST', path: '/:teamId/members', purpose: 'Add a member to a team.' },
        { method: 'PATCH', path: '/members/:memberId', purpose: 'Update member profile or active status.' },
      ],
    },
  ],
});
