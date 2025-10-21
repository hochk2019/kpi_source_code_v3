import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataImporter from '@/components/DataImporter.jsx';
import { setItem as sharedSetItem, clearStorageCache } from '@/lib/storageClient.js';
import * as store from '@/lib/store.js';
import { filterDeclRows, normalizeDeclSearchFilters } from '@/shared/declSearch.js';
import * as auth from '@/auth/localAuth.js';

const { DECL_KEY } = store;

vi.mock('@/shared/toast.js', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    promise: vi.fn(),
    custom: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const createJsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(payload),
});

describe('DataImporter preview UI', () => {
  let fetchMock;
  let currentDeclRows;
  const savedRows = [
    {
      so_tk: 'TK-CO-0',
      date: '2025-07-01',
      nhanh: '',
      mst: '0100000000',
      cong_ty: 'Công ty không CO',
      loai_hinh: 'A11',
      muc_hang: 3,
      co: '',
      has_co: false,
      co_line_count: 0,
      status: 'existing',
    },
    {
      so_tk: 'TK-CO-1',
      date: '2025-07-02',
      nhanh: '',
      mst: '0100000001',
      cong_ty: 'Công ty 1 dòng',
      loai_hinh: 'A11',
      muc_hang: 4,
      co: 'Có',
      has_co: true,
      co_line_count: 1,
      status: 'new',
    },
    {
      so_tk: 'TK-CO-4',
      date: '2025-07-03',
      nhanh: '',
      mst: '0100000004',
      cong_ty: 'Công ty 4 dòng',
      loai_hinh: 'A11',
      muc_hang: 5,
      co: 'Có',
      has_co: true,
      co_line_count: 4,
      status: 'existing',
    },
  ];
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
    currentDeclRows = savedRows;
    fetchMock = vi.fn((input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.startsWith('/api/storage/')) {
        const key = decodeURIComponent(url.split('/').pop() || '');
        if (key === DECL_KEY) {
          return Promise.resolve(
            createJsonResponse({
              ok: true,
              key,
              raw: JSON.stringify(currentDeclRows),
              value: currentDeclRows,
            })
          );
        }
        return Promise.resolve(createJsonResponse({ ok: true, key, raw: null, value: null }));
      }
      if (url.startsWith('/api/import/search')) {
        const urlObj = new URL(url, 'http://localhost');
        const params = urlObj.searchParams;
        const rawFilters = {};
        for (const [key, value] of params.entries()) {
          if (Object.prototype.hasOwnProperty.call(rawFilters, key)) {
            const existing = rawFilters[key];
            rawFilters[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
          } else {
            rawFilters[key] = value;
          }
        }
        const filters = normalizeDeclSearchFilters(rawFilters);
        const sample = Array.isArray(currentDeclRows) ? currentDeclRows.slice(0, 2000) : [];
        const filtered = filterDeclRows(sample, filters);
        const DEFAULT_PAGE_SIZE = 10;
        const MAX_PAGE_SIZE = 200;
        const requestedPage = Number(params.get('page'));
        const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
        const requestedPageSize = Number(params.get('pageSize'));
        const sizeCandidate =
          Number.isFinite(requestedPageSize) && requestedPageSize > 0
            ? Math.floor(requestedPageSize)
            : DEFAULT_PAGE_SIZE;
        const pageSize = Math.max(1, Math.min(sizeCandidate, MAX_PAGE_SIZE));
        const total = filtered.length;
        const offset = (page - 1) * pageSize;
        const rows = filtered.slice(offset, offset + pageSize);
        if (init?.signal?.aborted) {
          const abortError = new Error('aborted');
          abortError.name = 'AbortError';
          return Promise.reject(abortError);
        }
        return Promise.resolve(createJsonResponse({ ok: true, total, page, pageSize, rows }));
      }
      if (url === '/api/import/ecus/config') {
        return Promise.resolve(
          createJsonResponse({
            ok: true,
            config: {
              enabled: true,
              schedule: '0 3 * * *',
              scheduleMode: 'daily',
              scheduleValue: 1,
              scheduleTime: '03:00',
              scheduleDescription: 'Mỗi ngày lúc 03:00',
              rangeDays: 1,
              preferMonthFirst: false,
              connection: { server: 'Server', database: 'ECUS5VNACCS', user: 'sa', hasPassword: true, password: '' },
              includeTaxCodes: [],
              excludeTaxCodes: [],
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
      if (url.startsWith('/api/filter-presets')) {
        return Promise.resolve(
          createJsonResponse({ ok: true, scope: 'data-importer', presets: [] })
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
    vi.spyOn(auth, 'fetchWithAuth').mockImplementation(fetchMock);
    clearStorageCache();
    sharedSetItem(DECL_KEY, JSON.stringify(currentDeclRows));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hiển thị bảng xem trước với trạng thái và dữ liệu mô phỏng ECUS', async () => {
    render(
      <DataImporter
        canEdit
        canManageSync
        currentUser={{ username: 'admin', permissions: ['syncManage'], role: 'admin' }}
      />
    );

    const [autoSyncHeading] = await screen.findAllByText('Đồng bộ tự động từ ECUS5VNACCS');
    expect(autoSyncHeading).toBeInTheDocument();
    const autoSyncSection = autoSyncHeading.closest('section');
    expect(autoSyncSection).toBeTruthy();

    const previewButton = within(autoSyncSection).getByRole('button', { name: 'Xem trước dữ liệu' });
    await userEvent.click(previewButton);

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
    expect(body.includeTaxCodes).toEqual([]);
    expect(body.excludeTaxCodes).toEqual([]);
  });

  it('cho phép cấu hình danh sách MST lọc đồng bộ và gửi kèm khi gọi API', async () => {
    render(
      <DataImporter
        canEdit
        canManageSync
        currentUser={{ username: 'admin', permissions: ['syncManage'], role: 'admin' }}
      />
    );

    const [autoSyncHeading] = await screen.findAllByText('Đồng bộ tự động từ ECUS5VNACCS');
    expect(autoSyncHeading).toBeInTheDocument();
    const autoSyncSection = autoSyncHeading.closest('section');
    expect(autoSyncSection).toBeTruthy();

    const includeTextarea = within(autoSyncSection).getByLabelText('Chỉ đồng bộ các MST');
    const excludeTextarea = within(autoSyncSection).getByLabelText('Danh sách MST loại trừ');

    fireEvent.change(includeTextarea, {
      target: { value: '0100109106;\n  0100109107 ' },
    });
    fireEvent.change(excludeTextarea, {
      target: { value: '0100109108;0100109109' },
    });

    const previewButton = within(autoSyncSection).getByRole('button', { name: 'Xem trước dữ liệu' });
    await userEvent.click(previewButton);

    const previewCall = fetchMock.mock.calls.find(([url]) => url === '/api/import/ecus/preview');
    expect(previewCall).toBeTruthy();
    const body = JSON.parse(previewCall[1]?.body || '{}');
    expect(body.includeTaxCodes).toEqual(['0100109106', '0100109107']);
    expect(body.excludeTaxCodes).toEqual(['0100109108', '0100109109']);

    const runButton = within(autoSyncSection).getByRole('button', { name: 'Đồng bộ ngay' });
    await userEvent.click(runButton);

    const runCall = fetchMock.mock.calls.find(([url]) => url === '/api/import/ecus/run');
    expect(runCall).toBeTruthy();
    const runBody = JSON.parse(runCall[1]?.body || '{}');
    expect(runBody.includeTaxCodes).toEqual(['0100109106', '0100109107']);
    expect(runBody.excludeTaxCodes).toEqual(['0100109108', '0100109109']);
  });

  it('lọc danh sách tờ khai theo số dòng C/O', async () => {
    render(
      <DataImporter
        canEdit
        currentUser={{ username: 'checker', permissions: [] }}
      />
    );

    await screen.findAllByRole('table');
    const pickMainTable = () => {
      const allTables = screen.getAllByRole('table');
      for (const candidate of allTables) {
        if (within(candidate).queryByRole('columnheader', { name: 'C/O' })) {
          return candidate;
        }
      }
      return null;
    };
    await waitFor(() => {
      const table = pickMainTable();
      if (!table) {
        throw new Error('Không tìm thấy bảng dữ liệu tờ khai');
      }
      const tableScope = within(table);
      expect(tableScope.getByText('TK-CO-0')).toBeInTheDocument();
      expect(tableScope.getByText('TK-CO-1')).toBeInTheDocument();
      expect(tableScope.getByText('TK-CO-4')).toBeInTheDocument();
    });

    const coFilters = await screen.findAllByLabelText('Lọc C/O');
    const coFilter = coFilters[0];
    await userEvent.selectOptions(coFilter, 'has');

    await waitFor(() => {
      const table = pickMainTable();
      if (!table) {
        throw new Error('Không tìm thấy bảng dữ liệu tờ khai sau khi lọc');
      }
      const tableScope = within(table);
      expect(tableScope.queryByText('TK-CO-0')).not.toBeInTheDocument();
      expect(tableScope.getByText('TK-CO-1')).toBeInTheDocument();
      expect(tableScope.getByText('TK-CO-4')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Đáp ứng C/O: 2 tờ khai')).toBeInTheDocument();
    });

    await userEvent.selectOptions(coFilter, 'min');
    const minInput = await screen.findByLabelText('Tối thiểu dòng C/O');
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '3');

    await waitFor(() => {
      const table = pickMainTable();
      if (!table) {
        throw new Error('Không tìm thấy bảng dữ liệu tờ khai sau khi áp dụng ngưỡng');
      }
      const tableScope = within(table);
      expect(tableScope.queryByText('TK-CO-1')).not.toBeInTheDocument();
      expect(tableScope.getByText('TK-CO-4')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Đáp ứng C/O: 1 tờ khai')).toBeInTheDocument();
    });
  });

  it('hỗ trợ lọc nhanh bằng ô tìm kiếm hợp nhất', async () => {
    render(
      <DataImporter
        canEdit
        currentUser={{ username: 'viewer', permissions: [] }}
      />
    );

    // Ô tìm nhanh duy nhất được giữ lại
    const searchInputs = await screen.findAllByPlaceholderText(
      'Tìm nhanh (Số TK / MST / Công ty / Nhân viên / Tổ đội)'
    );
    const searchInput = searchInputs[searchInputs.length - 1];

    // Không còn các placeholder lọc MST hay khu vực trạng thái riêng
    expect(screen.queryByPlaceholderText('Lọc nhanh theo MST')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Đã có' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Lưu trạng thái ưa thích/i })
    ).not.toBeInTheDocument();

    const pickMainTable = () => {
      const allTables = screen.getAllByRole('table');
      for (const candidate of allTables) {
        if (within(candidate).queryByRole('columnheader', { name: 'MST' })) {
          return candidate;
        }
      }
      return null;
    };

    const table = await waitFor(() => {
      const main = pickMainTable();
      if (!main) {
        throw new Error('Không tìm thấy bảng dữ liệu tờ khai');
      }
      return main;
    });

    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'Công ty 4 dòng');
    expect(searchInput).toHaveValue('Công ty 4 dòng');
  });

  it('gửi truy vấn tìm nhanh lên API và nhận đúng kết quả lọc', async () => {
    const user = userEvent.setup();
    const largeRows = Array.from({ length: 5200 }, (_, index) => ({
      so_tk: `TK-${(index + 1).toString().padStart(6, '0')}`,
      so_tk_full: `TK-${(index + 1).toString().padStart(6, '0')}`,
      date: '2025-07-01',
      mst: `010${(index + 1).toString().padStart(7, '0')}`,
      cong_ty: `Doanh nghiệp ${index + 1}`,
      nhan_vien: index % 2 === 0 ? 'Lan' : 'Hùng',
      team: index % 3 === 0 ? 'Tổ đội A' : '',
      status: index % 2 === 0 ? 'existing' : 'new',
      co_line_count: index % 5,
      has_co: index % 5 > 0,
    }));
    largeRows[5] = {
      ...largeRows[5],
      so_tk: 'TK-QUERY-001',
      so_tk_full: 'TK-QUERY-001',
      mst: '0101234599',
      cong_ty: 'Công ty lọc nhanh',
      nhan_vien: 'Thảo',
      team: 'Tổ đội tìm kiếm',
    };
    const getDeclRowsSpy = vi.spyOn(store, 'getDeclRows').mockReturnValue(largeRows);
    currentDeclRows = largeRows;
    clearStorageCache();
    sharedSetItem(DECL_KEY, JSON.stringify(currentDeclRows));
    render(
      <DataImporter
        canEdit
        currentUser={{ username: 'viewer', permissions: [] }}
      />
    );

    await waitFor(() => {
      expect(getDeclRowsSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('5.200')).toBeInTheDocument();
    });

    const helperTexts = await screen.findAllByText(
      'Nhập từ khóa để tìm nhanh theo Số tờ khai, mã số thuế, tên doanh nghiệp, nhân viên hoặc tổ đội phụ trách.'
    );
    const helperText = helperTexts[helperTexts.length - 1];
    const searchInput = helperText.previousElementSibling;
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error('Không tìm thấy ô tìm nhanh chính');
    }
    await user.clear(searchInput);
    await user.type(searchInput, 'lọc nhanh');

    await waitFor(() => {
      const searchCalls = fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/import/search'));
      expect(searchCalls.length).toBeGreaterThan(0);
      const hasQueryCall = searchCalls.some(([url]) => {
        const parsed = new URL(url, 'http://localhost');
        return parsed.searchParams.get('query') === 'lọc nhanh';
      });
      expect(hasQueryCall).toBe(true);
    });

    const searchCallEntries = fetchMock.mock.calls
      .map(([url], index) => ({ url, index }))
      .filter(({ url }) => url.startsWith('/api/import/search'));
    const queryCallEntry = searchCallEntries.find(({ url }) => {
      const parsed = new URL(url, 'http://localhost');
      return parsed.searchParams.get('query') === 'lọc nhanh';
    });
    expect(queryCallEntry).toBeTruthy();
    const responsePromise = fetchMock.mock.results[queryCallEntry.index]?.value;
    const response = await responsePromise;
    const payload = await response.json();
    expect(Array.isArray(payload.rows)).toBe(true);
    expect(payload.rows.some((row) => row.cong_ty === 'Công ty lọc nhanh')).toBe(true);

    getDeclRowsSpy.mockRestore();
  });
});
