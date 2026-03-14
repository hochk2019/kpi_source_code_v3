import { describe, expect, it } from 'vitest';

import { ReportingService } from '../../server-v4/src/modules/reporting/reportingService.ts';

describe('ReportingService route surface', () => {
  it('does not expose retired compatibility read helpers', async () => {
    const service = new ReportingService({});

    expect(typeof service.getView).toBe('function');
    expect(typeof service.getObservability).toBe('function');
    expect('getSummary' in service).toBe(false);
    expect('getStaff' in service).toBe(false);
    expect('getTeams' in service).toBe(false);
  });
});
