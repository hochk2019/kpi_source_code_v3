import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';

import {

  saveDeclRows,

  previewDeclRows,

  getDeclRows,

  DECL_KEY,

  hardDeleteDeclRows,

  softDeleteDeclRows,

  sortDeclRows,

  getRecentDeclRows,

  getTeamRoster,

  setTeamRoster,

  TEAM_KEY,

  mapMemberNamesToTeams,

  applyTeamRosterToMST,

  normalizeName,

  toISODate,

  upsertMSTRows,

  saveMSTRow,

  getMSTFor,

  getMSTMap,

  getMSTHistoryEntries,

  MST_ASSIGNMENT_STATUS,

  MST_KEY,

  AUDIT_KEY,

  getAuditLogs,

  DECL_DELETED_LOG_KEY,

  DECL_DELETED_LOG_LIMIT,

  getDeletedDeclLog,

  HQ_KEY,

  getHQAgencies,

  upsertHQAgencies,

  getHQHistoryEntries,

  HQ_HISTORY_KEY,

  unmarkDeclRowsReviewed,

  updateDeclRowFields,

  getDeclHistoryForRow,

  getImportColumnConfig,

  saveImportColumnConfig,

  IMPORT_COLUMN_IDS,

  IMPORT_SENSITIVE_COLUMNS,

  UI_LAYOUT_KEY,

  subscribeTeamRoster,

  getKpiAdjustmentSettings,

  saveKpiAdjustmentSettings,

  saveKpiAdjustment,

  getKpiAdjustments,

  KPI_ADJUSTMENT_SETTINGS_KEY,

  KPI_ADJUSTMENTS_KEY,

  getReportSchedules,

  saveReportSchedule,

  deleteReportSchedule,

  calculateNextReportScheduleRun,

  REPORT_SCHEDULE_KEY,

} from '@/lib/store.js';

import { clearStorageCache, getItem as sharedGetItem, setItem as sharedSetItem } from '@/lib/storageClient.js';

import * as auth from '@/auth/localAuth.js';



const defaultFetchImpl = (url, options = {}) => {

  if ((options.method || 'GET').toUpperCase() === 'GET') {

    const key = decodeURIComponent(String(url).split('/').pop() || '');

    const stored = sharedGetItem(key);

    return Promise.resolve({

      ok: true,

      json: () => Promise.resolve(stored != null ? { raw: stored } : { raw: null }),

    });

  }

  return Promise.resolve({ ok: true, json: async () => ({}) });

};



const fetchSpy = vi.spyOn(auth, 'fetchWithAuth').mockImplementation(defaultFetchImpl);



afterAll(() => {

  fetchSpy.mockRestore();

});



beforeEach(() => {

  fetchSpy.mockImplementation(defaultFetchImpl);

  clearStorageCache();

});



describe('toISODate', () => {

  it('parses day-first strings by default', () => {

    expect(toISODate('15/09/2024')).toBe('2024-09-15');

  });



  it('supports month-first parsing when requested', () => {

    expect(toISODate('08/01/2024', { preferMonthFirst: true })).toBe('2024-08-01');

  });



  it('normalises ISO strings with swapped month/day segments', () => {

    expect(toISODate('2024-31-08')).toBe('2024-08-31');

    expect(toISODate('2024-08-01T12:00:00')).toBe('2024-08-01');

  });

});



describe('report schedules', () => {

  it('calculates next run for weekly schedules from a reference date', () => {

    const reference = new Date('2024-09-02T07:00:00.000Z'); // Thứ hai

    const nextRunIso = calculateNextReportScheduleRun(

      {

        frequency: 'weekly',

        dayOfWeek: 3,

        time: '09:30',

      },

      { fromDate: reference }

    );

    expect(typeof nextRunIso).toBe('string');

    const runDate = new Date(nextRunIso || 0);

    expect(runDate.getTime()).toBeGreaterThan(reference.getTime());

    // Thứ tư (3) trong chuẩn 0=Chủ nhật.

    expect(runDate.getDay()).toBe(3);

    expect(runDate.getHours()).toBe(9);

    expect(runDate.getMinutes()).toBe(30);

  });



  it('tính đúng lịch chạy tháng khi ngày vượt quá cuối tháng', () => {

    const reference = new Date('2024-01-31T10:00:00.000Z');

    const nextRunIso = calculateNextReportScheduleRun(

      {

        frequency: 'monthly',

        dayOfMonth: 31,

        time: '06:45',

      },

      { fromDate: reference }

    );

    expect(typeof nextRunIso).toBe('string');

    const runDate = new Date(nextRunIso || 0);

    expect(runDate.getFullYear()).toBe(2024);

    expect(runDate.getMonth()).toBe(1); // Tháng 2 (0-index)

    expect(runDate.getDate()).toBe(29); // Năm nhuận

    expect(runDate.getHours()).toBe(6);

    expect(runDate.getMinutes()).toBe(45);

  });



  it('trả về null khi lịch bị tắt', () => {

    const result = calculateNextReportScheduleRun({

      frequency: 'weekly',

      dayOfWeek: 2,

      time: '08:00',

      active: false,

    });

    expect(result).toBeNull();



    const saved = saveReportSchedule({

      name: 'Tắt tạm thời',

      frequency: 'weekly',

      dayOfWeek: 2,

      time: '08:00',

      active: false,

      recipients: 'boss@example.com',

    });

    expect(saved.active).toBe(false);

    expect(saved.nextRun).toBe('');

  });



  it('saves and normalises schedule entries with recipients & formats', () => {

    const saved = saveReportSchedule({

      name: 'Báo cáo tuần',

      recipients: 'boss@example.com, support@example.com ',

      frequency: 'monthly',

      dayOfMonth: 5,

      time: '08:15',

      formats: ['excel', 'pdf', 'pdf'],

    });

    expect(saved.id).toBeTruthy();

    expect(saved.recipients).toEqual(['boss@example.com', 'support@example.com']);

    expect(saved.formats).toEqual(['excel', 'pdf']);

    expect(typeof saved.nextRun).toBe('string');



    const stored = getReportSchedules();

    expect(stored).toHaveLength(1);

    expect(stored[0].name).toBe('Báo cáo tuần');

    expect(sharedGetItem(REPORT_SCHEDULE_KEY)).toBeTruthy();

  });



  it('deletes schedule entries by id', () => {

    const entry = saveReportSchedule({

      name: 'Tạm thời',

      recipients: 'kpi@example.com',

      frequency: 'weekly',

      dayOfWeek: 1,

      time: '07:00',

    });

    expect(getReportSchedules()).toHaveLength(1);

    const removed = deleteReportSchedule(entry.id);

    expect(removed).toBe(true);

    expect(getReportSchedules()).toHaveLength(0);

  });

});



describe('legacy MST migration', () => {

  const LEGACY_MST_KEY = 'mst_rows_v1';



  beforeEach(() => {

    sharedSetItem(LEGACY_MST_KEY, null);

    sharedSetItem(MST_KEY, JSON.stringify([]));

    sharedSetItem(AUDIT_KEY, JSON.stringify([]));

  });



  it('migrates dữ liệu mst_rows_v1 và giữ nguyên dòng đã có', () => {

    sharedSetItem(

      LEGACY_MST_KEY,

      JSON.stringify({

        rows: [

          {

            mst: '0101234567',

            company: 'Công ty Alpha',

            nguoi_phu_trach_nhap: 'Ngọc Anh',

            nguoi_phu_trach_xuat: 'Bảo Bình',

            effective_from: '2024-01-05',

          },

          {

            mst: '0201234567',

            company: 'Công ty Beta',

            nguoiPhuTrachNhap: 'Trí',

            nguoiPhuTrachXuat: 'Minh',

            effective_from: '2024-02-01',

          },

        ],

      })

    );



    sharedSetItem(

      MST_KEY,

      JSON.stringify([

        {

          mst: '0201234567',

          company: 'Công ty Beta',

          person_import: 'Trí',

          person_export: 'Minh',

          team: 'Team Ocean',

          effective_from: '2024-02-01',

          effective_to: '',

          status: MST_ASSIGNMENT_STATUS.ASSIGNED,

        },

      ])

    );



    const rows = getMSTMap();

    expect(rows).toHaveLength(2);



    const migrated = rows.find((row) => row.mst === '0101234567');

    expect(migrated).toMatchObject({

      mst: '0101234567',

      company: 'Công ty Alpha',

      person_import: 'Ngọc Anh',

      person_export: 'Bảo Bình',

      team: '',

      effective_from: '2024-01-05',

      effective_to: '',

      status: MST_ASSIGNMENT_STATUS.ASSIGNED,

    });



    const existing = rows.find((row) => row.mst === '0201234567');

    expect(existing).toMatchObject({

      team: 'Team Ocean',

      status: MST_ASSIGNMENT_STATUS.ASSIGNED,

      effective_from: '2024-02-01',

      effective_to: '',

    });



    expect(sharedGetItem(LEGACY_MST_KEY)).toBeNull();



    const auditLogs = getAuditLogs(5);

    const migrationLog = auditLogs.find((entry) => entry.action === 'mst.migrate.v1-v2');

    expect(migrationLog).toBeTruthy();

    expect(migrationLog.detail).toContain('1/2');

    expect(migrationLog.meta).toMatchObject({

      legacyTotal: 2,

      converted: 2,

      added: 1,

      skippedDuplicate: 1,

    });

  });

});



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

    const summary = saveDeclRows(incoming, { overwrite: false });



    expect(summary.totalStored).toBe(2);

    expect(summary.inserted).toBe(1);

    expect(summary.updated).toBe(1);

    const stored = getDeclRows();

    expect(stored).toEqual([

      expect.objectContaining({

        so_tk: '12345678901',

        so_tk_full: '12345678901',

        so_tk_suffix: '',

        nhanh: 'A',

        date: '2024-09-16',

        loai_hinh: 'A12',

      }),

      expect.objectContaining({

        so_tk: '99999999999',

        so_tk_full: '99999999999',

        so_tk_suffix: '',

        nhanh: '',

        date: '2024-09-17',

        loai_hinh: 'B11',

      }),

    ]);

  });



  it('gi? nguyen t? khai khi ph?n nh�nh/du?i s? kh�c nhau', () => {

    const first = [

      { so_tk: '10756284616', so_tk_full: '107562846160', nhanh: '', date: '2025-09-05' },

    ];

    const second = [

      { so_tk: '10756284616', so_tk_full: '107562846161', nhanh: '', date: '2025-09-06' },

    ];



    saveDeclRows(first, { overwrite: true });

    const summary = saveDeclRows(second, { overwrite: false });



    expect(summary.totalStored).toBe(2);

    expect(summary.inserted).toBe(1);

    expect(summary.updated).toBe(0);

    const stored = getDeclRows();

    const fullNumbers = stored.map((row) => row.so_tk_full).sort();

    expect(fullNumbers).toEqual(['107562846160', '107562846161']);

  });



  it('replaces storage completely when overwrite=true, enabling deletions', () => {

    const baseline = [

      { so_tk: 'TK01', nhanh: 'A', date: '2024-08-01' },

      { so_tk: 'TK02', nhanh: 'B', date: '2024-08-02' },

      { so_tk: 'TK03', nhanh: 'C', date: '2024-08-03' },

    ];



    saveDeclRows(baseline, { overwrite: true });

    expect(getDeclRows()).toHaveLength(3);



    const remaining = baseline.slice(0, 2);

    saveDeclRows(remaining, { overwrite: true });



    const stored = getDeclRows();

    expect(stored).toHaveLength(2);

    expect(stored.find(r => r.so_tk === '00000000003')).toBeUndefined();

  });



  it('keeps reviewed rows unchanged when merging new data', () => {

    saveDeclRows([

      { so_tk: '30766075015', nhanh: '', date: '2025-08-11', loai_hinh: 'E42', reviewed: true },

    ], { overwrite: true });



    saveDeclRows([

      { so_tk: '30766075015', nhanh: '', date: '2025-08-12', loai_hinh: 'A11' },

    ]);



    const stored = getDeclRows();

    expect(stored).toHaveLength(1);

    expect(stored[0]).toMatchObject({ loai_hinh: 'E42', reviewed: true });

  });



  it('không cập nhật tờ khai đã rà soát khi thiếu quyền override', () => {

    saveDeclRows([

      {

        so_tk: '55555555555',

        nhanh: '',

        date: '2025-01-01',

        loai_hinh: 'A11',

        reviewed: true,

        reviewed_at: '2025-01-02T00:00:00Z',

      },

    ], { overwrite: true });



    const summary = saveDeclRows([

      {

        so_tk: '55555555555',

        nhanh: '',

        date: '2025-01-01',

        loai_hinh: 'B33',

      },

    ], { overwrite: false });



    expect(summary.locked).toBe(1);

    const stored = getDeclRows();

    expect(stored[0]).toMatchObject({ loai_hinh: 'A11' });

  });



  it('cho phép override tờ khai đã rà soát khi bật cờ allowReviewedOverride', () => {

    saveDeclRows([

      {

        so_tk: '66666666666',

        nhanh: '',

        date: '2025-02-01',

        loai_hinh: 'C12',

        reviewed: true,

        reviewed_at: '2025-02-02T00:00:00Z',

      },

    ], { overwrite: true });



    const summary = saveDeclRows([

      {

        so_tk: '66666666666',

        nhanh: '',

        date: '2025-02-01',

        loai_hinh: 'B33',

      },

    ], { overwrite: false, allowReviewedOverride: true });



    expect(summary.locked).toBe(0);

    const stored = getDeclRows();

    expect(stored[0]).toMatchObject({ loai_hinh: 'B33' });

  });



  it('keeps latest license count when merging duplicates', () => {

    const latest = [

      {

        so_tk: '10757755681',

        so_tk_full: '107577556811',

        nhanh: '',

        date: '2025-09-30',

        licenses: 1,

        licenseCodes: ['ZK02'],

      },

    ];

    const older = [

      {

        so_tk: '10757755681',

        so_tk_full: '107577556811',

        nhanh: '',

        date: '2025-09-15',

        licenses: 0,

      },

    ];



    saveDeclRows(latest, { overwrite: true });

    saveDeclRows(older, { overwrite: false });



    const stored = getDeclRows();

    expect(stored).toHaveLength(1);

    expect(stored[0]).toMatchObject({

      so_tk_full: '107577556811',

      licenses: 1,

      licenseCodes: ['ZK02'],

    });

  });



  it('làm mới số giấy phép hiển thị khi mã hợp lệ thay đổi', () => {

    const existing = [

      {

        so_tk: '00000000001',

        nhanh: '',

        date: '2025-01-01',

        licenseCodes: ['ZK01', 'ZK02'],

        licenseExcludedCodes: [],

        licenseManualCount: 2,

        licenses: 2,

        so_luong_gp: 2,

      },

    ];



    const incoming = [

      {

        so_tk: '00000000001',

        nhanh: '',

        date: '2025-01-01',

        licenseCodes: ['zk01', '  zk03  '],

        licenseExcludedCodes: ['zk03'],

      },

    ];



    saveDeclRows(existing, { overwrite: true });

    const summary = saveDeclRows(incoming, { overwrite: false });



    expect(summary.updated).toBe(1);

    const stored = getDeclRows();

    expect(stored).toHaveLength(1);

    expect(stored[0]).toMatchObject({

      licenseCodes: ['ZK01', 'ZK03'],

      licenseExcludedCodes: ['ZK03'],

      licenses: 1,

      so_luong_gp: 1,

    });

    expect(stored[0].licenseManualCount).toBeUndefined();

  });

  it('xoá danh sách mã GP loại trừ khi dữ liệu mới rỗng với replace=true', () => {

    const existing = [

      {

        so_tk: '00000000002',

        nhanh: '',

        date: '2025-01-02',

        licenseCodes: ['ZK01'],

        licenseExcludedCodes: ['ZK02'],

      },

    ];



    const incoming = [

      {

        so_tk: '00000000002',

        nhanh: '',

        date: '2025-01-02',

        licenseCodes: ['ZK01'],

        licenseExcludedCodes: [],

      },

    ];



    saveDeclRows(existing, { overwrite: true });

    const summary = saveDeclRows(incoming, { overwrite: false });



    expect(summary.updated).toBe(1);

    const stored = getDeclRows();

    expect(stored).toHaveLength(1);

    expect(stored[0].licenseExcludedCodes).toEqual([]);

  });

  it('hợp nhất licenseSourceCodes từ nhiều nguồn và chuẩn hóa', () => {
    const baseline = [
      {
        so_tk: '00000000003',
        nhanh: '',
        date: '2025-01-05',
        licenseCodes: ['ZK01'],
        licenseSourceCodes: ['zk01', ' gp01 '],
      },
    ];

    const incoming = [
      {
        so_tk: '00000000003',
        nhanh: '',
        date: '2025-01-05',
        licenseCodes: ['ZK01', ' zk02 ', 'zk03'],
        licenseSourceCodes: ['ZK02', 'gp01', 'Zk03', '', null],
        licenseExcludedCodes: ['  zk02  '],
      },
    ];

    saveDeclRows(baseline, { overwrite: true });
    const summary = saveDeclRows(incoming, { overwrite: false });

    expect(summary.updated).toBe(1);
    const stored = getDeclRows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      licenseCodes: ['ZK01', 'ZK02', 'ZK03'],
      licenseSourceCodes: ['ZK01', 'GP01', 'ZK02', 'ZK03'],
      licenseExcludedCodes: ['ZK02'],
      licenses: 2,
      so_luong_gp: 2,
    });
  });

  it('giữ nguyên số GP nhập tay khi hợp nhất thêm licenseSourceCodes', () => {
    const baseline = [
      {
        so_tk: '00000000004',
        nhanh: '',
        date: '2025-01-06',
        licenseCodes: ['ZK10'],
        licenseSourceCodes: ['zk10'],
        licenseManualCount: 5,
      },
    ];

    const incoming = [
      {
        so_tk: '00000000004',
        nhanh: '',
        date: '2025-01-06',
        licenseCodes: ['ZK10', 'Zk11'],
        licenseSourceCodes: ['zk10', 'zk11', 'ZK12'],
        licenseExcludedCodes: ['zk11'],
      },
    ];

    saveDeclRows(baseline, { overwrite: true });
    const summary = saveDeclRows(incoming, { overwrite: false });

    expect(summary.updated).toBe(1);
    const stored = getDeclRows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      licenseCodes: ['ZK10', 'ZK11'],
      licenseSourceCodes: ['ZK10', 'ZK11', 'ZK12'],
      licenseExcludedCodes: ['ZK11'],
      licenseManualCount: 5,
      licenses: 5,
      so_luong_gp: 5,
    });
  });

  it('áp dụng số GP nhập tay mới khi dữ liệu đến đáng tin cậy', () => {

    const baseline = [

      {

        so_tk: '00000000002',

        nhanh: '',

        date: '2025-01-02',

        licenseCodes: ['ZK05'],

        licenses: 1,

        so_luong_gp: 1,

      },

    ];



    const incoming = [

      {

        so_tk: '00000000002',

        nhanh: '',

        date: '2025-01-02',

        licenseCodes: ['ZK05'],

        licenseManualCount: 3,

      },

    ];



    saveDeclRows(baseline, { overwrite: true });

    const summary = saveDeclRows(incoming, { overwrite: false });



    expect(summary.updated).toBe(1);

    const stored = getDeclRows();

    expect(stored).toHaveLength(1);

    expect(stored[0]).toMatchObject({

      licenseCodes: ['ZK05'],

      licenseManualCount: 3,

      licenses: 3,

      so_luong_gp: 3,

    });

  });



  it('tự động thêm MST mới vào bảng gán với trạng thái mặc định', () => {

    expect(getMSTMap()).toHaveLength(0);



    saveDeclRows(

      [

        {

          so_tk: '00000000001',

          nhanh: '',

          date: '2024-09-15',

          mst: '0109990001',

          cong_ty: 'Công ty Demo',

        },

      ],

      { overwrite: true, actor: 'tester' }

    );



    const mstRows = getMSTMap();

    expect(mstRows).toHaveLength(1);

    expect(mstRows[0]).toMatchObject({

      mst: '0109990001',

      company: 'Công ty Demo',

      status: MST_ASSIGNMENT_STATUS.PENDING,

      person_import: '',

      person_export: '',

      team: '',

    });

    expect(mstRows[0].effective_from).toBe('2024-09-15');

  });



});





describe('saveMSTRow', () => {

  it('ghi nhận thay đổi khi cập nhật từng dòng', () => {

    upsertMSTRows(

      [

        {

          mst: '0101234567',

          company: 'ACME',

          person_import: 'Trần A',

          person_export: '',

          team: '',

          effective_from: '2024-09-01',

          status: MST_ASSIGNMENT_STATUS.PENDING,

        },

      ],

      { actor: 'seed' },

    );



    const originalKey = '0101234567__2024-09-01__';

    const result = saveMSTRow(

      {

        mst: '0101234567',

        company: 'ACME Logistics',

        person_import: 'Nguyễn Văn A',

        person_export: '',

        team: 'Team 1',

        effective_from: '2024-09-01',

        status: MST_ASSIGNMENT_STATUS.ASSIGNED,

      },

      { originalKey, actor: 'tester' },

    );



    expect(result.ok).toBe(true);

    expect(result.previousKey).toBe(originalKey);

    expect(result.key).toBe(originalKey);



    const map = getMSTMap();

    expect(map).toHaveLength(1);

    expect(map[0]).toMatchObject({

      company: 'ACME Logistics',

      person_import: 'Nguyễn Văn A',

      team: 'Team 1',

      status: MST_ASSIGNMENT_STATUS.ASSIGNED,

    });



    const history = getMSTHistoryEntries(5);

    expect(history.some((entry) => entry.field === 'person_import' && entry.to === 'Nguyễn Văn A')).toBe(true);



    const noChange = saveMSTRow(

      {

        mst: '0101234567',

        company: 'ACME Logistics',

        person_import: 'Nguyễn Văn A',

        person_export: '',

        team: 'Team 1',

        effective_from: '2024-09-01',

        status: MST_ASSIGNMENT_STATUS.ASSIGNED,

      },

      { originalKey, actor: 'tester' },

    );



    expect(noChange.ok).toBe(false);

    expect(noChange.reason).toBe('no-change');

  });



  it('thêm mới MST khi chưa tồn tại', () => {

    const result = saveMSTRow(

      {

        mst: '0200000000',

        company: 'Beta',

        person_import: '',

        person_export: '',

        team: '',

        effective_from: '2024-10-01',

        status: MST_ASSIGNMENT_STATUS.PENDING,

      },

      { actor: 'tester' },

    );



    expect(result.ok).toBe(true);

    const map = getMSTMap();

    expect(map.some((row) => row.mst === '0200000000')).toBe(true);

  });



  it('trả về conflict khi đổi sang khóa đã có', () => {

    upsertMSTRows(

      [

        {

          mst: '0101234567',

          company: 'ACME',

          person_import: '',

          person_export: '',

          team: '',

          effective_from: '2024-09-01',

          status: MST_ASSIGNMENT_STATUS.PENDING,

        },

        {

          mst: '0200000000',

          company: 'Beta',

          person_import: '',

          person_export: '',

          team: '',

          effective_from: '2024-10-01',

          status: MST_ASSIGNMENT_STATUS.PENDING,

        },

      ],

      { actor: 'seed' },

    );



    const conflict = saveMSTRow(

      {

        mst: '0200000000',

        company: 'ACME',

        person_import: '',

        person_export: '',

        team: '',

        effective_from: '2024-10-01',

        status: MST_ASSIGNMENT_STATUS.PENDING,

      },

      { originalKey: '0101234567__2024-09-01__', actor: 'tester' },

    );



    expect(conflict.ok).toBe(false);

    expect(conflict.reason).toBe('conflict');

  });

});





describe('updateDeclRowFields', () => {

  it('ghi nhận lịch sử chỉnh sửa khi cập nhật từng dòng', () => {

    saveDeclRows([

      { so_tk: '00000000001', nhanh: '', date: '2024-09-01', licenses: 1 },

    ], { overwrite: true });



    const result = updateDeclRowFields('00000000001_', {

      nhan_vien: 'Nguyễn Văn A',

      licenseManualCount: 2,

    }, { actor: 'tester' });



    expect(result.success).toBe(true);

    const history = getDeclHistoryForRow('00000000001_', 10);

    expect(history).toHaveLength(1);

    const entry = history[0];

    expect(entry.actor).toBe('tester');

    expect(entry.changes).toEqual(

      expect.arrayContaining([

        expect.objectContaining({ field: 'nhan_vien', before: '', after: 'Nguyễn Văn A' }),

        expect.objectContaining({ field: 'licenses', before: '1', after: '2' }),

      ])

    );

  });



  it('không thêm lịch sử khi không có thay đổi mới', () => {

    saveDeclRows([

      { so_tk: '00000000002', nhanh: '', date: '2024-09-02', nhan_vien: 'Lê Thị B', licenses: 0 },

    ], { overwrite: true });



    const firstUpdate = updateDeclRowFields('00000000002_', {

      nhan_vien: 'Lê Thị B',

    }, { actor: 'tester' });

    expect(firstUpdate.success).toBe(false);

    expect(firstUpdate.reason).toBe('no-change');



    const historyAfter = getDeclHistoryForRow('00000000002_', 10);

    expect(historyAfter).toHaveLength(0);

  });



  it('từ chối cập nhật tờ khai đã rà soát khi không override', () => {

    saveDeclRows([

      {

        so_tk: '00000000003',

        nhanh: '',

        date: '2024-09-03',

        loai_hinh: 'A11',

        reviewed: true,

        reviewed_at: '2024-09-04T00:00:00Z',

      },

    ], { overwrite: true, actor: 'seed' });



    const blocked = updateDeclRowFields('00000000003_', {

      loai_hinh: 'B11',

    }, { actor: 'tester' });

    expect(blocked.success).toBe(false);

    expect(blocked.reason).toBe('review-locked');



    const override = updateDeclRowFields('00000000003_', {

      loai_hinh: 'B11',

    }, { actor: 'admin', allowReviewedOverride: true });

    expect(override.success).toBe(true);

    expect(override.row?.loai_hinh).toBe('B11');

  });

});



describe('previewDeclRows', () => {

  it('tính toán số liệu thêm/cập nhật mà không ghi xuống storage', () => {

    const baseline = [

      { so_tk: 'TK001', nhanh: '', date: '2024-01-01', mst: '0101234567', company: 'ACME' },

    ];



    saveDeclRows(baseline, { overwrite: true });



    const preview = previewDeclRows(

      [

        { so_tk: 'TK001', nhanh: '', date: '2024-01-05', mst: '0101234567', company: 'ACME' },

        { so_tk: 'TK002', nhanh: '', date: '2024-01-06', mst: '0207654321', company: 'Beta' },

        { nhanh: '', date: '2024-01-07', mst: '0999999999', company: 'Thiếu số' },

      ],

      { overwrite: false, actor: 'tester' },

    );



    expect(preview.mode).toBe('merge');

    expect(preview.inserted).toBe(1);

    expect(preview.updated).toBe(1);

    expect(preview.invalid).toBe(1);

    expect(preview.errors[0].reason).toBe('missing-key');

    expect(preview.samples.inserted).toHaveLength(1);

    expect(preview.samples.errors).toHaveLength(1);



    const stored = getDeclRows();

    expect(stored).toHaveLength(1);

    expect(stored[0].date).toBe('2024-01-01');

  });



  it('chế độ overwrite trả về MST mới nhưng không ghi xuống map MST', () => {

    const preview = previewDeclRows(

      [

        { so_tk: 'TK010', nhanh: '', date: '2024-02-01', mst: '0123456789', company: 'Doanh nghiệp A' },

        { nhanh: '', date: '2024-02-02', mst: '0111111111', company: 'Thiếu số TK' },

      ],

      { overwrite: true, actor: 'tester' },

    );



    expect(preview.mode).toBe('overwrite');

    expect(preview.inserted).toBe(1);

    expect(preview.invalid).toBe(1);

    expect(preview.newBusinessCount).toBe(1);

    expect(preview.newBusinesses[0]).toMatchObject({ mst: '0123456789' });

    expect(getDeclRows()).toHaveLength(0);

    expect(getMSTMap()).toHaveLength(0);

  });

});





describe('import column config', () => {

  it('mặc định ẩn các cột nhạy cảm khi chưa lưu cấu hình', () => {

    const config = getImportColumnConfig();

    const expected = [...IMPORT_SENSITIVE_COLUMNS].sort();

    expect(Array.isArray(config.hidden)).toBe(true);

    expect(config.hidden.slice().sort()).toEqual(expected);

    expect(config.version).toBeGreaterThanOrEqual(2);

    expect(config.widths).toEqual({});

  });



  it('tự động bổ sung cột nhạy cảm cho cấu hình cũ không có version', () => {

    sharedSetItem(

      UI_LAYOUT_KEY,

      JSON.stringify({ importData: { columns: { hidden: [IMPORT_COLUMN_IDS[0]] } } })

    );



    const config = getImportColumnConfig();

    const expected = [...new Set([...IMPORT_SENSITIVE_COLUMNS, IMPORT_COLUMN_IDS[0]])].sort();

    expect(config.hidden.slice().sort()).toEqual(expected);

    expect(config.version).toBeGreaterThanOrEqual(2);

    expect(config.widths).toEqual({});

  });



  it('lưu và chuẩn hóa danh sách cột bị ẩn, chấp nhận cả thao tác phụ trợ', () => {

    const sample = [

      IMPORT_COLUMN_IDS[0],

      'khong_ton_tai',

      IMPORT_COLUMN_IDS[0],

      IMPORT_COLUMN_IDS[1],

      'history',

      'update',

      'status',

    ];



    const result = saveImportColumnConfig({ hidden: sample }, { actor: 'admin' });

    const expected = [...new Set([IMPORT_COLUMN_IDS[0], IMPORT_COLUMN_IDS[1], 'history', 'update', 'status'])].sort();

    expect(result.hidden.slice().sort()).toEqual(expected);

    expect(result.version).toBeGreaterThanOrEqual(2);

    expect(result.widths).toEqual({});



    const raw = sharedGetItem(UI_LAYOUT_KEY);

    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw || '{}');

    expect(parsed.importData.columns.hidden.slice().sort()).toEqual(expected);

    expect(parsed.importData.columns.version).toBeGreaterThanOrEqual(2);

    expect(parsed.importData.columns.widths).toEqual({});

  });

  it('ghi nhớ chiều rộng cột tuỳ chỉnh và loại bỏ dữ liệu không hợp lệ', () => {

    const result = saveImportColumnConfig(

      { widths: { date: 150.6, declaration: 60, khong_hop_le: 200 } },

      { actor: 'admin' }

    );

    expect(result.widths.date).toBe(151);

    expect(result.widths.declaration).toBeGreaterThanOrEqual(80);

    expect(result.widths.declaration).toBe(80);

    expect(result.widths.khong_hop_le).toBeUndefined();

    const persisted = getImportColumnConfig();

    expect(persisted.widths.date).toBe(151);

    expect(persisted.widths.declaration).toBe(80);

    expect(persisted.widths.khong_hop_le).toBeUndefined();

  });



  it('không cho phép ẩn toàn bộ các cột dữ liệu chính', () => {

    const attempt = saveImportColumnConfig({ hidden: [...IMPORT_COLUMN_IDS, 'history', 'update'] }, { actor: 'admin' });

    const attemptBaseHidden = attempt.hidden.filter((key) => IMPORT_COLUMN_IDS.includes(key));

    expect(attemptBaseHidden.length).toBeLessThan(IMPORT_COLUMN_IDS.length);



    const raw = sharedGetItem(UI_LAYOUT_KEY);

    const parsed = JSON.parse(raw || '{}');

    const hiddenBase = Array.isArray(parsed.importData?.columns?.hidden)

      ? parsed.importData.columns.hidden.filter((key) => IMPORT_COLUMN_IDS.includes(key))

      : [];

    expect(hiddenBase.length).toBeLessThan(IMPORT_COLUMN_IDS.length);

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

    expect(latest.map(r => r.so_tk)).toEqual(['00000000004', '00000000003', '00000000002']);

    expect(latest.map(r => r.so_tk_full)).toEqual(['TK04', 'TK03', 'TK02']);

  });

});



describe('hq agency helpers', () => {

  it('chuẩn hoá và gộp dữ liệu đại lý theo MST', () => {

    const storedCount = upsertHQAgencies([

      { mst: '010-123-4567', company: '  Công ty A  ', agent: 'FCL' },

      { mst: '0101234567', company: 'Công ty A cập nhật', agent: '' },

    ], { actor: 'tester' });



    expect(storedCount).toBe(1);



    const saved = JSON.parse(sharedGetItem(HQ_KEY) || '[]');

    expect(saved).toEqual([

      { mst: '0101234567', company: 'Công ty A cập nhật', agent: 'FCL', agents: ['FCL'] },

    ]);

  });



  it('đồng bộ tên công ty và đại lý vào MST cùng tờ khai', () => {

    upsertMSTRows([

      { mst: '0101234567', company: 'Tên cũ', person_import: '', person_export: '', team: '' },

    ], { actor: 'tester' });



    saveDeclRows([

      { so_tk: 'TK01', nhanh: '', date: '2024-09-10', mst: '0101234567', cong_ty: 'Tên cũ' },

    ], { overwrite: true, actor: 'tester' });



    upsertHQAgencies([

      { mst: '0101234567', company: 'Công ty Golden', agent: 'FCL' },

    ], { actor: 'tester' });



    const agencies = getHQAgencies();

    expect(agencies).toEqual([

      { mst: '0101234567', company: 'Công ty Golden', agent: 'FCL', agents: ['FCL'] },

    ]);



    const mstRows = getMSTMap();

    expect(mstRows[0].company).toBe('Công ty Golden');



    const decls = getDeclRows();

    expect(decls[0].agency).toBe('FCL');

    expect(decls[0].dai_ly).toBe('FCL');

    expect(decls[0].cong_ty).toBe('Công ty Golden');

  });



  it('ghi nhận lịch sử thao tác Đại lý HQ vào bộ nhớ chung', () => {

    clearStorageCache();

    upsertHQAgencies(

      [

        { mst: '0101234567', company: 'Công ty A', agent: 'FCL' },

      ],

      { actor: 'tester' }

    );



    const historyAfterCreate = getHQHistoryEntries();

    expect(historyAfterCreate.length).toBeGreaterThanOrEqual(1);

    expect(historyAfterCreate[0]).toMatchObject({

      mst: '0101234567',

      actor: 'tester',

    });



    const storedRaw = JSON.parse(sharedGetItem(HQ_HISTORY_KEY) || '[]');

    expect(Array.isArray(storedRaw)).toBe(true);

    expect(storedRaw[0]).toHaveProperty('timestamp');



    upsertHQAgencies([], { actor: 'tester' });

    const historyAfterDelete = getHQHistoryEntries();

    expect(historyAfterDelete[0].type).toBe('delete');

    expect(historyAfterDelete[0].mst).toBe('0101234567');

  });

});



describe('hardDeleteDeclRows', () => {

  const IMPORT_LOG_KEY = 'import_logs_v1';

  beforeEach(() => {

    clearStorageCache();

    sharedSetItem(AUDIT_KEY, JSON.stringify([]));

    sharedSetItem(IMPORT_LOG_KEY, JSON.stringify([]));

  });



  it('xóa vĩnh viễn tờ khai và ghi log cảnh báo', () => {

    const rows = [

      { so_tk: '00000001001', nhanh: '01', mst: '0100000001', cong_ty: 'Công ty Một' },

      { so_tk: '00000001002', nhanh: '01', mst: '0100000002', cong_ty: 'Công ty Hai' },

    ];

    sharedSetItem(DECL_KEY, JSON.stringify(rows));

    const result = hardDeleteDeclRows(['00000001001_01'], { actor: 'tester' });

    expect(result.removed).toBe(1);

    expect(result.missing).toBe(0);

    expect(result.keys).toEqual(['00000001001_01']);

    const stored = JSON.parse(sharedGetItem(DECL_KEY));

    expect(stored).toHaveLength(1);

    expect(stored[0].so_tk).toBe('00000001002');

    const auditLogs = JSON.parse(sharedGetItem(AUDIT_KEY));

    expect(auditLogs[0]).toMatchObject({ action: 'decl.delete.hard', actor: 'tester' });

    expect(auditLogs[0].meta).toMatchObject({ count: 1, keys: ['00000001001_01'] });

    const importLogs = JSON.parse(sharedGetItem(IMPORT_LOG_KEY));

    expect(importLogs[0]).toMatchObject({ kind: 'error', actor: 'tester' });

    expect(importLogs[0].meta).toMatchObject({ count: 1, keys: ['00000001001_01'] });

  });



  it('trả về missing khi tờ khai không tồn tại và giữ nguyên dữ liệu', () => {

    const rows = [

      { so_tk: '00000002001', nhanh: '01', mst: '0100000001' },

    ];

    sharedSetItem(DECL_KEY, JSON.stringify(rows));

    const result = hardDeleteDeclRows(['00000009999_00'], { actor: 'tester' });

    expect(result.removed).toBe(0);

    expect(result.missing).toBe(1);

    expect(result.keys).toHaveLength(0);

    const stored = JSON.parse(sharedGetItem(DECL_KEY));

    expect(stored).toHaveLength(1);

    expect(stored[0].so_tk).toBe('00000002001');

    const auditLogs = JSON.parse(sharedGetItem(AUDIT_KEY));

    expect(auditLogs).toHaveLength(0);

    const importLogs = JSON.parse(sharedGetItem(IMPORT_LOG_KEY));

    expect(importLogs).toHaveLength(0);

  });

});



describe('team roster helpers', () => {

  it('getTeamRoster trả về dữ liệu mặc định và seed bộ nhớ dùng chung', () => {

    expect(sharedGetItem(TEAM_KEY)).toBeNull();



    const roster = getTeamRoster();

    expect(roster.teams).toHaveLength(3);



    const stored = JSON.parse(sharedGetItem(TEAM_KEY));

    expect(Array.isArray(stored.teams)).toBe(true);

    expect(stored.teams.length).toBe(3);

  });



  it('setTeamRoster chuẩn hoá tên và sinh id cho thành viên mới', () => {

    const saved = setTeamRoster({

      teams: [

        {

          id: 'custom-team',

          name: '  Team X  ',

          members: [

            { id: '', name: '  Nguyễn  Văn  A  ' },

            { name: 'Nguyen Van B' },

          ],

        },

      ],

    });



    expect(saved.teams).toHaveLength(1);

    const team = saved.teams[0];

    expect(team.name).toBe('Team X');

    expect(team.id.startsWith('team-')).toBe(true);

    expect(team.members).toHaveLength(2);

    const firstMember = team.members.find(

      (member) => normalizeName(member.name) === normalizeName('Nguyễn Văn A')

    );

    const secondMember = team.members.find(

      (member) => normalizeName(member.name) === normalizeName('Nguyen Van B')

    );

    expect(firstMember?.name).toBe('Nguyễn Văn A');

    expect(firstMember?.id).toMatch(/^team-/);

    expect(secondMember?.id).toMatch(/^team-/);

    expect(secondMember?.id).not.toBe(firstMember?.id);

  });



  it('mapMemberNamesToTeams bỏ dấu và không phân biệt hoa/thường', () => {

    const roster = setTeamRoster({

      teams: [

        { name: 'Team 1', members: [{ name: 'Hòa' }] },

      ],

    });



    const mapping = mapMemberNamesToTeams(roster);

    const info = mapping.get(normalizeName('HOA'));

    expect(info?.team).toBe('Team 1');

    expect(info?.name).toBe('Hòa');

  });



  it('applyTeamRosterToMST đồng bộ tên team dựa vào thành viên phụ trách', () => {

    const roster = setTeamRoster({

      teams: [

        { name: 'Team 1', members: [{ name: 'Phương' }] },

        { name: 'Team 2', members: [{ name: 'Tuấn' }] },

      ],

    });



    const mstRows = [

      { mst: '111', company: 'Công ty A', person_import: 'Phương', person_export: '', team: 'Team 3' },

      { mst: '222', company: 'Công ty B', person_import: '', person_export: 'TUẤN', team: '' },

      { mst: '333', company: 'Công ty C', person_import: '', person_export: '', team: 'Team 1' },

    ];



    const { rows, changed } = applyTeamRosterToMST(roster, mstRows);

    expect(changed).toBe(true);



    const row111 = rows.find((row) => row.mst === '111');

    const row222 = rows.find((row) => row.mst === '222');

    const row333 = rows.find((row) => row.mst === '333');



    expect(row111?.team).toBe('Team 1');

    expect(row222?.team).toBe('Team 2');

    expect(row333?.team).toBe('Team 1');

  });



  it('applyTeamRosterToMST cập nhật lại tên thành viên khi đổi tên', () => {

    const baseRoster = setTeamRoster({

      teams: [

        {

          name: 'Team 1',

          members: [{ name: 'Phuong' }],

        },

      ],

    });



    const mstRows = [

      {

        mst: '555',

        company: 'Công ty X',

        person_import: 'Phuong',

        person_export: '',

        team: 'Team 1',

      },

    ];



    const renamedRoster = setTeamRoster({

      teams: baseRoster.teams.map((team) => ({

        ...team,

        members: team.members.map((member) =>

          normalizeName(member.name) === normalizeName('Phuong')

            ? { ...member, name: 'Phương Nguyễn' }

            : member

        ),

      })),

    });



    const { rows, changed } = applyTeamRosterToMST(renamedRoster, mstRows, {

      previousRoster: baseRoster,

    });



    expect(changed).toBe(true);

    expect(rows[0]).toMatchObject({

      person_import: 'Phương Nguyễn',

      team: 'Team 1',

    });

  });

});



describe('subscribeTeamRoster', () => {

  it('phát sự kiện khi danh sách tổ đội thay đổi', () => {

    const snapshots = [];

    const unsubscribe = subscribeTeamRoster((snapshot) => {

      snapshots.push(snapshot);

    });



    expect(snapshots.length).toBeGreaterThan(0);



    setTeamRoster({

      teams: [

        { name: 'Team QA', members: [{ name: 'Lan' }] },

      ],

    }, { actor: 'tester' });



    const latest = snapshots[snapshots.length - 1];

    expect(Array.isArray(latest.teams)).toBe(true);

    expect(latest.teams.some((team) => team.name === 'Team QA')).toBe(true);



    unsubscribe();

  });

});





describe('getMSTFor', () => {

  it('chọn dòng có ngày hiệu lực gần nhất nhưng không vượt quá ngày tờ khai', () => {

    upsertMSTRows(

      [

        {

          mst: '2301158516',

          company: 'Công ty A',

          person_import: 'Phương',

          person_export: '',

          team: 'Team 1',

          effective_from: '2024-07-01',

        },

        {

          mst: '2301158516',

          company: 'Công ty A',

          person_import: 'Phương',

          person_export: '',

          team: 'Team 1',

          effective_from: '2024-08-15',

        },

        {

          mst: '2301158516',

          company: 'Công ty A',

          person_import: 'Phương',

          person_export: '',

          team: 'Team 1',

          effective_from: '2024-09-05',

        },

      ],

      { actor: 'test' }

    );



    const picked = getMSTFor('2301158516', '2024-08-31');

    expect(picked?.effective_from).toBe('2024-08-15');

  });



  it('fallback về dòng đầu tiên khi ngày tờ khai trước mọi mốc hiệu lực', () => {

    upsertMSTRows(

      [

        {

          mst: '9999999999',

          company: 'Công ty B',

          person_import: 'Tuấn',

          person_export: '',

          team: 'Team 2',

          effective_from: '2024-05-01',

        },

        {

          mst: '9999999999',

          company: 'Công ty B',

          person_import: 'Tuấn',

          person_export: '',

          team: 'Team 2',

          effective_from: '2024-06-01',

        },

      ],

      { actor: 'test' }

    );



    const picked = getMSTFor('9999999999', '2024-04-15');

    expect(picked?.effective_from).toBe('2024-05-01');

  });

});



describe('unmarkDeclRowsReviewed', () => {

  it('removes reviewed flag and metadata for matched keys', () => {

    saveDeclRows([

      { so_tk: '99999999999', nhanh: '', date: '2025-09-01', reviewed: true, reviewed_at: '2025-09-02T00:00:00Z' },

    ], { overwrite: true });



    const updated = unmarkDeclRowsReviewed(['99999999999_']);

    expect(updated).toBe(1);

    const stored = getDeclRows();

    expect(stored[0].reviewed).toBeUndefined();

    expect(stored[0].reviewed_at).toBeUndefined();

  });

});



describe('kpi adjustment settings', () => {

  let fetchOverride;

  beforeEach(() => {

    fetchOverride = fetchSpy.mockImplementation((url) => {

      const key = decodeURIComponent(String(url).split('/').pop() || '');

      const stored = sharedGetItem(key);

      return Promise.resolve({

        ok: true,

        json: () => Promise.resolve(stored != null ? { raw: stored } : { raw: null }),

      });

    });

    sharedSetItem(KPI_ADJUSTMENT_SETTINGS_KEY, JSON.stringify({}));

    sharedSetItem(KPI_ADJUSTMENTS_KEY, JSON.stringify([]));

  });



  afterEach(() => {

    fetchSpy.mockImplementation(defaultFetchImpl);

    sharedSetItem(KPI_ADJUSTMENT_SETTINGS_KEY, JSON.stringify({}));

    sharedSetItem(KPI_ADJUSTMENTS_KEY, JSON.stringify([]));

  });



  it('chỉ cho phép quản lý cập nhật cấu hình mặc định', () => {

    expect(() =>

      saveKpiAdjustmentSettings(

        { categories: { support_misc: { defaultMode: 'dynamic' } } },

        { actor: 'tester', permissions: { adjustApprove: false } }

      )

    ).toThrow('Bạn không có quyền cấu hình điểm KPI bổ sung');

  });



  it('lưu và đọc cấu hình hybrid cùng điểm giấy phép tùy chỉnh', () => {

    const settings = saveKpiAdjustmentSettings(

      {

        categories: {

          support_misc: {

            defaultMode: 'dynamic',

            defaultUnit: '9.5',

            modeUnits: { fixed: '12', dynamic: '0.2' },

          },

          license_support: {

            defaultUnit: '1.2',

            licensePoints: { ZB03: '2.8', ZB99: '3.5' },

          },

        },

      },

      { actor: 'admin', permissions: { adjustApprove: true } }

    );



    expect(settings.categories.support_misc.defaultMode).toBe('dynamic');

    expect(settings.categories.support_misc.modeUnits.dynamic).toBe(0.2);

    expect(settings.categories.support_misc.modeUnits.fixed).toBe(12);

    expect(settings.categories.license_support.licensePoints.ZB03).toBe(2.8);

    expect(settings.categories.license_support.licensePoints.ZB99).toBe(3.5);



    const raw = JSON.parse(sharedGetItem(KPI_ADJUSTMENT_SETTINGS_KEY) || '{}');

    expect(raw.updatedBy).toBe('admin');

    expect(raw.categories.support_misc.defaultMode).toBe('dynamic');

  });



  it('áp dụng cấu hình mặc định khi tính điểm KPI bổ sung', () => {

    saveKpiAdjustmentSettings(

      {

        categories: {

          support_misc: {

            defaultMode: 'dynamic',

            modeUnits: { fixed: '12', dynamic: '0.2' },

          },

          license_support: {

            licensePoints: { ZB03: '2.8' },

          },

        },

      },

      { actor: 'admin', permissions: { adjustApprove: true } }

    );



    sharedSetItem(KPI_ADJUSTMENTS_KEY, JSON.stringify([]));



    const dynamicEntry = saveKpiAdjustment(

      {

        category: 'support_misc',

        month: '2025-01',

        staffName: 'An',

        quantity: 5,

        mode: 'dynamic',

      },

      { actor: 'admin', permissions: { adjustApprove: true } }

    );

    expect(dynamicEntry.unitPoints).toBe(0.2);

    expect(dynamicEntry.totalPoints).toBe(1);



    const fixedEntry = saveKpiAdjustment(

      {

        category: 'support_misc',

        month: '2025-01',

        staffName: 'Bình',

        mode: 'fixed',

      },

      { actor: 'admin', permissions: { adjustApprove: true } }

    );

    expect(fixedEntry.unitPoints).toBe(12);

    expect(fixedEntry.totalPoints).toBe(12);

    expect(fixedEntry.quantity).toBe(1);



    const licenseEntry = saveKpiAdjustment(

      {

        category: 'license_support',

        month: '2025-01',

        staffName: 'Chi',

        licenseCode: 'zb03',

        quantity: 2,

      },

      { actor: 'admin', permissions: { adjustApprove: true } }

    );

    expect(licenseEntry.unitPoints).toBe(2.8);

    expect(licenseEntry.totalPoints).toBe(5.6);



    const adjustments = getKpiAdjustments();

    expect(adjustments).toHaveLength(3);

    expect(adjustments[0].category).toBeDefined();

  });

  it('tính tổng điểm bao gồm điểm bổ sung cho hoàn thuế', () => {

    sharedSetItem(KPI_ADJUSTMENTS_KEY, JSON.stringify([]));

    const defaults = getKpiAdjustmentSettings();

    expect(defaults.categories.tax_refund_customer.extraUnitPoints).toBe(0.5);

    const entry = saveKpiAdjustment(

      {

        category: 'tax_refund_customer',

        month: '2025-03',

        staffName: 'Dũng',

        quantity: 3,

        extraQuantity: 2,

      },

      { actor: 'admin', permissions: { adjustApprove: true } }

    );

    expect(entry.unitPoints).toBe(2);

    expect(entry.extraUnitPoints).toBe(0.5);

    expect(entry.extraQuantity).toBe(2);

    expect(entry.totalPoints).toBe(7);

    const [stored] = getKpiAdjustments();

    expect(stored.totalPoints).toBe(7);

    expect(stored.extraUnitPoints).toBe(0.5);

  });

  it('chuẩn hoá điểm mỗi đơn vị theo quyền override', () => {

    saveKpiAdjustmentSettings(

      {

        categories: {

          license_support: { licensePoints: { ZB03: '2.8' } },

          support_misc: { modeUnits: { dynamic: '0.2', fixed: '12' } },

        },

      },

      { actor: 'admin', permissions: { adjustApprove: true } }

    );

    sharedSetItem(KPI_ADJUSTMENTS_KEY, JSON.stringify([]));

    const unauthorized = saveKpiAdjustment(

      {

        category: 'license_support',

        month: '2025-02',

        staffName: 'An',

        quantity: 3,

        licenseCode: 'zb03',

        unitPoints: 99,

        extraUnitPoints: 7,

      },

      { actor: 'staff', permissions: { adjustSubmit: true } }

    );

    expect(unauthorized.unitPoints).toBe(2.8);

    expect(unauthorized.totalPoints).toBeCloseTo(8.4, 5);

    expect(unauthorized.extraUnitPoints).toBeUndefined();

    const allowed = saveKpiAdjustment(

      {

        category: 'support_misc',

        month: '2025-02',

        staffName: 'Bình',

        mode: 'dynamic',

        quantity: 2,

        unitPoints: 1.5,

      },

      { actor: 'staff', permissions: { adjustSubmit: true } }

    );

    expect(allowed.unitPoints).toBe(1.5);

    expect(allowed.totalPoints).toBeCloseTo(3, 5);

  });

  it('bat/tat duyet tu dong cap nhat cau hinh', () => {

    const enabled = saveKpiAdjustmentSettings(

      { autoApprove: { enabled: true } },

      { actor: 'admin', permissions: { adjustApprove: true } },

    );

    expect(enabled.autoApprove.enabled).toBe(true);

    expect(enabled.autoApprove.updatedBy).toBe('admin');

    expect(new Date(enabled.autoApprove.updatedAt).getTime()).toBeGreaterThan(0);

    const raw = JSON.parse(sharedGetItem(KPI_ADJUSTMENT_SETTINGS_KEY) || '{}');

    expect(raw.autoApprove.enabled).toBe(true);

    const disabled = saveKpiAdjustmentSettings(

      { autoApprove: { enabled: false } },

      { actor: 'admin', permissions: { adjustApprove: true } },

    );

    expect(disabled.autoApprove.enabled).toBe(false);

    expect(disabled.autoApprove.updatedBy).toBe('admin');

  });

  it('tu dong duyet de xuat khi duyet tu dong dang bat', () => {

    saveKpiAdjustmentSettings(

      { autoApprove: { enabled: true } },

      { actor: 'admin', permissions: { adjustApprove: true } },

    );

    sharedSetItem(KPI_ADJUSTMENTS_KEY, JSON.stringify([]));

    const entry = saveKpiAdjustment(

      {

        category: 'support_misc',

        month: '2025-04',

        staffName: 'Nhan vien A',

        quantity: 1,

      },

      { actor: 'staff', permissions: { adjustSubmit: true } },

    );

    expect(entry.status).toBe('approved');

    expect(entry.approvedBy).toBe('admin');

    expect(new Date(entry.approvedAt).getTime()).toBeGreaterThan(0);

    const [stored] = getKpiAdjustments();

    expect(stored.status).toBe('approved');

    const statusHistory = stored.history?.map((item) => item.action) || [];

    expect(statusHistory).toContain('status.approved');

  });

  it('khong cho phep tao diem KPI khi khong co quyen', () => {

    sharedSetItem(KPI_ADJUSTMENTS_KEY, JSON.stringify([]));

    expect(() =>

      saveKpiAdjustment(

        {

          category: 'support_fixed',

          month: '2025-03',

          staffName: 'Guest',

          quantity: 1,

          unitPoints: 1,

        },

        { actor: 'guest', permissions: { adjustSubmit: false, adjustApprove: false } },

      ),

    ).toThrow('Ban khong co quyen tao diem KPI bo sung');

  });

});


describe('deleted declaration log', () => {
  afterEach(() => {
    sharedSetItem(DECL_KEY, JSON.stringify([]));
    sharedSetItem(DECL_DELETED_LOG_KEY, JSON.stringify([]));
  });

  it('ghi nhật ký khi xóa mềm và xóa cứng', () => {
    saveDeclRows(
      [
        { so_tk: '10000000001', nhanh: '01', mst: '0100100010', ten_dn: 'Công ty Ánh Dương' },
        { so_tk: '10000000002', nhanh: '02', mst: '0100100020', ten_dn: 'Công ty Bình Minh' },
      ],
      { overwrite: true },
    );

    const softResult = softDeleteDeclRows(['10000000001_01'], { actor: 'thu.ky' });
    expect(softResult.deleted).toBe(1);

    const softLog = getDeletedDeclLog();
    expect(softLog).toHaveLength(1);
    expect(softLog[0]).toMatchObject({
      so_tk: '10000000001',
      type: 'soft',
      deleted_by: 'thu.ky',
      nhanh: '01',
      mst: '0100100010',
      company: 'Công ty Ánh Dương',
    });

    const hardResult = hardDeleteDeclRows(['10000000002_02'], { actor: 'quan.ly' });
    expect(hardResult.removed).toBe(1);

    const hardLog = getDeletedDeclLog({ type: 'hard' });
    expect(hardLog).toHaveLength(1);
    expect(hardLog[0]).toMatchObject({
      so_tk: '10000000002',
      type: 'hard',
      deleted_by: 'quan.ly',
    });
  });

  it('giới hạn số bản ghi và giữ bản mới nhất ở đầu', () => {
    const limit = DECL_DELETED_LOG_LIMIT;
    const existing = Array.from({ length: limit }, (_, index) => ({
      so_tk: String(index + 1).padStart(11, '0'),
      nhanh: '00',
      mst: `MST-${index + 1}`,
      company: `Doanh nghiệp ${index + 1}`,
      type: index % 2 === 0 ? 'soft' : 'hard',
      deleted_at: `2024-05-${String((index % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
      deleted_by: 'system',
    }));

    sharedSetItem(DECL_DELETED_LOG_KEY, JSON.stringify(existing));

    saveDeclRows(
      [{ so_tk: '90000000001', nhanh: '01', mst: '0999999999', ten_dn: 'Công ty Giới Hạn' }],
      { overwrite: true },
    );

    softDeleteDeclRows(['90000000001_01'], { actor: 'tester' });

    const stored = JSON.parse(sharedGetItem(DECL_DELETED_LOG_KEY) || '[]');
    expect(stored).toHaveLength(limit);
    expect(stored[0].so_tk).toBe('90000000001');

    const droppedSoTk = String(limit).padStart(11, '0');
    expect(stored.some((entry) => entry.so_tk === droppedSoTk)).toBe(false);
  });

  it('lọc theo khoảng thời gian và loại xóa', () => {
    sharedSetItem(
      DECL_DELETED_LOG_KEY,
      JSON.stringify([
        {
          so_tk: '10000000010',
          nhanh: '01',
          mst: '0101',
          company: 'Doanh nghiệp A',
          type: 'soft',
          deleted_at: '2024-05-10T09:00:00.000Z',
          deleted_by: 'alpha',
        },
        {
          so_tk: '10000000011',
          nhanh: '02',
          mst: '0102',
          company: 'Doanh nghiệp B',
          type: 'hard',
          deleted_at: '2024-06-05T10:15:00.000Z',
          deleted_by: 'beta',
        },
        {
          so_tk: '10000000012',
          nhanh: '03',
          mst: '0103',
          company: 'Doanh nghiệp C',
          type: 'hard',
          deleted_at: '2024-07-01T11:00:00.000Z',
          deleted_by: 'beta',
        },
      ]),
    );

    const hardJune = getDeletedDeclLog({ from: '2024-06-01', to: '2024-06-30', type: 'hard' });
    expect(hardJune).toHaveLength(1);
    expect(hardJune[0].so_tk).toBe('10000000011');

    const softOnly = getDeletedDeclLog({ type: 'soft' });
    expect(softOnly).toHaveLength(1);
    expect(softOnly[0].so_tk).toBe('10000000010');
  });
});

