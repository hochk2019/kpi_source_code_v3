import { describe, it, expect, beforeEach } from 'vitest';
import { saveDeclRows, getDeclRows, sortDeclRows, getRecentDeclRows } from '@/lib/store.js';
beforeEach(() => {
  localStorage.clear();
});
import { describe, it, expect } from 'vitest';
import { saveDeclRows, getDeclRows } from '@/lib/store.js';

describe('saveDeclRows', () => {
  it('merges rows using so_tk + nhanh when overwrite=false', () => {
    const initial = [
      { so_tk: '12345678901', nhanh: 'A', date: '2024-09-15', loai_hinh: 'A11' },
    ];
    const incoming = [
      { so_tk: '12345678901', nhanh: 'A', date: '2024-09-16', loai_hinh: 'A12' },
      { so_tk: '99999999999', nhanh: '', date: '2024-09-17', loai_hinh: 'B11' },
    ];

    saveDeclRows(initial, { overwrite: true });
    const total = saveDeclRows(incoming, { overwrite: false });

    expect(total).toBe(2);
    expect(getDeclRows()).toEqual([
      { so_tk: '12345678901', nhanh: 'A', date: '2024-09-16', loai_hinh: 'A12' },
      { so_tk: '99999999999', nhanh: '', date: '2024-09-17', loai_hinh: 'B11' },
    ]);
  });
});

describe('sortDeclRows', () => {
  it('đưa các tờ khai mới nhất lên trước và fallback theo số tờ khai', () => {
    const rows = [
      { so_tk: '050', nhanh: 'B', date: '2024-01-05' },
      { so_tk: '200', nhanh: 'A', date: '2024-01-05' },
      { so_tk: '150', nhanh: 'C', date: '2024-01-10' },
      { so_tk: '999', nhanh: 'A', date: '' },
    ];

    const sorted = sortDeclRows(rows);
    expect(sorted.map(r => r.so_tk)).toEqual(['150', '200', '050', '999']);
  });
});

describe('getRecentDeclRows', () => {
  it('giới hạn số dòng mới nhất theo yêu cầu', () => {
    const rows = [
      { so_tk: 'TK01', nhanh: 'A', date: '2024-08-01' },
      { so_tk: 'TK02', nhanh: 'B', date: '2024-08-15' },
      { so_tk: 'TK03', nhanh: 'A', date: '2024-09-01' },
      { so_tk: 'TK04', nhanh: 'B', date: '2024-09-10' },
    ];

    saveDeclRows(rows, { overwrite: true });
    const latest = getRecentDeclRows(3);

    expect(latest).toHaveLength(3);
    expect(latest.map(r => r.so_tk)).toEqual(['TK04', 'TK03', 'TK02']);
  });
});
