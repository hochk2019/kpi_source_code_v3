import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';

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



import App from '@/App.tsx';
import { AppDialogProvider } from '@/hooks/useAppDialog.tsx';
import { logout } from '@/auth/localAuth.js';

import { getDeclRows, saveDeclRows } from '@/lib/store.js';

import { installMockApi } from './helpers/mockApi.js';

import { clearStorageCache } from '@/lib/storageClient.js';



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



  beforeEach(async () => {

    await logout();
    clearStorageCache();

    fetchMock = installMockApi();

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

    cleanup();

    vi.unstubAllGlobals();

  });



  it('cho phép quản trị viên đăng nhập và import file Excel mẫu', async () => {

    const user = userEvent.setup();

    render(<AppDialogProvider><App /></AppDialogProvider>);



    await user.click(screen.getByRole('button', { name: /đăng nhập quản trị/i }));

    await user.type(await screen.findByPlaceholderText('admin'), 'admin');

    await user.type(await screen.findByPlaceholderText(/•/), 'admin123');

    await user.click(screen.getByRole('button', { name: /^đăng nhập$/i }));



    await waitFor(() => expect(screen.getByText(/Xin chào, /i)).toBeInTheDocument());



    const importTab = await screen.findByRole('tab', { name: /Import Data/i }, { timeout: 5000 });

    await user.click(importTab);

    await user.click(await screen.findByRole('tab', { name: /Import Data/i }));



    const file = createWorkbookFile();

    const input = await screen.findByTestId('import-file-input');

    await user.upload(input, file);



    await waitFor(() => {

      const rows = Array.from(document.querySelectorAll('tbody tr'));

      expect(rows.some((row) => row.textContent.includes('TK-E2E-001'))).toBe(true);

    });



    const importButtons = screen.getAllByRole('button', { name: /Import XLSX/i });
    const enabledImportBtn = importButtons.find(btn => !btn.disabled) ?? importButtons[0];
    await user.click(enabledImportBtn);



    await waitFor(() => {
      const stored = getDeclRows();
      expect(stored).toHaveLength(1);
    });

    const stored = getDeclRows();

    expect(stored).toHaveLength(1);

    expect(stored[0]).toMatchObject({

      so_tk: '00000002001',

      so_tk_full: 'TK-E2E-001',

      mst: '0101234567',

      cong_ty: 'Công ty E2E',

    });



    expect(fetchMock).toHaveBeenCalled();

  });

  it('khóa tờ khai đã rà soát đối với tài khoản nhân viên', async () => {

    await saveDeclRows(
      [
        {
          so_tk: '00000007001',
          so_tk_full: 'TK-LOCK-001',
          nhanh: '',
          date: '2025-08-15',
          raw_date: '15/08/2025',
          mst: '0107777333',
          cong_ty: 'Công ty Khoá Rà Soát',
          loai_hinh: 'A11',
          nhan_vien: 'Nhân viên',
          team: 'Team 1',
        },
      ],
      { overwrite: true, actor: 'test-seed' }
    );

    const user = userEvent.setup();

    render(<AppDialogProvider><App /></AppDialogProvider>);

    await user.click(screen.getByRole('button', { name: /đăng nhập quản trị/i }));
    await user.type(await screen.findByPlaceholderText('admin'), 'nhanvien');
    await user.type(await screen.findByPlaceholderText(/•/), '12345678');
    await user.click(screen.getByRole('button', { name: /^đăng nhập$/i }));

    await waitFor(() => expect(screen.getByText(/Xin chào, /i)).toBeInTheDocument());

    const importTabs = await screen.findAllByRole('tab', { name: /Import Data/i }, { timeout: 5000 });
    await user.click(importTabs[0]);

    const loadSavedButtons = await screen.findAllByRole('button', { name: /Hiển thị dữ liệu đã lưu/i });
    await user.click(loadSavedButtons[0]);

    await waitFor(() => expect(screen.getAllByText('TK-LOCK-001').length).toBeGreaterThan(0));

    const rowLabel = screen.getAllByText('TK-LOCK-001')[0];
    const rowElement = rowLabel.closest('tr');
    expect(rowElement).not.toBeNull();

    const rowScope = within(rowElement);
    const selectBox = rowScope.getByRole('checkbox');
    expect(selectBox).not.toBeDisabled();

    const deleteButton = rowScope.getByRole('button', { name: 'Đánh dấu xóa' });
    expect(deleteButton).toBeEnabled();

    await user.click(selectBox);

    const reviewButton = screen.getByRole('button', { name: 'Đánh dấu đã rà soát' });
    await user.click(reviewButton);

    await waitFor(() => {
      const lockedRow = screen.getAllByText('TK-LOCK-001')[0].closest('tr');
      expect(lockedRow).not.toBeNull();
      const lockedScope = within(lockedRow);
      expect(lockedScope.getByText('Khóa rà soát')).toBeInTheDocument();
      const lockedCheckbox = lockedScope.getByRole('checkbox');
      expect(lockedCheckbox).toBeDisabled();
      expect(lockedScope.queryByRole('button', { name: 'Đánh dấu xóa' })).toBeNull();
    });

    const reviewCall = fetchMock.mock.calls.find(
      ([url]) => String(url).endsWith('/api/v4/declarations/imports/alerts/review')
    );
    expect(reviewCall).toBeTruthy();
    const body = JSON.parse(reviewCall[1]?.body || '{}');
    expect(body.keys).toEqual(['00000000001_']);
  });

});

