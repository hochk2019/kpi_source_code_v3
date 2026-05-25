import { createDomainModule } from '../create-domain-module.js';

export const feedbackTrainingModule = createDomainModule({
  id: 'feedback-training',
  basePath: '/api/v4/feedback-training',
  description: 'Training resources and user feedback collection/review endpoints.',
  schemaTargets: ['training-resources.json', 'feedback.json'],
  routeGroups: [
    {
      name: 'engagement',
      routes: [
        { method: 'GET', path: '/training-resources', purpose: 'List curated training resources.' },
        { method: 'GET', path: '/feedback/summary', purpose: 'Read aggregated user feedback summary.' },
        { method: 'GET', path: '/feedback', purpose: 'List feedback entries for admin/manager review.' },
        { method: 'POST', path: '/feedback', purpose: 'Create a new feedback entry from current user context.' },
      ],
    },
  ],
});
