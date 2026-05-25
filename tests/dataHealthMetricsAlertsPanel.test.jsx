import React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DataHealthMetricsAlertsPanel from '@/components/data-health-dashboard/DataHealthMetricsAlertsPanel.jsx';

function createProps(overrides = {}) {
  return {
    metrics: [
      {
        label: 'Tổng tờ khai',
        value: 128,
        description: 'Đang lưu trong hệ thống',
        toneClass: 'bg-emerald-500/10 text-emerald-700 border border-emerald-400/60',
      },
      {
        label: 'Cảnh báo thiếu thông tin',
        value: 6,
        description: '18 tờ khai đang theo dõi',
        toneClass: 'bg-rose-500/10 text-rose-700 border border-rose-400/60',
      },
    ],
    duplicateSummary: {
      countLabel: '2 nhóm gần nhất',
      groups: [
        {
          key: 'dup-1',
          prefix: '03123456789',
          totalLabel: '3 bản ghi',
          branch: 'CN Ha Noi',
          keepLabel: 'TK-001 • Cập nhật: 27/03/2026 09:00',
          duplicates: [
            { key: 'd1', label: 'TK-002 • NV: An • Tổ: Team A • Cập nhật 27/03/2026 09:10' },
            { key: 'd2', label: 'TK-003 • NV: Binh • Tổ: Team B • Cập nhật 27/03/2026 09:20' },
          ],
          remainingLabel: '… 1 bản ghi khác',
        },
      ],
    },
    alertSummary: {
      lastEvaluatedAtLabel: '27/03/2026 09:30',
      entries: [
        {
          key: 'alert-1',
          soTkLabel: '102030',
          dateLabel: '27/03/2026',
          mstLabel: '0101234567',
          companyLabel: 'Cong ty A',
          missingLabel: 'MST, nhan vien',
          staffLabel: 'Chưa gán',
          teamLabel: 'Team X',
          lastAlertAtLabel: '27/03/2026 09:35',
        },
      ],
    },
    ...overrides,
  };
}

describe('DataHealthMetricsAlertsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị metrics cùng duplicate và alert cards đã format sẵn', () => {
    render(<DataHealthMetricsAlertsPanel {...createProps()} />);

    expect(screen.getByText('Tổng tờ khai')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('Cảnh báo thiếu thông tin')).toBeInTheDocument();

    expect(screen.getByText('Nhóm trùng 11 số cần xử lý')).toBeInTheDocument();
    expect(screen.getByText('2 nhóm gần nhất')).toBeInTheDocument();
    expect(screen.getByText('TK-002 • NV: An • Tổ: Team A • Cập nhật 27/03/2026 09:10')).toBeInTheDocument();
    expect(screen.getByText('… 1 bản ghi khác')).toBeInTheDocument();

    expect(screen.getByText('Cảnh báo cần xử lý')).toBeInTheDocument();
    expect(screen.getByText(/Đánh giá lần cuối: 27\/03\/2026 09:30/i)).toBeInTheDocument();
    expect(screen.getByText(/MST: 0101234567 • Công ty: Cong ty A/i)).toBeInTheDocument();
    expect(screen.getByText(/Thiếu: MST, nhan vien/i)).toBeInTheDocument();
  });

  it('fallback đúng khi không có duplicate group hoặc alert tồn đọng', () => {
    render(
      <DataHealthMetricsAlertsPanel
        {...createProps({
          duplicateSummary: {
            countLabel: '0 nhóm gần nhất',
            groups: [],
          },
          alertSummary: {
            lastEvaluatedAtLabel: 'Chưa có',
            entries: [],
          },
        })}
      />
    );

    expect(screen.getByText('Không phát hiện nhóm trùng nào.')).toBeInTheDocument();
    expect(screen.getByText('Không có cảnh báo tồn đọng.')).toBeInTheDocument();
    expect(screen.getByText(/Đánh giá lần cuối: Chưa có/i)).toBeInTheDocument();
  });
});
