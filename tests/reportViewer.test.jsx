import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import ReportViewer from '@/components/ReportViewer.jsx';
import { DECL_KEY, RULES_KEY, KPI_ADJUSTMENTS_KEY } from '@/lib/store.js';
import { DEFAULT_RULES } from '@/lib/rules.js';
import { clearStorageCache, setItem as sharedSetItem } from '@/lib/storageClient.js';

// đảm bảo bộ nhớ dùng chung sạch trước mỗi test
beforeEach(() => {
  clearStorageCache();
});

describe('ReportViewer', () => {
  it('hiển thị dashboard tổng quan và dữ liệu nhân viên theo quy tắc hiện hành', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-15T00:00:00Z'));

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

    sharedSetItem(DECL_KEY, JSON.stringify(rows));
    sharedSetItem(RULES_KEY, JSON.stringify(rules));
    sharedSetItem(
      KPI_ADJUSTMENTS_KEY,
      JSON.stringify([
        {
          id: 'adj-test-1',
          category: 'support_fixed',
          month: '2024-08',
          staffName: 'Phương',
          teamName: 'Team 1',
          quantity: 1,
          unitPoints: 5,
          totalPoints: 5,
          status: 'approved',
          references: ['10234567890'],
          note: 'Hỗ trợ thông quan',
          createdAt: '2024-08-02T00:00:00Z',
          updatedAt: '2024-08-02T00:00:00Z',
          history: [],
        },
      ])
    );

    const html = renderToString(<ReportViewer />);

    expect(html).toContain('Rules tháng 8');
    expect(html).toContain('Áp dụng từ 2024-08-01');
    expect(html).toContain('Tổng tờ khai');
    expect(html).toContain('tờ khai hợp lệ');
    expect(html).toContain('Phương');
    expect(html).toContain('Team 1');
    expect(html).toContain('Điểm KPI +/- bổ sung');
    expect(html).toContain('Điểm đã áp dụng');
    expect(html).toContain('Xu hướng KPI 6 kỳ gần nhất');
    expect(html).toContain('So sánh KPI theo tổ đội');
    vi.useRealTimers();
  });
});
