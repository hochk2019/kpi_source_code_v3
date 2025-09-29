import { describe, it, expect } from 'vitest';
import { computeKPI, DEFAULT_RULES } from '@/lib/rules.js';

describe('computeKPI', () => {
  it('uses muc_hang when num_items is missing', () => {
    const row = { loaiHinh: 'A11', muc_hang: 25 };
    const point = computeKPI(row, DEFAULT_RULES);
    expect(point).toBe(5.2);
  });

  it('still honors explicit num_items when provided', () => {
    const row = { loaiHinh: 'A11', muc_hang: 25, num_items: 5 };
    const point = computeKPI(row, DEFAULT_RULES);
    // base 0.2 + 5 mục hàng × 0.2
    expect(point).toBe(1.2);
  });

  it('cộng điểm theo mã giấy phép và loại trừ theo đại lý', () => {
    const row = {
      loaiHinh: 'E11',
      num_items: 3,
      licenseCodes: ['ZB02', 'ZB03', 'ZC01'],
      agency: 'G&B',
    };
    const point = computeKPI(row, DEFAULT_RULES);
    // Nhóm 1: base 0.2 + 3 × 0.1 = 0.5
    // Licenses: ZB02 và ZB03 bị loại khi đại lý G&B, chỉ còn ZC01 → 0.3 điểm
    expect(point).toBe(0.8);
  });

  it('cộng điểm C/O khi được bật', () => {
    const row = {
      loaiHinh: 'E41',
      num_items: 1,
      licenseCodes: [],
      has_co: true,
    };
    const point = computeKPI(row, DEFAULT_RULES);
    // Nhóm 2: base 0.2 + 1 × 0.15 = 0.35, + C/O 0.3 → 0.65
    expect(point).toBe(0.7);
  });
});
