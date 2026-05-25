import React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DataHealthInfrastructureStatusPanel from '@/components/data-health-dashboard/DataHealthInfrastructureStatusPanel.jsx';

function createProps(overrides = {}) {
  return {
    alerts: [
      {
        key: 'disk-warning',
        containerClass: 'border-amber-200 bg-amber-50 text-amber-800',
        dotClass: 'bg-amber-500',
        severityLabel: 'Cảnh báo',
        message: 'Dung lượng ổ đĩa hệ thống sắp chạm ngưỡng cảnh báo.',
      },
      {
        key: 'sql-critical',
        containerClass: 'border-red-200 bg-red-50 text-red-700',
        dotClass: 'bg-red-500',
        severityLabel: 'Nguy cấp',
        message: 'SQL Server đang trả lỗi kết nối liên tục.',
      },
    ],
    sync: {
      containerClass: 'border-sky-200 bg-sky-50 text-sky-700',
      dotClass: 'bg-sky-500',
      overview: 'Đồng bộ ECUS vẫn hoạt động nhưng độ trễ đang tăng.',
      lastRunLabel: '27/03/2026 10:30',
      relative: '5 phút trước',
      statusText: 'warning',
      operatorName: 'Nguyen Van A',
    },
    ...overrides,
  };
}

describe('DataHealthInfrastructureStatusPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị cảnh báo hạ tầng và banner sync với dữ liệu đã format', () => {
    render(<DataHealthInfrastructureStatusPanel {...createProps()} />);

    expect(screen.getByText('Dung lượng ổ đĩa hệ thống sắp chạm ngưỡng cảnh báo.')).toBeInTheDocument();
    expect(screen.getByText('SQL Server đang trả lỗi kết nối liên tục.')).toBeInTheDocument();
    expect(screen.getAllByText('Cảnh báo').length).toBeGreaterThan(0);
    expect(screen.getByText('Nguy cấp')).toBeInTheDocument();

    expect(screen.getByText('Trạng thái kết nối ECUS')).toBeInTheDocument();
    expect(screen.getByText('Đồng bộ ECUS vẫn hoạt động nhưng độ trễ đang tăng.')).toBeInTheDocument();
    expect(screen.getByText(/Lần chạy gần nhất: 27\/03\/2026 10:30/i)).toBeInTheDocument();
    expect(screen.getByText('5 phút trước')).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái: warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Người trực: Nguyen Van A/i)).toBeInTheDocument();
  });

  it('fallback đúng khi không có cảnh báo hạ tầng và không có người trực', () => {
    render(
      <DataHealthInfrastructureStatusPanel
        {...createProps({
          alerts: [],
          sync: {
            containerClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            dotClass: 'bg-emerald-500',
            overview: 'Kết nối ECUS ổn định.',
            lastRunLabel: 'Chưa có',
            relative: 'Không xác định',
            statusText: 'healthy',
            operatorName: '',
          },
        })}
      />
    );

    expect(screen.queryByText('Dung lượng ổ đĩa hệ thống sắp chạm ngưỡng cảnh báo.')).not.toBeInTheDocument();
    expect(screen.getByText('Kết nối ECUS ổn định.')).toBeInTheDocument();
    expect(screen.queryByText(/Người trực:/i)).not.toBeInTheDocument();
  });
});
