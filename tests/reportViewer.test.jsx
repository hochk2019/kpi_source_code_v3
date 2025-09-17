import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import ReportViewer from '@/components/ReportViewer.jsx';
import { DECL_KEY, RULES_KEY } from '@/lib/store.js';
import { DEFAULT_RULES } from '@/lib/rules.js';

// đảm bảo dữ liệu localStorage sạch trước mỗi test
beforeEach(() => {
  localStorage.clear();
});

describe('ReportViewer', () => {
  it('hiển thị dashboard tổng quan và dữ liệu nhân viên theo quy tắc hiện hành', () => {
    const rows = [
      {
        date: '2024-08-01',
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
        date: '2024-08-05',
        so_tk: '30234567890',
        loai_hinh: 'B11',
        num_items: 15,
        licenses: 2,
        nhan_vien: 'Tuấn',
        team: 'Team 2',
        mst: '0201234567',
        cong_ty: 'Công ty B',
      },
    ];

    const rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    rules.name = 'Rules tháng 8';
    rules.applyFrom = '2024-08-01';

    localStorage.setItem(DECL_KEY, JSON.stringify(rows));
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));

    const html = renderToString(<ReportViewer />);

    expect(html).toContain('Rules tháng 8');
    expect(html).toContain('Áp dụng từ 2024-08-01');
    expect(html).toContain('Tổng tờ khai');
    expect(html).toContain('tờ khai hợp lệ');
    expect(html).toContain('Phương');
    expect(html).toContain('Team 1');
  });
});
