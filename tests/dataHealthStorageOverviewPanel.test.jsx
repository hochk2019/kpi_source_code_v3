import React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DataHealthStorageOverviewPanel from '@/components/data-health-dashboard/DataHealthStorageOverviewPanel.jsx';

function createProps(overrides = {}) {
  return {
    backup: {
      badgeClass: 'bg-amber-100 text-amber-700',
      severityLabel: 'Cảnh báo',
      lastSuccessAtLabel: '09:00 27/03/2026',
      relativeLabel: '2 giờ trước',
      directory: 'D:/backups',
      fileLabel: 'backup-2026-03-27.zip',
      nextRunLabel: '22:00 hôm nay',
      lastFailureAtLabel: '07:00 27/03/2026',
      lastFailureReason: 'Thiếu quyền ghi',
      scheduleReasons: ['Lịch sao lưu bị lệch do bảo trì'],
      recentEntries: [
        {
          id: 'success-1',
          statusLabel: 'Thành công',
          toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
          timestampLabel: '09:00 27/03/2026',
          detail: 'Hoàn tất snapshot định kỳ',
          reasonLabel: 'Lịch thường kỳ',
        },
      ],
    },
    database: {
      badgeClass: 'bg-amber-100 text-amber-700',
      severityLabel: 'Cảnh báo',
      file: 'C:/data/app.db',
      sizeLabel: '512 MB',
      updatedAtLabel: '09:05 27/03/2026',
      sqliteStatsAvailable: true,
      sqliteUsedPages: 120,
      sqliteTotalPages: 160,
      sqliteUsedPercentLabel: '75%',
      sqliteFreePages: 40,
      sqliteFreePercentLabel: '25%',
      sqliteHasFreeBytes: true,
      sqliteFreeLabel: '128 MB',
      sqlitePageSizeLabel: '4 KB',
      sqliteUsedLabel: '384 MB',
      isMemoryDb: false,
      sqliteStatsError: '',
      diskUsedLabel: '700 GB',
      diskUsedPercentLabel: '70%',
      diskUsedPercentWidth: 70,
      diskFreeLabel: '300 GB',
      diskTotalLabel: '1 TB',
      methodLabel: 'PowerShell',
      warningMessage: 'Dung lượng trống đang thấp hơn ngưỡng khuyến nghị.',
    },
    sql: {
      badgeClass: 'bg-red-100 text-red-700',
      severityLabel: 'Nguy cấp',
      title: 'Mất kết nối SQL Server',
      message: 'Bridge đang trả lỗi xác thực.',
      checkedAtLabel: '09:10 27/03/2026',
      code: 'ELOGIN',
      number: 18456,
    },
    ...overrides,
  };
}

describe('DataHealthStorageOverviewPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị đủ ba card storage overview với dữ liệu đã format', () => {
    render(<DataHealthStorageOverviewPanel {...createProps()} />);

    expect(screen.getByText('Trạng thái sao lưu CSDL')).toBeInTheDocument();
    expect(screen.getByText('D:/backups')).toBeInTheDocument();
    expect(screen.getByText(/Thiếu quyền ghi/i)).toBeInTheDocument();
    expect(screen.getByText('Hoàn tất snapshot định kỳ')).toBeInTheDocument();

    expect(screen.getByText('Dung lượng hệ thống')).toBeInTheDocument();
    expect(screen.getByText('C:/data/app.db')).toBeInTheDocument();
    expect(screen.getByText(/120 \/ 160/i)).toBeInTheDocument();
    expect(screen.getByText(/Dung lượng trống đang thấp hơn ngưỡng khuyến nghị/i)).toBeInTheDocument();

    expect(screen.getByText('Trạng thái SQL Server')).toBeInTheDocument();
    expect(screen.getByText('Mất kết nối SQL Server')).toBeInTheDocument();
    expect(screen.getByText(/Mã lỗi: ELOGIN/i)).toBeInTheDocument();
    expect(screen.getByText(/SQL Number: 18456/i)).toBeInTheDocument();
  });

  it('fallback đúng khi chưa có nhật ký sao lưu hoặc SQLite stats', () => {
    render(
      <DataHealthStorageOverviewPanel
        {...createProps({
          backup: {
            badgeClass: 'bg-sky-100 text-sky-700',
            severityLabel: 'Thông tin',
            lastSuccessAtLabel: 'Chưa có',
            relativeLabel: 'Không xác định',
            directory: '',
            fileLabel: '—',
            nextRunLabel: 'Không xác định',
            lastFailureAtLabel: '',
            lastFailureReason: '',
            scheduleReasons: [],
            recentEntries: [],
          },
          database: {
            badgeClass: 'bg-sky-100 text-sky-700',
            severityLabel: 'Thông tin',
            file: '',
            sizeLabel: '—',
            updatedAtLabel: 'Không rõ',
            sqliteStatsAvailable: false,
            sqliteUsedPages: null,
            sqliteTotalPages: null,
            sqliteUsedPercentLabel: null,
            sqliteFreePages: null,
            sqliteFreePercentLabel: null,
            sqliteHasFreeBytes: false,
            sqliteFreeLabel: '—',
            sqlitePageSizeLabel: '—',
            sqliteUsedLabel: '—',
            isMemoryDb: true,
            sqliteStatsError: 'Không đọc được file',
            diskUsedLabel: '—',
            diskUsedPercentLabel: '—',
            diskUsedPercentWidth: 0,
            diskFreeLabel: '—',
            diskTotalLabel: '—',
            methodLabel: '',
            warningMessage: '',
          },
        })}
      />
    );

    expect(screen.getByText('Chưa có nhật ký sao lưu.')).toBeInTheDocument();
    expect(screen.getByText(/Hệ thống đang chạy CSDL ở chế độ bộ nhớ/i)).toBeInTheDocument();
    expect(screen.getByText(/Không thể thống kê trang dữ liệu SQLite: Không đọc được file/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nguồn số liệu:/i)).not.toBeInTheDocument();
  });
});
