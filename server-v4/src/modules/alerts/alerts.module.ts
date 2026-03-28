import { createDomainModule } from '../create-domain-module.js';

export const alertsModule = createDomainModule({
  id: 'alerts',
  basePath: '/api/v4/alerts',
  description: 'Declaration alert review workflows and system notification feeds.',
  schemaTargets: ['decl_alert_config_v1', 'decl_review_state_v1', 'notifications_v1'],
  routeGroups: [
    {
      name: 'overview',
      routes: [
        { method: 'GET', path: '/summary', purpose: 'Return the current alert payload, summary, and config.' },
        { method: 'GET', path: '/config', purpose: 'Return the current declaration alert configuration.' },
        { method: 'GET', path: '/notifications', purpose: 'List recent system notifications for the active session.' },
        {
          method: 'GET',
          path: '/notifications/stream',
          purpose: 'Open an SSE stream for live system notifications.',
        },
      ],
    },
    {
      name: 'operations',
      routes: [
        { method: 'PUT', path: '/config', purpose: 'Update alert configuration and re-evaluate declarations.' },
        { method: 'POST', path: '/review', purpose: 'Mark declaration alerts as reviewed.' },
        { method: 'POST', path: '/unreview', purpose: 'Clear reviewed flags from declaration alerts.' },
      ],
    },
  ],
});
