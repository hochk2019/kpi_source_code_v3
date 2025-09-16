import { describe, it, expect } from 'vitest';
import { computeKPI, DEFAULT_RULES } from '@/lib/rules.js';

describe('computeKPI', () => {
  it('uses muc_hang when num_items is missing', () => {
    const row = { loaiHinh: 'A11', muc_hang: 25 };
    const point = computeKPI(row, DEFAULT_RULES);
    expect(point).toBe(2.5);
  });

  it('still honors explicit num_items when provided', () => {
    const row = { loaiHinh: 'A11', muc_hang: 25, num_items: 5 };
    const point = computeKPI(row, DEFAULT_RULES);
    // base 1.5 + no tier because items=5
    expect(point).toBe(1.5);
  });
});
