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
    expect(mapped.licenses).toBe(0);
    expect(mapped.so_luong_gp).toBe(0);
  });

  it('counts eligible license types while respecting excluded codes', () => {
    const raw = {
      'Số tờ khai': 'TK01',
      'Ngày': '01/08/2024',
      'MST': '0123456789',
      'Công ty': 'Công ty TNHH A',
      'Loại hình': 'A11',
      'Mã giấy phép': 'GP01',
      'Số giấy phép': '001',
      'Mã giấy phép 1': 'ZN02',
      'Số giấy phép 1': '002',
      'Mã giấy phép 2': 'GP02',
      'Số giấy phép 2': '003',
      'Mã giấy phép 3': 'GP01',
      'Số giấy phép 3': '004',
    };

    const mapped = mapRow(raw, { autoAssignStaff: false, licenseExcludes: ['ZN02'] });

    expect(mapped.licenses).toBe(2); // GP01 + GP02 (ZN02 bị loại và GP01 không trùng tính)
    expect(mapped.so_luong_gp).toBe(2);
  });
});
