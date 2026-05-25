import { createDomainModule } from '../create-domain-module.js';

export const filterPresetsModule = createDomainModule({
  id: 'filter-presets',
  basePath: '/api/v4/filter-presets',
  description: 'Saved filter preset CRUD scoped by authenticated user and workspace.',
  schemaTargets: ['filter_presets_v1'],
  routeGroups: [
    {
      name: 'presets',
      routes: [
        { method: 'GET', path: '/', purpose: 'List saved filter presets for current user and scope.' },
        { method: 'POST', path: '/', purpose: 'Create a saved filter preset for current user.' },
        { method: 'PUT', path: '/:presetId', purpose: 'Update an existing saved filter preset.' },
        { method: 'DELETE', path: '/:presetId', purpose: 'Delete an existing saved filter preset.' },
      ],
    },
  ],
});
