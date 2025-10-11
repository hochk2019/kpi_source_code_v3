import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import ExportAuditReport from '@/components/ExportAuditReport.jsx';
import * as auth from '@/auth/localAuth.js';
import { toast } from 'sonner';

expect.extend({ toHaveNoViolations });

const BASE_SUMMARY = {
  total: 25,
  topUsers: [
    { actor: 'admin', count: 12 },
    { actor: 'system', count: 8 },
  ],
  byKind: [
    { kind: 'account.create', count: 9 },
    { kind: 'login', count: 6 },
  ],
};

const BASE_ENTRIES = [
  {
    id: 'log-1',
    ts: '2024-09-10T02:15:00.000Z',
    actor: 'admin',
    action: 'account.create',
    detail: 'Tạo tài khoản admin',
  },
  {
    id: 'log-2',
    ts: '2024-09-09T09:01:00.000Z',
    actor: 'system',
    action: 'db.backup',
    detail: 'Sao lưu cơ sở dữ liệu thủ công',
  },
];

function createResponse(payload) {
  return {
    ok: true,
    json: async () => ({ ok: true, ...payload }),
  };
}

function toDateInputValue(date) {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function subtractDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() - days);
  return copy;
}

function computeDefaultRange() {
  const now = new Date();
  return {
    from: toDateInputValue(subtractDays(now, 6)),
    to: toDateInputValue(now),
  };
}

describe('ExportAuditReport', () => {
  let fetchSpy;
  let toastSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(auth, 'fetchWithAuth');
    toastSpy = vi.spyOn(toast, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('gọi API mặc định với khoảng 7 ngày khi render', async () => {
    fetchSpy.mockResolvedValueOnce(
      createResponse({ entries: BASE_ENTRIES, meta: { page: 1, total: 25, pageSize: 20, hasNext: true, hasPrev: false }, summary: BASE_SUMMARY })
    );

    render(<ExportAuditReport />);

    await screen.findByText('Tạo tài khoản admin');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    const requestUrl = new URL(url, 'https://example.com');
    const { from, to } = computeDefaultRange();
    expect(requestUrl.pathname).toBe('/api/admin/audit/report');
    expect(requestUrl.searchParams.get('from')).toBe(from);
    expect(requestUrl.searchParams.get('to')).toBe(to);
    expect(requestUrl.searchParams.get('pageSize')).toBe('20');
    expect(requestUrl.searchParams.get('kind')).toBeNull();
    expect(requestUrl.searchParams.get('search')).toBeNull();
  });

  it('áp dụng bộ lọc mới và gửi truy vấn đúng tham số', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        createResponse({ entries: BASE_ENTRIES, meta: { page: 1, total: 50, pageSize: 20, hasNext: true, hasPrev: false }, summary: BASE_SUMMARY })
      )
      .mockResolvedValueOnce(
        createResponse({
          entries: [
            {
              id: 'log-3',
              ts: '2024-08-05T03:30:00.000Z',
              actor: 'thuy',
              action: 'account.update',
              detail: 'Cập nhật quyền tài khoản',
            },
          ],
          meta: { page: 1, total: 7, pageSize: 20, hasNext: false, hasPrev: false },
          summary: {
            total: 7,
            topUsers: [{ actor: 'thuy', count: 5 }],
            byKind: [{ kind: 'account.update', count: 7 }],
          },
        })
      );

    render(<ExportAuditReport />);

    await screen.findByText('Tạo tài khoản admin');

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2024-08-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2024-08-15' } });
    fireEvent.change(screen.getByLabelText('Nhóm hành động'), { target: { value: 'account' } });
    fireEvent.change(screen.getByLabelText('Từ khóa'), { target: { value: ' cập nhật ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    const [secondUrl] = fetchSpy.mock.calls[1];
    const requestUrl = new URL(secondUrl, 'https://example.com');
    expect(requestUrl.searchParams.get('from')).toBe('2024-08-01');
    expect(requestUrl.searchParams.get('to')).toBe('2024-08-15');
    expect(requestUrl.searchParams.get('kind')).toBe('account');
    expect(requestUrl.searchParams.get('search')).toBe('cập nhật');

    await screen.findByText('Cập nhật quyền tài khoản');
    expect(screen.getByTestId('audit-total-count').textContent).toBe('7');
  });

  it('chuyển trang và giữ tham số truy vấn', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        createResponse({ entries: BASE_ENTRIES, meta: { page: 1, total: 25, pageSize: 20, hasNext: true, hasPrev: false }, summary: BASE_SUMMARY })
      )
      .mockResolvedValueOnce(
        createResponse({
          entries: [
            {
              id: 'log-4',
              ts: '2024-09-08T11:00:00.000Z',
              actor: 'user1',
              action: 'login',
              detail: 'Đăng nhập hệ thống',
            },
          ],
          meta: { page: 2, total: 25, pageSize: 20, hasNext: false, hasPrev: true },
          summary: BASE_SUMMARY,
        })
      );

    render(<ExportAuditReport />);

    await screen.findByText('Tạo tài khoản admin');

    fireEvent.click(screen.getByRole('button', { name: 'Trang tiếp' }));

    await screen.findByText('Đăng nhập hệ thống');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [secondUrl] = fetchSpy.mock.calls[1];
    const requestUrl = new URL(secondUrl, 'https://example.com');
    const range = computeDefaultRange();
    expect(requestUrl.searchParams.get('page')).toBe('2');
    expect(requestUrl.searchParams.get('from')).toBe(range.from);
    expect(requestUrl.searchParams.get('to')).toBe(range.to);
  });

  it('hiển thị thống kê top người dùng và theo nhóm hành động', async () => {
    fetchSpy.mockResolvedValueOnce(
      createResponse({ entries: BASE_ENTRIES, meta: { page: 1, total: 25, pageSize: 20 }, summary: BASE_SUMMARY })
    );

    render(<ExportAuditReport />);

    await screen.findByText('Tạo tài khoản admin');

    const topRegion = await screen.findByLabelText('Top người dùng');
    expect(within(topRegion).getByText('admin')).toBeInTheDocument();
    expect(within(topRegion).getByText(/12 thao tác/)).toBeInTheDocument();

    const kindRegion = await screen.findByLabelText('Thống kê theo nhóm hành động');
    expect(within(kindRegion).getByText('account.create')).toBeInTheDocument();
    expect(within(kindRegion).getByText(/9 lần/)).toBeInTheDocument();
  });

  it('thông báo lỗi khi tải dữ liệu thất bại', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network down'));

    render(<ExportAuditReport />);

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith('Network down');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Network down');
  });

  it('đạt kiểm tra accessibility cơ bản', async () => {
    fetchSpy.mockResolvedValueOnce(
      createResponse({ entries: BASE_ENTRIES, meta: { page: 1, total: 25, pageSize: 20 }, summary: BASE_SUMMARY })
    );

    const { container } = render(<ExportAuditReport />);

    await screen.findByText('Tạo tài khoản admin');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
