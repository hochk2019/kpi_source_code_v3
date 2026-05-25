import { beforeEach, describe, expect, it, vi } from 'vitest';

const sharedMocks = vi.hoisted(() => ({
  QUICK_RANGE_OPTIONS: [{ value: 'this_month', label: 'Thang nay' }],
  aggregateByCompanyMock: vi.fn(),
  buildReportDataMock: vi.fn(),
  computeQuickRangeMock: vi.fn(),
}));

vi.mock('../shared/reportingCompanyAggregation.js', () => ({
  aggregateByCompany: sharedMocks.aggregateByCompanyMock,
}));

vi.mock('../shared/reportingDateRanges.js', () => ({
  QUICK_RANGE_OPTIONS: sharedMocks.QUICK_RANGE_OPTIONS,
  computeQuickRange: sharedMocks.computeQuickRangeMock,
}));

vi.mock('../shared/reportingLegacyMath.js', () => ({
  buildReportData: sharedMocks.buildReportDataMock,
}));

describe('src/lib/reports shared wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('re-exports reporting helpers from the shared reporting modules', async () => {
    const reports = await import('../src/lib/reports.js');

    expect(reports.QUICK_RANGE_OPTIONS).toBe(sharedMocks.QUICK_RANGE_OPTIONS);
    expect(reports.computeQuickRange).toBe(sharedMocks.computeQuickRangeMock);
    expect(reports.buildReportData).toBe(sharedMocks.buildReportDataMock);
    expect(reports.aggregateByCompany).toBe(sharedMocks.aggregateByCompanyMock);
    expect(reports.default).toEqual({
      QUICK_RANGE_OPTIONS: sharedMocks.QUICK_RANGE_OPTIONS,
      computeQuickRange: sharedMocks.computeQuickRangeMock,
      buildReportData: sharedMocks.buildReportDataMock,
      aggregateByCompany: sharedMocks.aggregateByCompanyMock,
    });
  });
});
