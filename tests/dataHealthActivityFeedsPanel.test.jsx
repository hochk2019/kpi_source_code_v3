import React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DataHealthActivityFeedsPanel from '@/components/data-health-dashboard/DataHealthActivityFeedsPanel.jsx';

function createProps(overrides = {}) {
  return {
    sqlEvents: [
      {
        key: 'timeout-1',
        atLabel: '27/03/2026 10:15',
        message: 'Timeout khi gọi bridge SQL Server.',
        contextLabel: '{\n  "requestId": "req-01"\n}',
      },
    ],
    notifications: {
      countLabel: '2 sự kiện mới',
      entries: [
        {
          key: 'notify-1',
          containerClass: 'border-red-200 bg-red-50 text-red-700',
          typeLabel: 'sql_error',
          createdAtLabel: '27/03/2026 10:16',
          title: 'Lỗi bridge',
          message: 'Bridge trả lỗi ELOGIN khi đồng bộ.',
        },
        {
          key: 'notify-2',
          containerClass: 'border-slate-200 bg-slate-50 text-slate-700',
          typeLabel: 'info',
          createdAtLabel: '27/03/2026 10:17',
          title: '',
          message: 'Đã nhận cấu hình mới từ máy chủ.',
        },
      ],
    },
    ...overrides,
  };
}

describe('DataHealthActivityFeedsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị sự kiện SQL và thông báo real-time đã format sẵn', () => {
    render(<DataHealthActivityFeedsPanel {...createProps()} />);

    expect(screen.getByText('Sự kiện SQL Server gần đây')).toBeInTheDocument();
    expect(screen.getByText('Timeout khi gọi bridge SQL Server.')).toBeInTheDocument();
    expect(screen.getByText('27/03/2026 10:15')).toBeInTheDocument();
    expect(screen.getByText(/"requestId": "req-01"/i)).toBeInTheDocument();

    expect(screen.getByText('Thông báo real-time')).toBeInTheDocument();
    expect(screen.getByText('2 sự kiện mới')).toBeInTheDocument();
    expect(screen.getByText('Lỗi bridge')).toBeInTheDocument();
    expect(screen.getByText('Bridge trả lỗi ELOGIN khi đồng bộ.')).toBeInTheDocument();
    expect(screen.getByText('Đã nhận cấu hình mới từ máy chủ.')).toBeInTheDocument();
  });

  it('fallback đúng khi không có SQL timeout hoặc thông báo mới', () => {
    render(
      <DataHealthActivityFeedsPanel
        {...createProps({
          sqlEvents: [],
          notifications: {
            countLabel: '0 sự kiện mới',
            entries: [],
          },
        })}
      />
    );

    expect(screen.getByText('Không ghi nhận timeout trong thời gian gần đây.')).toBeInTheDocument();
    expect(screen.getByText('Chưa có thông báo mới.')).toBeInTheDocument();
  });
});
