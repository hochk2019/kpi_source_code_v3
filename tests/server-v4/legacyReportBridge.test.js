import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildLegacyReportDataMock, aggregateLegacyCompaniesMock } = vi.hoisted(() => ({
  buildLegacyReportDataMock: vi.fn(),
  aggregateLegacyCompaniesMock: vi.fn(),
}));

vi.mock('@kpi/backend-shared/reporting', async () => {
  const actual = await vi.importActual('@kpi/backend-shared/reporting');
  return {
    ...actual,
    buildLegacyReportData: buildLegacyReportDataMock,
    aggregateLegacyCompanies: aggregateLegacyCompaniesMock,
  };
});

describe('server-v4 legacy report bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    buildLegacyReportDataMock.mockReset();
    aggregateLegacyCompaniesMock.mockReset();
  });

  it('forwards report-data and company aggregation calls through the shared legacy bridge', async () => {
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
    buildLegacyReportDataMock.mockReturnValue(report);
    aggregateLegacyCompaniesMock.mockReturnValue(companies);

    const bridge = await import('../../server-v4/src/legacy/legacy-report-bridge.ts');

    await expect(bridge.buildLegacyReportData(rows, options)).resolves.toBe(report);
    await expect(bridge.aggregateLegacyCompanies(rows, { includeStaff: true })).resolves.toBe(companies);
    expect(buildLegacyReportDataMock).toHaveBeenCalledWith(rows, options);
    expect(aggregateLegacyCompaniesMock).toHaveBeenCalledWith(rows, { includeStaff: true });
  });
});
