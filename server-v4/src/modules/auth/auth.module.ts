import { createDomainModule } from '../create-domain-module.js';

export const authModule = createDomainModule({
  id: 'auth',
  basePath: '/api/v4/auth',
  description: 'Cookie-session accounts, roles, and permission resolution.',
  schemaTargets: ['auth_accounts', 'auth_sessions'],
  routeGroups: [
    {
      name: 'session',
      routes: [
        { method: 'GET', path: '/session', purpose: 'Restore the current authenticated session.' },
        { method: 'POST', path: '/login', purpose: 'Create a new cookie-backed session.' },
        { method: 'POST', path: '/logout', purpose: 'Destroy the current session.' },
      ],
    },
    {
      name: 'accounts',
      routes: [
        { method: 'GET', path: '/accounts', purpose: 'List accounts for account management.' },
        { method: 'POST', path: '/accounts', purpose: 'Create a new account.' },
        { method: 'PATCH', path: '/accounts/:username', purpose: 'Update account profile and permissions.' },
      ],
    },
  ],
});
