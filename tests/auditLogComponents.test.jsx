// tests/auditLogComponents.test.jsx
// Tests for audit log components

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import AuditLogTable from '../src/components/auditLog/AuditLogTable.jsx';
import AuditLogFilters from '../src/components/auditLog/AuditLogFilters.jsx';
import AuditLogDetail from '../src/components/auditLog/AuditLogDetail.jsx';
import BackupSection from '../src/components/auditLog/BackupSection.jsx';

describe('AuditLog Components', () => {
  afterEach(() => {
    cleanup();
  });
  describe('AuditLogTable', () => {
    const mockLogs = [
      {
        ts: '2024-01-15T10:30:00Z',
        action: 'user.login',
        actor: 'admin',
        result: 'success',
        detail: 'Đăng nhập thành công',
      },
      {
        ts: '2024-01-15T11:00:00Z',
        action: 'data.export',
        actor: 'user1',
        result: 'failure',
        detail: 'Xuất dữ liệu thất bại',
        meta: { error: 'Timeout' },
      },
    ];

    it('renders loading state', () => {
      render(<AuditLogTable isLoading={true} />);
      expect(screen.getByText('Đang tải...')).toBeDefined();
    });

    it('renders empty state', () => {
      render(<AuditLogTable filteredLogs={[]} />);
      expect(screen.getByText('Không tìm thấy bản ghi nào')).toBeDefined();
    });

    it('renders log entries', () => {
      render(
        <AuditLogTable
          filteredLogs={mockLogs}
          formatTime={(ts) => new Date(ts).toLocaleString()}
          inferCategoryFromAction={() => 'auth'}
        />
      );
      expect(screen.getByText('user.login')).toBeDefined();
      expect(screen.getByText('data.export')).toBeDefined();
    });

    it('handles row click', () => {
      const onRowClick = vi.fn();
      render(
        <AuditLogTable
          filteredLogs={mockLogs}
          onRowClick={onRowClick}
        />
      );
      fireEvent.click(screen.getByText('user.login'));
      expect(onRowClick).toHaveBeenCalledWith(mockLogs[0]);
    });
  });

  describe('AuditLogFilters', () => {
    const mockCategories = ['all', 'auth', 'data', 'system'];

    it('renders filter controls', () => {
      render(<AuditLogFilters availableCategories={mockCategories} />);
      expect(screen.getByPlaceholderText('Tìm kiếm...')).toBeDefined();
      expect(screen.getByText('Tất cả loại')).toBeDefined();
    });

    it('calls onFilterChange', () => {
      const onFilterChange = vi.fn();
      render(
        <AuditLogFilters
          availableCategories={mockCategories}
          onFilterChange={onFilterChange}
        />
      );
      fireEvent.change(screen.getByPlaceholderText('Tìm kiếm...'), {
        target: { value: 'login' },
      });
      expect(onFilterChange).toHaveBeenCalledWith('login');
    });
  });

  describe('AuditLogDetail', () => {
    const mockEntry = {
      ts: '2024-01-15T10:30:00Z',
      action: 'user.login',
      actor: 'admin',
      result: 'success',
      detail: 'Đăng nhập thành công',
      meta: { ip: '127.0.0.1' },
    };

    it('renders null when no entry', () => {
      const { container } = render(<AuditLogDetail entry={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders entry details', () => {
      render(<AuditLogDetail entry={mockEntry} formatTime={(ts) => ts} />);
      expect(screen.getByText('user.login')).toBeDefined();
      expect(screen.getByText('admin')).toBeDefined();
      expect(screen.getByText('success')).toBeDefined();
    });

    it('calls onClose', () => {
      const onClose = vi.fn();
      render(<AuditLogDetail entry={mockEntry} onClose={onClose} />);
      fireEvent.click(screen.getByText('Đóng'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('BackupSection', () => {
    const mockConfig = {
      schedule: '0 2 * * *',
      directory: './backups',
      retentionDays: 30,
    };

    const mockHistory = [
      { id: '1', timestamp: '2024-01-15', size: '10MB', status: 'success' },
      { id: '2', timestamp: '2024-01-14', size: '10MB', status: 'failed' },
    ];

    it('renders backup status', () => {
      render(
        <BackupSection
          backupConfig={mockConfig}
          backupHistory={mockHistory}
        />
      );
      expect(screen.getByText('Sao lưu dữ liệu')).toBeDefined();
      expect(screen.getByText('Cấu hình sao lưu')).toBeDefined();
    });

    it('calls onManualBackup', () => {
      const onManualBackup = vi.fn();
      render(
        <BackupSection
          backupConfig={mockConfig}
          onManualBackup={onManualBackup}
        />
      );
      fireEvent.click(screen.getByText('Sao lưu ngay'));
      expect(onManualBackup).toHaveBeenCalled();
    });
  });
});
