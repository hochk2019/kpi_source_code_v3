import { beforeEach, describe, it, expect } from 'vitest';
import { mapRow, detectDateOrder } from '@/lib/importer.js';
import { normalizeName } from '@/lib/store.js';
import { MST_KEY } from '@/lib/store.js';

beforeEach(() => {
  localStorage.clear();
});

describe('mapRow', () => {
  it('normalises fields and exposes aliases used by other modules', () => {
    const raw = {
      'Số TK': ' 1234567890123 ',
      'Nhánh': ' 01 ',
      'Ngay': '15/09/2024',
      'Mã số thuế': '0101234567',
      'Tên doanh nghiệp': '  ABC Corp  ',
      'Muc hang': '7',
      'Loai hinh': 'a11',
    };

    const mapped = mapRow(raw, { autoAssignStaff: false });

    expect(mapped.so_tk).toBe('1234567890123');
    expect(mapped.nhanh).toBe('01');
    expect(mapped.date).toBe('2024-09-15');
    expect(mapped.raw_date).toBe('15/09/2024');
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

  it('autoAssignStaff fills nhân viên và tổ đội dựa trên bảng MST hiện có', () => {
    localStorage.setItem(MST_KEY, JSON.stringify([
      {
        mst: '0101234567',
        person_import: 'Hạnh',
        person_export: 'Tuấn',
        team: 'Team 1',
        effective_from: '2024-01-01',
      },
    ]));

    const mapped = mapRow(
      {
        'Số tờ khai': 'TK01',
        'Ngày': '05/09/2024',
        'MST': '0101234567',
        'Loại hình': 'A11',
      },
      { autoAssignStaff: true }
    );

    expect(mapped.nhan_vien).toBe('Hạnh');
    expect(mapped.team).toBe('Team 1');
  });

  it('supports month-first files when requested', () => {
    const mapped = mapRow(
      {
        'Số tờ khai': 'TK02',
        'Ngày': '08/01/2024',
        'MST': '0999999999',
      },
      { autoAssignStaff: false, preferMonthFirst: true }
    );

    expect(mapped.date).toBe('2024-08-01');
    expect(mapped.raw_date).toBe('08/01/2024');
  });

  it('prefers roster team info over MST team when member map is provided', () => {
    localStorage.setItem(MST_KEY, JSON.stringify([
      {
        mst: '0101234567',
        person_import: 'Hạnh',
        person_export: '',
        team: 'Team 9',
        effective_from: '2024-01-01',
      },
    ]));

    const memberMap = new Map([
      [normalizeName('Hạnh'), { name: 'Hạnh', team: 'Team 1' }],
    ]);

    const mapped = mapRow(
      {
        'Số tờ khai': 'TK03',
        'Ngày': '01/09/2024',
        'MST': '0101234567',
        'Loại hình': 'A11',
      },
      { autoAssignStaff: true, memberMap }
    );

    expect(mapped.nhan_vien).toBe('Hạnh');
    expect(mapped.team).toBe('Team 1');
  });
});

describe('detectDateOrder', () => {
  it('detects month-first spreadsheets when days exceed 12', () => {
    const rows = [
      { 'Ngày': '08/01/2024' },
      { 'Ngày': '08/15/2024' },
    ];

    expect(detectDateOrder(rows)).toBe('mdy');
  });

  it('defaults to day-first when ambiguous', () => {
    const rows = [
      { 'Ngày': '15/09/2024' },
      { 'Ngày': '05/07/2024' },
    ];

    expect(detectDateOrder(rows)).toBe('dmy');
  });

  it('không chuyển sang month-first khi dữ liệu đã có dạng ISO yyyy-mm-dd', () => {
    const rows = [
      { 'Ngày': '01/08/2024' },
      { 'Ngày': '2024-08-31' },
      { 'Ngày': '15/08/2024' },
    ];

    expect(detectDateOrder(rows)).toBe('dmy');
  });
});
