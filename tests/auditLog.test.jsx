import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import AuditLog from '@/components/AuditLog.jsx';
import { AUDIT_KEY } from '@/lib/store.js';
import { clearStorageCache, setItem as sharedSetItem } from '@/lib/storageClient.js';

const SUCCESS_SUMMARY = {
  schedule: {
    cron: '0 3 * * *',
    retentionDays: 14,
    directory: '/var/backups/kpi',
    active: false,
    reasons: ['cron_disabled_env'],
    lastError: null,
    refreshedAt: '2024-05-01T00:00:00.000Z',
    nextRun: null,
  },
  lastSuccess: {
    ts: '2024-05-01T03:00:00.000Z',
    actor: 'system',
    action: 'db.backup',
    detail: 'Sao lưu CSDL (scheduled)',
    meta: { status: 'success', reason: 'scheduled', bytes: 40960 },
  },
  lastFailure: {
    ts: '2024-05-01T02:00:00.000Z',
    actor: 'system',
    action: 'db.backup',
    detail: 'Sao lưu CSDL thất bại (memory_db)',
    meta: { status: 'failure', reason: 'memory_db' },
  },
  recent: [],
};

describe('AuditLog', () => {
  beforeEach(() => {
    clearStorageCache();
    sharedSetItem(
      AUDIT_KEY,
      JSON.stringify([
        {
          ts: '2024-05-01T03:00:00.000Z',
          actor: 'system',
          action: 'db.backup',
          detail: 'Sao lưu CSDL (scheduled)',
        },
      ])
    );
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ ok: true, summary: SUCCESS_SUMMARY }),
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    delete global.fetch;
  });

  it('hiển thị thông tin lịch sao lưu và lý do tắt cron', async () => {
    render(<AuditLog currentUser={{ username: 'admin' }} />);

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/backups/summary', {
      cache: 'no-store',
      credentials: 'include',
    });

    await waitFor(() => {
      expect(screen.getByText(/Biểu thức cron/i)).toBeInTheDocument();
    });

    expect(screen.getByText('0 3 * * *')).toBeInTheDocument();
    expect(screen.getByText(/Đang tắt tự động/i)).toBeInTheDocument();
    expect(screen.getByText(/Cron tự động đang bị tắt/)).toBeInTheDocument();
    expect(screen.getByText(/nguồn: scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/Không thể sao lưu vì CSDL đang chạy ở chế độ bộ nhớ/i)).toBeInTheDocument();
  });

  it('hiển thị thông báo lỗi khi API trả về lỗi', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    render(<AuditLog currentUser={{ username: 'admin' }} />);

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải thông tin sao lưu/i)).toBeInTheDocument();
    });
  });
});
