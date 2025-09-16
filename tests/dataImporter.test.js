import { describe, it, expect } from 'vitest';
import { mapRow } from '@/lib/importer.js';

describe('mapRow', () => {
  it('normalises fields and exposes aliases used by other modules', () => {
    const raw = {
      'Số TK': ' 1234567890123 ',
      'Nhánh': ' 01 ',
      'Ngay': '15/09/2024',
      'MST': '0101234567',
      'Công ty': '  ABC Corp  ',
      'Muc hang': '7',
      'Loai hinh': 'a11',
    };

    const mapped = mapRow(raw, { autoAssignStaff: false });

    expect(mapped.so_tk).toBe('1234567890123');
    expect(mapped.nhanh).toBe('01');
    expect(mapped.date).toBe('2024-09-15');
    expect(mapped.mst).toBe('0101234567');
    expect(mapped.cong_ty).toBe('ABC Corp');
    expect(mapped.customer).toBe('ABC Corp');
    expect(mapped.muc_hang).toBe(7);
    expect(mapped.num_items).toBe(7);
  });
});
