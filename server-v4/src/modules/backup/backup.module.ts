import { createDomainModule } from '../create-domain-module.js';

export const backupModule = createDomainModule({
  id: 'backup',
  basePath: '/api/v4/backups',
  description: 'Database backup operations, retention, and backup schedule management.',
  schemaTargets: ['schema_migrations', 'kv_store', 'audit_logs_v1', 'db_backup_config_v1'],
  routeGroups: [
    {
      name: 'overview',
      routes: [
        { method: 'GET', path: '/summary', purpose: 'Return backup schedule metadata and recent backup outcomes.' },
        { method: 'GET', path: '/files', purpose: 'List available database backup files.' },
      ],
    },
    {
      name: 'operations',
      routes: [
        { method: 'POST', path: '/run', purpose: 'Run a database backup immediately.' },
        { method: 'POST', path: '/schedule', purpose: 'Update the database backup schedule and retention policy.' },
        { method: 'POST', path: '/restore', purpose: 'Restore the database from a selected backup file.' },
      ],
    },
  ],
});
