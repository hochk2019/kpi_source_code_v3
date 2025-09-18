import { describe, it, expect } from 'vitest';
import { buildReportData, computeQuickRange } from '@/lib/reports.js';
import { DEFAULT_RULES } from '@/lib/rules.js';

const sampleRoster = {
  version: 1,
  teams: [
    {
      id: 'team-1',
      name: 'Team 1',
      members: [
        { id: 'phuong', name: 'Phương' },
        { id: 'bao', name: 'Bảo' },
      ],
    },
    {
      id: 'team-2',
      name: 'Team 2',
      members: [
        { id: 'tuan', name: 'Tuấn' },
      ],
    },
  ],
};

describe('computeQuickRange', () => {
  it('tính khoảng thời gian chuẩn theo tháng', () => {
    const base = new Date('2024-08-15');
    const range = computeQuickRange('this_month', base);
    expect(range.from).toBe('2024-08-01');
    expect(range.to).toBe('2024-08-31');
  });
});

describe('buildReportData', () => {
  it('gom nhóm theo nhân viên và tổ đội, tôn trọng filter ngày', () => {
    const rows = [
      {
        date: '2024-08-01',
        so_tk: '10234567890',
        loai_hinh: 'E11',
        num_items: 12,
        licenses: 1,
        nhan_vien: 'Phương',
        team: 'Team 1',
        mst: '0101234567',
        cong_ty: 'Công ty A',
      },
      {
        date: '2024-08-03',
        so_tk: '30234567890',
        loai_hinh: 'B11',
        num_items: 18,
        licenses: 2,
        nhan_vien: 'Tuấn',
        team: 'Team 1',
        mst: '0201234567',
        cong_ty: 'Công ty B',
      },
      {
        date: '2024-07-10',
        so_tk: '10200000000',
        loai_hinh: 'E11',
        num_items: 5,
        licenses: 1,
        nhan_vien: 'Phương',
        team: 'Team 1',
      },
    ];

    const report = buildReportData(rows, {
      roster: sampleRoster,
      rules: DEFAULT_RULES,
      from: '2024-08-01',
      to: '2024-08-31',
    });

    expect(report.rows).toHaveLength(2);
    expect(report.summary.decls).toBe(2);
    expect(report.summary.import).toBe(1);
    expect(report.summary.export).toBe(1);
    expect(report.summary.items).toBe(12 + 18);
    expect(report.summary.licenses).toBe(3);
    expect(report.summary.kpi).toBeCloseTo(5.2, 1);
    expect(report.summary.companyCount).toBe(2);

    expect(report.staff.list[0].name).toBe('Tuấn');
    expect(report.staff.list[1].name).toBe('Phương');

    expect(report.teams.list[0].name).toBe('Team 2');
    const topMemberNames = report.teams.list[0].members.map((m) => m.name);
    expect(topMemberNames[0]).toBe('Tuấn');

    const staffPhuong = report.staff.byKey.get('phuong') || report.staff.byKey.get('__unassigned_staff__');
    expect(staffPhuong).toBeTruthy();
    expect(staffPhuong.stats.decls).toBe(1);
    expect(staffPhuong.stats.items).toBe(12);
    expect(staffPhuong.stats.kpi).toBeCloseTo(2.0, 1);

    const staffBao = report.staff.byKey.get('bao');
    expect(staffBao).toBeTruthy();
    expect(staffBao.stats.decls).toBe(0);

    const staffTuan = report.staff.byKey.get('tuan');
    expect(staffTuan).toBeTruthy();
    expect(staffTuan.teamLabel).toContain('Team 2');
    expect(staffTuan.stats.kpi).toBeCloseTo(3.2, 1);

    const team2 = report.teams.list.find((team) => team.name === 'Team 2');
    expect(team2).toBeTruthy();
    expect(team2.stats.decls).toBe(1);
    expect(team2.members.some((m) => m.name === 'Tuấn')).toBe(true);
  });

  it('sử dụng raw_date để sửa các ngày dạng month-first', () => {
    const rows = [
      {
        date: '2024-01-08',
        raw_date: '08/01/2024',
        so_tk: '10234567890',
        loai_hinh: 'E11',
        num_items: 10,
        licenses: 1,
        nhan_vien: 'Phương',
        team: 'Team 1',
        mst: '0101234567',
        cong_ty: 'Công ty A',
      },
      {
        date: '2024-13-08',
        raw_date: '08/13/2024',
        so_tk: '20234567890',
        loai_hinh: 'B11',
        num_items: 12,
        licenses: 0,
        nhan_vien: 'Tuấn',
        team: 'Team 2',
        mst: '0201234567',
        cong_ty: 'Công ty B',
      },
    ];

    const report = buildReportData(rows, {
      roster: sampleRoster,
      rules: DEFAULT_RULES,
      from: '2024-08-01',
      to: '2024-08-31',
    });

    expect(report.summary.decls).toBe(2);
    expect(report.summary.companyCount).toBe(2);
    expect(report.rows.some((row) => row.date === '2024-08-01')).toBe(true);
    expect(report.rows.some((row) => row.date === '2024-08-13')).toBe(true);
  });

  it('hiểu đúng khoảng dd/mm ngay cả khi dữ liệu có sẵn dạng yyyy-mm-dd', () => {
    const rows = [
      {
        date: '2024-08-05',
        raw_date: '05/08/2024',
        so_tk: '10234567890',
        loai_hinh: 'E11',
        num_items: 8,
        licenses: 1,
        nhan_vien: 'Phương',
        team: 'Team 1',
        mst: '0101234567',
        cong_ty: 'Công ty A',
      },
      {
        date: '2024-08-20',
        raw_date: '2024-08-20',
        so_tk: '20234567890',
        loai_hinh: 'B11',
        num_items: 4,
        licenses: 0,
        nhan_vien: 'Tuấn',
        team: 'Team 2',
        mst: '0201234567',
        cong_ty: 'Công ty B',
      },
    ];

    const report = buildReportData(rows, {
      roster: sampleRoster,
      rules: DEFAULT_RULES,
      from: '01/08/2024',
      to: '31/08/2024',
    });

    expect(report.summary.decls).toBe(2);
    expect(report.summary.companyCount).toBe(2);
    expect(report.range.from).toBe('2024-08-01');
    expect(report.range.to).toBe('2024-08-31');
  });
});
