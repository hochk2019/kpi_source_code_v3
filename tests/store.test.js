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
