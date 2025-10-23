import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { render, screen, waitFor, within } from '@testing-library/react';

import userEvent from '@testing-library/user-event';

import KPIAdjustments from '@/components/KPIAdjustments.jsx';

import {

  KPI_ADJUSTMENTS_KEY,

  KPI_ADJUSTMENT_SETTINGS_KEY,

  TEAM_KEY,

  DECL_KEY,

  saveKpiAdjustment,

} from '@/lib/store.js';

import { clearStorageCache, setItem as sharedSetItem } from '@/lib/storageClient.js';



describe('KPIAdjustments UI', () => {

  beforeEach(() => {

    const now = new Date();

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    clearStorageCache();

    const baseSettings = {

      categories: {

        support_misc: { defaultMode: 'dynamic', modeUnits: { dynamic: 0.2, fixed: 12 } },

        license_support: { defaultUnit: 1.5, licensePoints: { ZB03: 2.8 } },

      },

    };

    sharedSetItem(KPI_ADJUSTMENT_SETTINGS_KEY, JSON.stringify(baseSettings));

    sharedSetItem(KPI_ADJUSTMENTS_KEY, JSON.stringify([]));

    sharedSetItem(

      TEAM_KEY,

      JSON.stringify({ teams: [{ name: 'Team 1', members: [{ name: 'Lan' }, { name: 'Bình' }] }] })

    );

    sharedSetItem(

      DECL_KEY,

      JSON.stringify([

        { so_tk: 'TK001', date: '2025-01-01', nhanh: '', cong_ty: 'Công ty A' },

        { so_tk: 'TK002', date: '2025-01-02', nhanh: '', cong_ty: 'Công ty B' },

      ])

    );

    saveKpiAdjustment(

      {

        category: 'support_misc',

        month: currentMonth,

        staffName: 'Lan',

        teamName: 'Team 1',

        note: 'Điểm cố định thử nghiệm',

        references: ['TK001'],

        quantity: 1,

        unitPoints: 12,

        mode: 'fixed',

        status: 'pending',

      },

      { actor: 'seed', permissions: { adjustApprove: true } }

    );

    vi.spyOn(window, 'alert').mockImplementation(() => {});

    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    vi.spyOn(window, 'prompt').mockImplementation(() => '');

  });



  afterEach(() => {

    vi.restoreAllMocks();

  });



  it('cho phép chuyển chế độ và cập nhật điểm dự kiến theo cấu hình', async () => {

    render(

      <KPIAdjustments

        currentUser={{ username: 'admin', permissions: { adjustApprove: true, adjustSubmit: true } }}

      />

    );



    await screen.findByText('Thêm điểm KPI +/-');



    const categorySelect = screen.getByLabelText('Hạng mục');

    await userEvent.selectOptions(categorySelect, 'support_misc');



    const modeSelect = screen.getByLabelText('Chế độ tính điểm');

    expect(modeSelect.value).toBe('dynamic');



    const quantityInput = screen.getByLabelText('Số lượng');

    await userEvent.clear(quantityInput);

    await userEvent.type(quantityInput, '5');



    const totalValue = screen.getByTestId('kpi-adjust-total-value');

    await waitFor(() => expect(totalValue).toHaveTextContent('1,0'));



    await userEvent.selectOptions(modeSelect, 'fixed');

    await waitFor(() => expect(totalValue).toHaveTextContent('12,0'));



    await userEvent.selectOptions(categorySelect, 'license_support');

    const licenseInput = screen.getByLabelText('Mã giấy phép');

    await userEvent.clear(licenseInput);

    await userEvent.type(licenseInput, 'ZB03');

    const unitInput = screen.getByLabelText('Điểm mỗi đơn vị');

    expect(unitInput).toHaveValue(2.8);

  });



  it('mở dialog hướng dẫn và xem chi tiết điểm hiện có', async () => {

    render(

      <KPIAdjustments

        currentUser={{ username: 'leader', permissions: { adjustApprove: true, adjustSubmit: true } }}

      />

    );



    const listHeadings = await screen.findAllByText('Danh sách điểm KPI +/-');

    expect(listHeadings.length).toBeGreaterThan(0);



    const guidanceButtons = screen.getAllByRole('button', { name: 'Hướng dẫn' });

    expect(guidanceButtons.length).toBeGreaterThan(0);

    await userEvent.click(guidanceButtons[0]);

    const supportMiscTable = await screen.findByRole('table', { name: 'Hướng dẫn: Hỗ trợ khác' });

    const supportMiscQueries = within(supportMiscTable);

    expect(supportMiscQueries.getByText('Hỗ trợ khác')).toBeInTheDocument();

    expect(supportMiscQueries.getByText('0,20', { exact: false })).toBeInTheDocument();

    expect(supportMiscQueries.getAllByText('Tuỳ chỉnh').length).toBeGreaterThan(0);

    expect(supportMiscQueries.getByText(/Chế độ: Linh hoạt theo số lượng/i)).toBeInTheDocument();

    expect(

      supportMiscQueries.getByText('Đang áp dụng cấu hình tuỳ chỉnh của đơn vị.')

    ).toBeInTheDocument();

    const licenseTable = screen.getByRole('table', { name: 'Hướng dẫn: Hỗ trợ giấy phép' });

    const licenseQueries = within(licenseTable);

    expect(licenseQueries.getByText('Hỗ trợ xin giấy phép')).toBeInTheDocument();

    expect(licenseQueries.getByText('ZB03')).toBeInTheDocument();

    expect(licenseQueries.getByText('2,80', { exact: false })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Đã rõ' }));



    const detailButtons = await screen.findAllByRole('button', { name: 'Chi tiết' });

    expect(detailButtons.length).toBeGreaterThan(0);

    await userEvent.click(detailButtons[0]);

    await screen.findByText('Chi tiết mục điểm');

    const detailDialog = screen.getByTestId('kpi-adjust-detail-dialog');

    const dialogQueries = within(detailDialog);

    expect(dialogQueries.getByText('Lan')).toBeInTheDocument();

    expect(dialogQueries.getByText('Điểm cố định thử nghiệm')).toBeInTheDocument();

  });

});

