import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildReportDataMock, buildReportingReadModelsMock } = vi.hoisted(() => ({
  buildReportDataMock: vi.fn(() => {
    throw new Error('buildReportData should not be called directly by reportExportPayloads');
  }),
  buildReportingReadModelsMock: vi.fn(),
}));

vi.mock('../src/lib/reports.js', () => ({
  buildReportData: buildReportDataMock,
}));

vi.mock('../packages/backend-shared/src/reporting/reportingReadModels.js', () => ({
  buildReportingReadModels: buildReportingReadModelsMock,
}));

import { buildCompactReportExportPayload } from '../packages/backend-shared/src/reporting/reportExportPayloads.js';

function createRuleSet(overrides = {}) {
  return {
    id: 'legacy-kpi',
    name: 'Legacy KPI',
    applyFrom: '2026-01-01',
    groups: {},
    ...overrides,
  };
}

describe('buildCompactReportExportPayload', () => {
  beforeEach(() => {
    buildReportDataMock.mockClear();
    buildReportingReadModelsMock.mockReset();
  });

  it('resolve staff export từ shared reporting read models', () => {
    const rows = [{ so_tk: 'TK-001', nhan_vien: 'Lan' }];
    const roster = { version: 1, teams: [{ id: 'ops', members: ['Lan'] }] };
    const rules = createRuleSet();
    const adjustments = [{ id: 'adj-1' }];
    const staffItem = {
      key: 'lan',
      name: 'Lan',
      teamLabel: 'OPS',
      rows,
      stats: { decls: 1, kpi: 12 },
      adjustmentSummary: { totalPoints: 0 },
    };

    buildReportingReadModelsMock.mockReturnValue({
      summary: {
        range: { from: '2026-02-01', to: '2026-02-28' },
        summary: { decls: 1, kpi: 12 },
      },
      staff: {
        items: [staffItem],
      },
      teams: {
        items: [],
      },
    });

    const result = buildCompactReportExportPayload(
      'staff',
      {
        source: 'reporting-v4',
        query: { from: '2026-02-01', to: '2026-02-28' },
        ruleId: 'legacy-kpi',
        staffKey: 'lan',
        columns: { items: true },
      },
      {
        rows,
        roster,
        rules,
        adjustments,
      }
    );

    expect(buildReportingReadModelsMock).toHaveBeenCalledWith(rows, {
      roster,
      rules,
      from: '2026-02-01',
      to: '2026-02-28',
      adjustments,
    });
    expect(buildReportDataMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      exportPayload: {
        staff: staffItem,
        range: { from: '2026-02-01', to: '2026-02-28' },
        rules,
        columns: { items: true },
      },
      auditPayload: {
        source: 'reporting-v4',
        query: { from: '2026-02-01', to: '2026-02-28' },
        ruleId: 'legacy-kpi',
        staffKey: 'lan',
        columns: { items: true },
      },
    });
  });

  it('resolve all-team export từ shared reporting read models', () => {
    const rows = [{ so_tk: 'TK-002', to_khai_xuat: 1 }];
    const rules = createRuleSet({ id: 'rule-2', name: 'Rule 2' });
    const teamItem = {
      key: 'ops',
      name: 'OPS',
      memberNames: ['Lan'],
      rows,
      stats: { decls: 1, kpi: 15 },
      adjustmentSummary: { totalPoints: 1 },
    };

    buildReportingReadModelsMock.mockReturnValue({
      summary: {
        range: { from: '2026-03-01', to: '2026-03-31' },
        summary: { decls: 5, kpi: 55 },
      },
      staff: {
        items: [],
      },
      teams: {
        items: [teamItem],
      },
    });

    const result = buildCompactReportExportPayload(
      'allTeam',
      {
        source: 'reporting-v4',
        query: { from: '2026-03-01', to: '2026-03-31' },
        ruleId: 'rule-2',
        columns: { licenses: true },
      },
      {
        rows,
        rules,
      }
    );

    expect(buildReportingReadModelsMock).toHaveBeenCalledWith(rows, {
      roster: { version: 1, teams: [] },
      rules,
      from: '2026-03-01',
      to: '2026-03-31',
      adjustments: [],
    });
    expect(buildReportDataMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      exportPayload: {
        teamList: [teamItem],
        summary: { decls: 5, kpi: 55 },
        range: { from: '2026-03-01', to: '2026-03-31' },
        rules,
        columns: { licenses: true },
      },
      auditPayload: {
        source: 'reporting-v4',
        query: { from: '2026-03-01', to: '2026-03-31' },
        ruleId: 'rule-2',
        columns: { licenses: true },
      },
    });
  });
});
