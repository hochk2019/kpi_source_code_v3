import { createDomainModule } from '../create-domain-module.js';

export const reportingModule = createDomainModule({
  id: 'reporting',
  basePath: '/api/v4/reporting',
  description: 'Aggregate KPI reporting, exports, and schedule execution.',
  schemaTargets: ['kpi_staff_monthly', 'kpi_team_monthly', 'report_schedules', 'export_audit', 'export_audit_access'],
  routeGroups: [
    {
      name: 'reports',
      routes: [
        { method: 'GET', path: '/summary', purpose: 'Return aggregate KPI summaries for the selected range.' },
        { method: 'GET', path: '/staff', purpose: 'Return staff-level KPI aggregates.' },
        { method: 'GET', path: '/teams', purpose: 'Return team-level KPI aggregates.' },
        {
          method: 'GET',
          path: '/aggregates/monthly',
          purpose: 'Return monthly KPI aggregate read models for the selected range.',
        },
      ],
    },
    {
      name: 'exports-and-schedules',
      routes: [
        { method: 'POST', path: '/exports', purpose: 'Create an export job and audit record.' },
        { method: 'GET', path: '/exports/audit', purpose: 'List report export audit entries.' },
        { method: 'GET', path: '/audit/export', purpose: 'Export admin audit logs as CSV.' },
        { method: 'GET', path: '/schedules', purpose: 'List report schedules.' },
        { method: 'POST', path: '/schedules', purpose: 'Create or update a report schedule.' },
      ],
    },
  ],
});
