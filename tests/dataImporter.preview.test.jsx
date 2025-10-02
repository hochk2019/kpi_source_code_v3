import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataImporter from '@/components/DataImporter.jsx';

const createJsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(payload),
});

describe('DataImporter preview UI', () => {
  const originalFetch = global.fetch;
  let fetchMock;
  const previewRows = [
    {
      so_tk: '888888888888',
      date: '2025-08-01',
      nhanh: '',
      mst: '5555555555',
      cong_ty: 'CÔNG TY MỚI',
      nhan_vien: '',
      status: 'new',
      co_line_count: 5,
    },
    {
      so_tk: '999999999999',
      date: '2025-08-01',
      nhanh: '',
      mst: '1234567890',
      cong_ty: 'CÔNG TY ABC',
      nhan_vien: 'Hạnh',
      status: 'existing',
      co_line_count: 0,
    },
  ];

  beforeEach(() => {
    window.confirm = vi.fn(() => true);
    fetchMock = vi.fn((input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url === '/api/import/ecus/config') {
        return Promise.resolve(
          createJsonResponse({
            ok: true,
            config: {
              enabled: true,
              schedule: '0 * * * *',
              rangeDays: 1,
              preferMonthFirst: false,
              connection: { server: '', database: '', user: '', hasPassword: false },
            },
          })
        );
      }
      if (url === '/api/import/ecus/status') {
        return Promise.resolve(
          createJsonResponse({
            ok: true,
            backend: { ok: true, state: 'online', checkedAt: new Date().toISOString() },
            database: { ok: true, state: 'ready', checkedAt: new Date().toISOString() },
          })
        );
      }
      if (url === '/api/import/alerts') {
        return Promise.resolve(
          createJsonResponse({
            ok: true,
            alerts: [],
            summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null },
          })
        );
      }
      if (url === '/api/import/ecus/preview') {
        return Promise.resolve(
          createJsonResponse({
            ok: true,
            preview: {
              rows: previewRows,
              limited: false,
              range: { from: '2025-08-01', to: '2025-08-02' },
            },
          })
        );
      }
      return Promise.resolve(createJsonResponse({ ok: true }));
    });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('hiển thị bảng xem trước với trạng thái và dữ liệu mô phỏng ECUS', async () => {
    render(
      <DataImporter
        canEdit
        canManageSync
        currentUser={{ username: 'admin', permissions: ['syncManage'] }}
      />
    );

    await screen.findByText('Đồng bộ tự động từ ECUS5VNACCS');

    const previewButton = await screen.findByRole('button', { name: 'Xem trước dữ liệu' });
    await userEvent.click(previewButton);

    await screen.findByText(/Xem trước 2 dòng đầu tiên sẽ nhập vào hệ thống/);

    expect(screen.getByText('CÔNG TY MỚI')).toBeInTheDocument();
    expect(screen.getByText('CÔNG TY ABC')).toBeInTheDocument();
    expect(screen.getByText('Mới')).toBeInTheDocument();
    expect(screen.getByText('Đã có')).toBeInTheDocument();

    const previewCall = fetchMock.mock.calls.find(([url]) => url === '/api/import/ecus/preview');
    expect(previewCall).toBeTruthy();
    const body = JSON.parse(previewCall[1]?.body || '{}');
    expect(body.limit).toBe(100);
    expect(body.from).toBeUndefined();
    expect(body.to).toBeUndefined();
  });
});
