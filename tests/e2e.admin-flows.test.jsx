import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';

import userEvent from '@testing-library/user-event';

import React from 'react';



import MSTAssignment from '@/components/MSTAssignment.jsx';

import HQAgencyManager from '@/components/HQAgencyManager.jsx';

import ReportViewer from '@/components/ReportViewer.jsx';

import AccountManager from '@/components/AccountManager.jsx';

import { clearStorageCache, setItem as sharedSetItem } from '@/lib/storageClient.js';

import { MST_KEY, MST_HISTORY_KEY, HQ_KEY, HQ_HISTORY_KEY, DECL_KEY, getMSTMap, getHQAgencies } from '@/lib/store.js';

import { seedSampleDeclarations } from '@/shared/sampleDeclarations.js';

import { installMockApi } from './helpers/mockApi.js';



vi.mock('@/lib/hqHistoryClient.js', () => ({

  fetchHQHistoryEntries: vi.fn(async () => ({ entries: [], total: 0, limit: 0 })),

  refreshHQHistoryCache: vi.fn(async () => []),

}));



function ensureTestGlobals() {

  if (!globalThis.ResizeObserver) {

    vi.stubGlobal('ResizeObserver', class {

      observe() {}

      unobserve() {}

      disconnect() {}

    });

  }

}



describe('Luồng quản trị – Gán MST', () => {

  let alertMock;



  beforeEach(() => {

    ensureTestGlobals();

    clearStorageCache();

    sharedSetItem(MST_KEY, JSON.stringify([]));

    sharedSetItem(MST_HISTORY_KEY, JSON.stringify([]));

    alertMock = vi.fn();

    vi.stubGlobal('alert', alertMock);

  });



  afterEach(() => {

    vi.unstubAllGlobals();

  });



  it('thêm dòng mới và lưu vào bảng MST', async () => {

    const user = userEvent.setup();

    render(<MSTAssignment canEdit currentUser={{ username: 'admin' }} />);



    await user.click(screen.getByRole('button', { name: /thêm mới/i }));

    await user.type(screen.getByLabelText('Mã số thuế'), '0312345678');

    await user.type(screen.getByLabelText('Tên công ty'), 'Công ty Kim Liên');

    await user.type(screen.getByLabelText('Người phụ trách Nhập'), 'Minh Trí');

    await user.type(screen.getByLabelText('Người phụ trách Xuất'), 'Ngọc Hà');

    await user.type(screen.getByLabelText('Tổ đội (tuỳ chọn)'), 'Tổ 1');

    await user.type(screen.getByLabelText('Áp dụng từ ngày'), '2025-01-01');



    await user.click(screen.getByRole('button', { name: /thêm vào danh sách/i }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Đã thêm vào danh sách. Bấm Lưu để ghi vào hệ thống.'));



    await user.click(screen.getByRole('button', { name: /^lưu$/i }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Lưu thành công!'));



    const savedRows = getMSTMap();

    expect(savedRows).toEqual(

      expect.arrayContaining([

        expect.objectContaining({

          mst: '0312345678',

          company: 'Công ty Kim Liên',

          person_import: 'Minh Trí',

          person_export: 'Ngọc Hà',

          team: 'Tổ 1',

          effective_from: '2025-01-01',

        }),

      ]),

    );

  });

});



describe('Luồng quản trị – Đại Lý HQ', () => {

  let alertMock;



  beforeEach(() => {

    ensureTestGlobals();

    clearStorageCache();

    sharedSetItem(HQ_KEY, JSON.stringify([]));

    sharedSetItem(HQ_HISTORY_KEY, JSON.stringify([]));

    sharedSetItem(DECL_KEY, JSON.stringify([]));

    alertMock = vi.fn();

    vi.stubGlobal('alert', alertMock);

  });



  afterEach(() => {

    vi.unstubAllGlobals();

  });



  it('thêm dòng đại lý và lưu cấu hình', async () => {

    const user = userEvent.setup();

    render(<HQAgencyManager canEdit currentUser={{ username: 'admin' }} />);



    await user.click(screen.getByRole('button', { name: /thêm dòng mới/i }));

    const hqSection = screen.getByText('Danh sách Đại lý Hải quan hợp tác').closest('section');

    const resolveRowInputs = () => {

      const table = within(hqSection ?? document.body).getAllByRole('table')[0];

      const row = within(table).getAllByRole('row')[1];

      return within(row).getAllByRole('textbox');

    };



    let [mstInput] = resolveRowInputs();

    fireEvent.change(mstInput, { target: { value: '0312345678' } });

    await waitFor(() => {

      [mstInput] = resolveRowInputs();

      expect(mstInput).toHaveValue('0312345678');

    });



    let [, companyInput] = resolveRowInputs();

    fireEvent.change(companyInput, { target: { value: 'Công ty Hợp Tác' } });

    await waitFor(() => {

      [, companyInput] = resolveRowInputs();

      expect(companyInput).toHaveValue('Công ty Hợp Tác');

    });



    let [, , agentInput] = resolveRowInputs();

    fireEvent.change(agentInput, { target: { value: 'AnExpress, BLogistics' } });

    await waitFor(() => {

      [, , agentInput] = resolveRowInputs();

      expect(agentInput).toHaveValue('AnExpress, BLogistics');

    });



    await user.click(screen.getByRole('button', { name: /lưu cấu hình/i }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Đã lưu cấu hình Đại lý HQ.'));



    await waitFor(() =>

      expect(getHQAgencies()).toEqual(

        expect.arrayContaining([

          expect.objectContaining({

            mst: '0312345678',

            company: 'Công ty Hợp Tác',

            agent: 'AnExpress, BLogistics',

          }),

        ]),

      ),

    );

  });

});



describe('Luồng quản trị – Báo Cáo KPI', () => {

  beforeEach(() => {

    ensureTestGlobals();

    clearStorageCache();

    seedSampleDeclarations({ actor: 'vitest', count: 24 });

  });



  afterEach(() => {

    vi.unstubAllGlobals();

  });



  it('hiển thị bảng tổng hợp và cho phép đổi khoảng thời gian', async () => {

    const user = userEvent.setup();

    render(

      <div role="tabpanel" style={{ minWidth: 1024, minHeight: 640 }}>

        <ReportViewer canExport />

      </div>,

    );



    await screen.findByText(/Top 5 nhân viên theo điểm KPI/i);

    const rangeLabel = screen.getByText('Khoảng thời gian');

    const rangeSelect = rangeLabel.parentElement?.querySelector('select');

    if (rangeSelect) {

      fireEvent.change(rangeSelect, { target: { value: 'all_time' } });

    }



    const reportPanel = screen.getAllByRole('tabpanel')[0];



    await waitFor(() => {

      const companyCells = within(reportPanel ?? document.body).getAllByText('Công ty Ánh Dương');

      expect(companyCells.length).toBeGreaterThan(0);

    });



    const toggleContainer = within(reportPanel ?? document.body).getByText('Cột báo cáo').closest('div');

    const checkbox = within(toggleContainer ?? reportPanel ?? document.body).getByRole('checkbox', { name: 'Số giấy phép' });

    expect(checkbox).toBeDefined();

    if (checkbox) {

      await user.click(checkbox);

      await user.click(checkbox);

    }

  });

});



describe('Luồng quản trị – Tài khoản', () => {

  let alertMock;

  let fetchMock;



  beforeEach(() => {

    ensureTestGlobals();

    clearStorageCache();

    fetchMock = installMockApi();

    alertMock = vi.fn();

    vi.stubGlobal('alert', alertMock);

    vi.stubGlobal('prompt', vi.fn(() => 'MatKhauMoi!'));

    vi.stubGlobal('confirm', vi.fn(() => true));

  });



  afterEach(() => {

    vi.unstubAllGlobals();

  });



  it('tạo tài khoản mới từ giao diện quản trị', async () => {

    const user = userEvent.setup();

    render(<AccountManager currentUser={{ username: 'admin' }} />);



    const createSection = screen.getByText('Tạo tài khoản mới').closest('section');

    await user.type(within(createSection ?? document.body).getByPlaceholderText('username'), 'tester');

    await user.type(within(createSection ?? document.body).getByPlaceholderText('Tên người dùng'), 'Tài khoản thử nghiệm');

    await user.type(within(createSection ?? document.body).getByPlaceholderText('Ít nhất 6 ký tự'), 'Tester@2025');

    const roleSelect = within(createSection ?? document.body).getByRole('combobox');

    await user.selectOptions(roleSelect, 'manager');



    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Đã tạo tài khoản mới.'));

    await waitFor(() => expect(screen.getByText('tester')).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/auth/accounts'), expect.anything());

  });

});

