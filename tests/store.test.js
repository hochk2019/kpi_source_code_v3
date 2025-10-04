import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveDeclRows,
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
  HQ_KEY,
  getHQAgencies,
  upsertHQAgencies
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
    const total = saveDeclRows(incoming, { overwrite: false });

    expect(total).toBe(2);
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
    const stored = upsertHQAgencies([
      { mst: '010-123-4567', company: '  Công ty A  ', agent: 'FCL' },
      { mst: '0101234567', company: 'Công ty A cập nhật', agent: '' },
    ], { actor: 'tester' });

    expect(stored).toEqual([
      { mst: '0101234567', company: 'Công ty A cập nhật', agent: 'FCL' },
    ]);

    const saved = JSON.parse(sharedGetItem(HQ_KEY) || '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].mst).toBe('0101234567');
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
      { mst: '0101234567', company: 'Công ty Golden', agent: 'FCL' },
    ]);

    const mstRows = getMSTMap();
    expect(mstRows[0].company).toBe('Công ty Golden');

    const decls = getDeclRows();
    expect(decls[0].agency).toBe('FCL');
    expect(decls[0].dai_ly).toBe('FCL');
    expect(decls[0].cong_ty).toBe('Công ty Golden');
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
