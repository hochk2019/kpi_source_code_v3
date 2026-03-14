import { beforeEach, describe, expect, it, vi } from 'vitest';

const { aggregateByCompanyMock, buildReportDataMock } = vi.hoisted(() => ({
  aggregateByCompanyMock: vi.fn(),
  buildReportDataMock: vi.fn(),
}));

vi.mock('../shared/reportingCompanyAggregation.js', () => ({
  aggregateByCompany: aggregateByCompanyMock,
}));

vi.mock('../shared/reportingLegacyMath.js', () => ({
  buildReportData: buildReportDataMock,
}));

describe('server legacyReportingBridge', () => {
  beforeEach(() => {
    vi.resetModules();
    aggregateByCompanyMock.mockReset();
    buildReportDataMock.mockReset();
  });

  it('routes backend reporting math through shared reporting modules', async () => {
    const rows = [{ so_tk: 'TK1' }];
    const options = {
      roster: { version: 1, teams: [] },
      rules: { id: 'legacy-kpi', name: 'Legacy KPI' },
      from: '2026-02-01',
      to: '2026-02-28',
      adjustments: [{ id: 'adj-1' }],
    };
    const report = {
      summary: { decls: 1, kpi: 1.2 },
      staff: { list: [], keysHash: '' },
      teams: { list: [], keysHash: '' },
      range: { from: '2026-02-01', to: '2026-02-28' },
      rules: options.rules,
      trend: { series: [], teamSeries: [], comparison: null, topTeams: [] },
      adjustments: {},
    };
    const companies = [{ marker: 'companies' }];

    buildReportDataMock.mockReturnValue(report);
    aggregateByCompanyMock.mockReturnValue(companies);

    const bridge = await import('../server/legacyReportingBridge.js');

    expect(bridge.buildLegacyReportData(rows, options)).toBe(report);
    expect(bridge.aggregateLegacyCompanies(rows, { includeStaff: true })).toBe(companies);
    expect(buildReportDataMock).toHaveBeenCalledWith(rows, options);
    expect(aggregateByCompanyMock).toHaveBeenCalledWith(rows, { includeStaff: true });
  });
});
