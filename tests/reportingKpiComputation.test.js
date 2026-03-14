import { describe, expect, it } from 'vitest';

import { computeKPI, DEFAULT_RULES } from '../shared/reportingKpiComputation.js';

describe('shared/reportingKpiComputation', () => {
  it('uses muc_hang when num_items is missing', () => {
    const row = { loaiHinh: 'A11', muc_hang: 25 };

    expect(computeKPI(row, DEFAULT_RULES)).toBe(5.2);
  });

  it('still honors explicit num_items when provided', () => {
    const row = { loaiHinh: 'A11', muc_hang: 25, num_items: 5 };

    expect(computeKPI(row, DEFAULT_RULES)).toBe(1.2);
  });

  it('adds license points and honors excluded agencies', () => {
    const row = {
      loaiHinh: 'E11',
      num_items: 3,
      licenseCodes: ['ZB02', 'ZB03', 'ZC01'],
      agency: 'G&B',
    };

    expect(computeKPI(row, DEFAULT_RULES)).toBe(0.8);
  });

  it('adds C/O points and line-count bonuses when enabled', () => {
    const row = {
      loaiHinh: 'E41',
      num_items: 1,
      has_co: true,
      co_line_count: 5,
    };

    expect(computeKPI(row, DEFAULT_RULES)).toBe(0.9);
  });
});
