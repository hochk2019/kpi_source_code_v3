import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildMonthlyReportingAggregatesMock, buildReportingReadModelsMock } = vi.hoisted(() => ({
  buildMonthlyReportingAggregatesMock: vi.fn(),
  buildReportingReadModelsMock: vi.fn(),
}));

vi.mock('../../server-v4/src/modules/reporting/reportingAggregateBuilder.js', async () => {
  const actual = await vi.importActual('../../server-v4/src/modules/reporting/reportingAggregateBuilder.js');

  return {
    ...actual,
    buildMonthlyReportingAggregates: buildMonthlyReportingAggregatesMock,
  };
});

vi.mock('@kpi/backend-shared/reporting', async () => {
  const actual = await vi.importActual('@kpi/backend-shared/reporting');
  return {
    ...actual,
    buildReportingReadModels: buildReportingReadModelsMock,
  };
});

import { ReportingService } from '../../server-v4/src/modules/reporting/reportingService.ts';

describe('ReportingService route surface', () => {
  beforeEach(() => {
    buildMonthlyReportingAggregatesMock.mockReset();
    buildReportingReadModelsMock.mockReset();
    buildMonthlyReportingAggregatesMock.mockImplementation((_rows, options = {}) => ({
      range: {
        from: options.from || '',
        to: options.to || '',
      },
      ruleSet: {
        id: options.rules?.id || 'default',
        name: options.rules?.name || 'Default KPI',
      },
      generatedAt: '2026-03-14T10:00:00.000Z',
      cache: {
        queryKey: JSON.stringify({
          from: options.from || '',
          to: options.to || '',
          limit:
            Number.isFinite(options.limit) && Number(options.limit) > 0 ? Math.trunc(Number(options.limit)) : 0,
        }),
        reused: false,
      },
      total: 1,
      items: [
        {
          period: '2026-02',
          label: '02/2026',
          range: {
            from: '2026-02-01',
            to: '2026-02-28',
          },
          summary: {
            decls: 1,
            import: 0,
            export: 0,
            items: 1,
            licenses: 0,
            kpi: 1,
            co: 0,
            coLines: 0,
            companyCount: 0,
          },
          topTeams: [],
          topStaff: [],
        },
      ],
    }));
    buildReportingReadModelsMock.mockImplementation((_rows, options = {}) => {
      const ruleSet = {
        id: options.rules?.id || 'default',
        name: options.rules?.name || 'Default KPI',
      };
      const range = {
        from: options.from || '',
        to: options.to || '',
      };

      return {
        summary: {
          range,
          ruleSet,
          summary: {},
          trend: {
            series: [],
            teamSeries: [],
            comparison: null,
            topTeams: [],
          },
          adjustments: {
            list: [],
            applied: [],
            totalPoints: 0,
            pendingCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            appliedCount: 0,
            totalsByCategory: {},
          },
          companies: {
            staff: [],
            teams: [],
          },
        },
        staff: {
          range,
          ruleSet,
          total: 0,
          keysHash: '',
          items: [],
        },
        teams: {
          range,
          ruleSet,
          total: 0,
          keysHash: '',
          items: [],
        },
      };
    });
  });

  it('does not expose retired compatibility read helpers', async () => {
    const service = new ReportingService({});

    expect(typeof service.getView).toBe('function');
    expect(typeof service.getObservability).toBe('function');
    expect('getSummary' in service).toBe(false);
    expect('getStaff' in service).toBe(false);
    expect('getTeams' in service).toBe(false);
  });

  it('rebuilds active monthly aggregates when stored projection metadata is stale', async () => {
    const currentRuleSet = createRuleSet({
      updatedAt: '2026-03-14T00:00:00.000Z',
    });
    const repository = createRepository({
      readReportingSnapshot: vi.fn(async () =>
        createReportingSnapshot({
          declarations: [{ date: '2026-02-15', so_tk: 'TK1' }],
          activeRuleSet: currentRuleSet,
          ruleCollection: {
            activeId: currentRuleSet.id,
            sets: [currentRuleSet],
          },
        }),
      ),
      readRawMonthlyAggregateSnapshot: vi.fn(async () => ({
        generatedAt: '2026-03-13T09:00:00.000Z',
        range: {
          from: '2026-02-01',
          to: '2026-02-28',
        },
        ruleSet: {
          id: 'default',
          name: 'Default KPI',
        },
        cache: {
          queryKey: '{"from":"2026-02-01","to":"2026-02-28","limit":0}',
        },
        total: 1,
        items: [{ period: '2026-02' }],
        projectionState: {
          schemaVersion: 1,
          snapshotKey: 'kpi_reporting_monthly_aggregates_v1',
          refreshedAt: '2026-03-13T09:00:00.000Z',
          freshnessKey: '',
          owner: {
            ruleSetId: 'default',
            ruleUpdatedAt: '2026-03-01T00:00:00.000Z',
          },
        },
      })),
    });
    const service = new ReportingService(repository);

    const response = await service.getMonthlyAggregates({
      from: '2026-02-01',
      to: '2026-02-28',
    });

    expect(repository.writeRawMonthlyAggregateSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.writeRawMonthlyAggregateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        projectionState: expect.objectContaining({
          snapshotKey: 'kpi_reporting_monthly_aggregates_v1',
          owner: expect.objectContaining({
            ruleUpdatedAt: '2026-03-14T00:00:00.000Z',
          }),
        }),
      }),
    );
    expect(response.cache.reused).toBe(false);
    expect(repository.writeRawJobRuns).toHaveBeenCalledTimes(1);
  });

  it('builds the reporting view from the shared read-model bundle', async () => {
    const boostedRuleSet = createRuleSet({
      id: 'boosted-kpi',
      name: 'Boosted KPI',
    });
    const snapshot = createReportingSnapshot({
      declarations: [{ date: '2026-02-15', so_tk: 'TK1', nhan_vien: 'Lan' }],
      roster: {
        version: 2,
        teams: [{ id: 'blue-team', label: 'Blue Team', members: ['Lan'] }],
      },
      adjustments: [{ id: 'adj-1', status: 'approved', points: 2 }],
      activeRuleSet: createRuleSet(),
      ruleCollection: {
        activeId: 'default',
        sets: [createRuleSet(), boostedRuleSet],
      },
    });
    const repository = createRepository({
      readReportingSnapshot: vi.fn(async () => snapshot),
      readRawMonthlyAggregateSnapshot: vi.fn(async () => null),
    });
    buildReportingReadModelsMock.mockReturnValue({
      summary: {
        range: { from: '2026-02-01', to: '2026-02-28' },
        ruleSet: { id: 'boosted-kpi', name: 'Boosted KPI' },
        summary: { decls: 1, items: 2, kpi: 4 },
        trend: { series: [], teamSeries: [], comparison: null, topTeams: [] },
        adjustments: {
          list: [{ id: 'adj-1' }],
          applied: [{ id: 'adj-1' }],
          totalPoints: 2,
          pendingCount: 0,
          approvedCount: 1,
          rejectedCount: 0,
          appliedCount: 1,
          totalsByCategory: { support: { points: 2, quantity: 1 } },
        },
        companies: {
          staff: [{ name: 'Acme' }],
          teams: [{ name: 'Acme' }],
        },
      },
      staff: {
        range: { from: '2026-02-01', to: '2026-02-28' },
        ruleSet: { id: 'boosted-kpi', name: 'Boosted KPI' },
        total: 1,
        keysHash: 'staff-hash',
        items: [{ key: 'lan', name: 'Lan' }],
      },
      teams: {
        range: { from: '2026-02-01', to: '2026-02-28' },
        ruleSet: { id: 'boosted-kpi', name: 'Boosted KPI' },
        total: 1,
        keysHash: 'team-hash',
        items: [{ key: 'blue team', name: 'Blue Team' }],
      },
    });
    const service = new ReportingService(repository);

    const response = await service.getView({
      from: '2026-02-01',
      to: '2026-02-28',
      ruleId: 'boosted-kpi',
      limit: 1,
    });

    expect(repository.readReportingSnapshot).toHaveBeenCalledTimes(1);
    expect(buildReportingReadModelsMock).toHaveBeenCalledWith(snapshot.declarations, {
      roster: snapshot.roster,
      rules: boostedRuleSet,
      from: '2026-02-01',
      to: '2026-02-28',
      adjustments: snapshot.adjustments,
      limit: 1,
    });
    expect(response).toEqual({
      meta: {
        servedAt: expect.any(String),
        aggregateStatus: {
          available: false,
          generatedAt: '',
          queryKey: '',
          total: 0,
          range: {
            from: '',
            to: '',
          },
        },
      },
      summary: {
        range: { from: '2026-02-01', to: '2026-02-28' },
        ruleSet: { id: 'boosted-kpi', name: 'Boosted KPI' },
        summary: { decls: 1, items: 2, kpi: 4 },
        trend: { series: [], teamSeries: [], comparison: null, topTeams: [] },
        adjustments: {
          list: [{ id: 'adj-1' }],
          applied: [{ id: 'adj-1' }],
          totalPoints: 2,
          pendingCount: 0,
          approvedCount: 1,
          rejectedCount: 0,
          appliedCount: 1,
          totalsByCategory: { support: { points: 2, quantity: 1 } },
        },
        companies: {
          staff: [{ name: 'Acme' }],
          teams: [{ name: 'Acme' }],
        },
      },
      staff: {
        range: { from: '2026-02-01', to: '2026-02-28' },
        ruleSet: { id: 'boosted-kpi', name: 'Boosted KPI' },
        total: 1,
        keysHash: 'staff-hash',
        items: [{ key: 'lan', name: 'Lan' }],
      },
      teams: {
        range: { from: '2026-02-01', to: '2026-02-28' },
        ruleSet: { id: 'boosted-kpi', name: 'Boosted KPI' },
        total: 1,
        keysHash: 'team-hash',
        items: [{ key: 'blue team', name: 'Blue Team' }],
      },
    });
  });
});

function createRepository(overrides = {}) {
  return {
    readReportingSnapshot: vi.fn(async () => createReportingSnapshot()),
    readRawMonthlyAggregateSnapshot: vi.fn(async () => null),
    readRawDefaultMonthlyAggregateSnapshot: vi.fn(async () => null),
    writeRawMonthlyAggregateSnapshot: vi.fn(async () => undefined),
    writeRawDefaultMonthlyAggregateSnapshot: vi.fn(async () => undefined),
    readRawJobRuns: vi.fn(async () => []),
    writeRawJobRuns: vi.fn(async () => undefined),
    listScheduleEntries: vi.fn(async () => []),
    writeScheduleEntries: vi.fn(async () => undefined),
    readRelationalMonthlyAggregateEntries: vi.fn(async () => []),
    readRelationalJobRuns: vi.fn(async () => []),
    ...overrides,
  };
}

function createReportingSnapshot(overrides = {}) {
  const activeRuleSet = overrides.activeRuleSet || createRuleSet();
  return {
    declarations: [],
    roster: {
      version: 1,
      teams: [],
    },
    ruleCollection: overrides.ruleCollection || {
      activeId: activeRuleSet.id,
      sets: [activeRuleSet],
    },
    activeRuleSet,
    adjustments: [],
    ...overrides,
  };
}

function createRuleSet(overrides = {}) {
  return {
    id: 'default',
    name: 'Default KPI',
    description: 'Default rule set',
    applyFrom: '2026-01-01',
    updatedAt: '2026-03-01T00:00:00.000Z',
    groups: {},
    license: {
      bonus: 0,
      thresholds: {
        full: 0,
        partial: 0,
      },
    },
    bonuses: {
      financial: {
        export: 0,
        import: 0,
      },
      training: {
        points: 0,
        perLine: 0,
      },
    },
    ...overrides,
  };
}
