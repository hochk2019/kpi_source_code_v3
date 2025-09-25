import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('xlsx', () => {
  const row = {
    'Số tờ khai': 'TK-E2E-001',
    'Ngày': '15/08/2025',
    'MST': '0101234567',
    'Công ty': 'Công ty E2E',
    'Loại hình': 'A11',
    'Mục hàng': '5',
  };
  const read = vi.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }));
  const sheet_to_json = vi.fn(() => [row]);
  return {
    __esModule: true,
    read,
    utils: { sheet_to_json },
  };
});

import * as XLSX from 'xlsx';

import App from '@/App.jsx';
import { getDeclRows } from '@/lib/store.js';

function createWorkbookFile() {
  return new File(['dummy'], 'import-e2e.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

class MockFileReader {
  constructor() {
    this.result = null;
    this.onload = null;
  }

  async readAsArrayBuffer() {
    this.result = new ArrayBuffer(8);
    if (typeof this.onload === 'function') {
      this.onload({ target: this });
    }
  }
}

function setupFetchStub() {
  const fetchMock = vi.fn(async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url ?? '';
    const method = init?.method || 'GET';

    if (url.includes('/api/import/ecus/config')) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          config: {
            enabled: false,
            schedule: '0 * * * *',
            rangeDays: 1,
            connection: { server: '', database: '', user: '', hasPassword: false },
          },
        }),
      };
    }

    if (url.includes('/api/import/alerts')) {
      if (method === 'POST') {
        return {
          ok: true,
          json: async () => ({ ok: true, updated: [] }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          alerts: [],
          summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null },
        }),
      };
    }

    if (url.includes('/api/import/ecus/run') && method === 'POST') {
      return { ok: true, json: async () => ({ ok: true, result: { fetched: 0, imported: 0 } }) };
    }

    if (url.includes('/api/audit')) {
      return { ok: true, json: async () => ({ ok: true, logs: [] }) };
    }

    return { ok: true, json: async () => ({ ok: true }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function ensureTestGlobals() {
  if (!globalThis.ResizeObserver) {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  }
}

describe('Luồng đăng nhập và import thực tế', () => {
  let alertMock;
  let confirmMock;
  let fetchMock;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = setupFetchStub();
    vi.stubGlobal('FileReader', MockFileReader);
    alertMock = vi.fn();
    confirmMock = vi.fn(() => true);
    vi.stubGlobal('alert', alertMock);
    vi.stubGlobal('confirm', confirmMock);
    ensureTestGlobals();
    XLSX.read.mockClear();
    XLSX.utils.sheet_to_json.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cho phép quản trị viên đăng nhập và import file Excel mẫu', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /đăng nhập quản trị/i }));
    await user.type(screen.getByPlaceholderText('admin'), 'admin');
    await user.type(screen.getByPlaceholderText(/•/), 'admin123');
    await user.click(screen.getByRole('button', { name: /^đăng nhập$/i }));

    await waitFor(() => expect(screen.getByText(/Xin chào, /i)).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /Import Data/i }));

    const file = createWorkbookFile();
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);

    await waitFor(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      expect(rows.some((row) => row.textContent.includes('TK-E2E-001'))).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: /Import XLSX/i }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Import xong!'));

    const stored = getDeclRows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      so_tk: 'TK-E2E-001',
      mst: '0101234567',
      cong_ty: 'Công ty E2E',
    });

    expect(fetchMock).toHaveBeenCalled();
  });
});
