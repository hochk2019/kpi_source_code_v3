import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildLegacyReportDataMock, aggregateLegacyCompaniesMock } = vi.hoisted(() => ({
  buildLegacyReportDataMock: vi.fn(),
  aggregateLegacyCompaniesMock: vi.fn(),
}));

vi.mock('../packages/backend-shared/src/reporting/legacyReportingBridge.js', () => ({
  buildLegacyReportData: buildLegacyReportDataMock,
  aggregateLegacyCompanies: aggregateLegacyCompaniesMock,
}));

describe('reportingReadModels shared bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    buildLegacyReportDataMock.mockReset();
    aggregateLegacyCompaniesMock.mockReset();
  });

  it('routes reporting read-model construction through the shared legacy bridge', async () => {
    buildLegacyReportDataMock.mockReturnValue({
      range: { from: '2026-02-01', to: '2026-02-28' },
      rules: { id: 'legacy-kpi', name: 'Legacy KPI' },
      summary: { decls: 1, kpi: 1.2 },
      trend: { series: [], teamSeries: [], comparison: null, topTeams: [] },
      adjustments: { list: [], applied: [], totalsByCategory: {} },
      staff: {
        list: [
          {
            key: 'lan',
            name: 'Lan',
            teamLabel: 'Blue Team',
            teamNames: ['Blue Team'],
            stats: { decls: 1, kpi: 1.2 },
            rows: [{ so_tk: 'TK1' }],
          },
        ],
        keysHash: 'lan',
      },
      teams: {
        list: [
          {
            key: 'blue-team',
            name: 'Blue Team',
            memberNames: ['Lan'],
            members: [],
            stats: { decls: 1, kpi: 1.2 },
            rows: [{ so_tk: 'TK1' }],
          },
        ],
        keysHash: 'blue-team',
      },
    });
    aggregateLegacyCompaniesMock.mockImplementation((rows, options = {}) => [
      {
        marker: `${rows.length}:${options.includeStaff === true}:${options.includeTeam === true}`,
      },
    ]);

    const { buildReportingReadModels } = await import('../packages/backend-shared/src/reporting/reportingReadModels.js');

    const result = buildReportingReadModels(
      [{ so_tk: 'TK1' }],
      {
        roster: { version: 1, teams: [] },
        rules: { id: 'legacy-kpi', name: 'Legacy KPI' },
        from: '2026-02-01',
        to: '2026-02-28',
        adjustments: [{ id: 'adj-1' }],
        limit: 1,
      }
    );

    expect(buildLegacyReportDataMock).toHaveBeenCalledWith(
      [{ so_tk: 'TK1' }],
      expect.objectContaining({
        roster: { version: 1, teams: [] },
        rules: { id: 'legacy-kpi', name: 'Legacy KPI' },
        from: '2026-02-01',
        to: '2026-02-28',
        adjustments: [{ id: 'adj-1' }],
      })
    );
    expect(aggregateLegacyCompaniesMock).toHaveBeenCalledTimes(4);
    expect(result.summary.companies.staff).toEqual([{ marker: '1:true:false' }]);
    expect(result.summary.companies.teams).toEqual([{ marker: '1:true:true' }]);
    expect(result.staff.items[0].companies).toEqual([{ marker: '1:false:false' }]);
    expect(result.teams.items[0].companies).toEqual([{ marker: '1:true:false' }]);
  });

  it('routes monthly aggregate construction through the shared legacy bridge', async () => {
    buildLegacyReportDataMock.mockImplementation((rows, options = {}) => ({
      summary: { decls: rows.length, kpi: rows.length },
      staff: { list: [], keysHash: '' },
      teams: { list: [], keysHash: '' },
      range: { from: options.from || '', to: options.to || '' },
      rules: options.rules || { id: 'default', name: 'Default KPI' },
      trend: { series: [], teamSeries: [], comparison: null, topTeams: [] },
      adjustments: {},
    }));

    const { buildMonthlyReportingAggregates } = await import('../packages/backend-shared/src/reporting/reportingReadModels.js');

    const result = buildMonthlyReportingAggregates(
      [
        { date: '2026-02-15', so_tk: 'TK2' },
        { date: '2026-01-10', so_tk: 'TK1' },
      ],
      {
        roster: { version: 1, teams: [] },
        rules: { id: 'legacy-kpi', name: 'Legacy KPI' },
        adjustments: [],
        from: '2026-01-01',
        to: '2026-02-28',
      }
    );

    expect(buildLegacyReportDataMock).toHaveBeenCalledTimes(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual(expect.objectContaining({ period: '2026-02' }));
    expect(result.items[1]).toEqual(expect.objectContaining({ period: '2026-01' }));
  });
});
