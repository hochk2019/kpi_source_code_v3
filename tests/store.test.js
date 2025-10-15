import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveDeclRows,
  previewDeclRows,
  getDeclRows,
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
  getMSTFor,
  getMSTMap,
  MST_ASSIGNMENT_STATUS,
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
  UI_LAYOUT_KEY,
} from '@/lib/store.js';
import { clearStorageCache, getItem as sharedGetItem } from '@/lib/storageClient.js';
beforeEach(() => {
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
        licenseCodes: [],
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
  it('mặc định không ẩn cột nào khi chưa lưu cấu hình', () => {
    const config = getImportColumnConfig();
    expect(Array.isArray(config.hidden)).toBe(true);
    expect(config.hidden).toHaveLength(0);
  });

  it('lưu và chuẩn hóa danh sách cột bị ẩn', () => {
    const sample = [
      IMPORT_COLUMN_IDS[0],
      'khong_ton_tai',
      IMPORT_COLUMN_IDS[0],
      IMPORT_COLUMN_IDS[1],
    ];

    const result = saveImportColumnConfig({ hidden: sample }, { actor: 'admin' });
    expect(result.hidden.sort()).toEqual([IMPORT_COLUMN_IDS[0], IMPORT_COLUMN_IDS[1]].sort());

    const raw = sharedGetItem(UI_LAYOUT_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw || '{}');
    expect(parsed.importData.columns.hidden.sort()).toEqual([IMPORT_COLUMN_IDS[0], IMPORT_COLUMN_IDS[1]].sort());
  });

  it('không cho phép ẩn toàn bộ các cột hiển thị', () => {
    saveImportColumnConfig({ hidden: [IMPORT_COLUMN_IDS[0]] }, { actor: 'admin' });

    const attempt = saveImportColumnConfig({ hidden: [...IMPORT_COLUMN_IDS] }, { actor: 'admin' });
    expect(attempt.hidden.length).toBeLessThan(IMPORT_COLUMN_IDS.length);

    const raw = sharedGetItem(UI_LAYOUT_KEY);
    const parsed = JSON.parse(raw || '{}');
    expect(parsed.importData.columns.hidden.length).toBeLessThan(IMPORT_COLUMN_IDS.length);
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
