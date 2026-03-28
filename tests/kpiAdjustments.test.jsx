import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
        { so_tk_full: '307871769240', date: '2025-01-03', nhanh: '', cong_ty: 'Công ty C' },

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

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ raw: null }),
        text: async () => '',
      })
    );

  });



  afterEach(() => {

    cleanup();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();

  });



  it('tự động điền tên nhân viên và tổ đội theo tài khoản hiện tại', async () => {

    render(

      <KPIAdjustments

        currentUser={{

          username: 'binh.staff',

          memberName: 'Bình',

          teamName: '',

          permissions: { adjustSubmit: true },

        }}

      />

    );


    const staffInput = await screen.findByLabelText('Nhân viên');

    expect(staffInput).toHaveValue('Bình');


    const teamInput = screen.getByLabelText('Tổ đội');

    expect(teamInput).toHaveValue('Team 1');

  });



  it('quan ly co the bat duyet tu dong', async () => {

    render(

      <KPIAdjustments

        currentUser={{ username: 'manager', permissions: { adjustApprove: true, adjustSubmit: true } }}

      />

    );


    expect(await screen.findByText('Duyet tu dong dang tat')).toBeInTheDocument();


    const toggle = await screen.findByTestId('auto-approve-toggle');

    expect(toggle).toHaveAttribute('aria-pressed', 'false');


    await userEvent.click(toggle);



    const toggledButton = await screen.findByTestId('auto-approve-toggle');
    expect(toggledButton).toHaveAttribute('aria-pressed', 'true');
    expect(toggledButton).toHaveTextContent('Tat duyet tu dong');


    expect(screen.getByText(/Duyet tu dong dang bat/i)).toBeInTheDocument();

  });



  it('tra cuu duoc to khai 12 chu so tu file ECUS va them vao tham chieu', async () => {

    render(

      <KPIAdjustments

        currentUser={{ username: 'staff.ecus', permissions: { adjustSubmit: true } }}

      />

    );



    const searchInput = await screen.findByPlaceholderText('Tìm theo số tờ khai, MST hoặc tên công ty');

    await userEvent.clear(searchInput);

    await userEvent.type(searchInput, '307871769240');



    const suggestionText = await screen.findByText('307871769240', { selector: 'div' });

    const suggestionContainer = suggestionText.parentElement?.parentElement;

    expect(suggestionContainer).toBeTruthy();



    const addButton = within(suggestionContainer).getByRole('button', { name: 'Thêm' });

    await userEvent.click(addButton);



    const referenceInput = screen.getByLabelText('Tham chiếu tờ khai / quyết định');

    await waitFor(() => expect(referenceInput).toHaveValue('307871769240'));

  });


  it('giữ trống trường nhân viên khi tài khoản chưa gán nhân viên', async () => {

    render(

      <KPIAdjustments currentUser={{ username: 'khach', permissions: { adjustSubmit: true } }} />

    );


    const staffInput = await screen.findByLabelText('Nhân viên');

    expect(staffInput).toHaveValue('');


    const teamInput = screen.getByLabelText('Tổ đội');

    expect(teamInput).toHaveValue('');

  });



  it('vô hiệu hóa nút gửi đề xuất khi tài khoản không có quyền', async () => {

    render(<KPIAdjustments currentUser={{ username: 'guest', permissions: { adjustSubmit: false } }} />);

    await screen.findByText('Thêm điểm KPI +/-');

    const submitButton = await screen.findByRole('button', { name: /Thêm điểm KPI/i });

    expect(submitButton).toBeDisabled();

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

  it('không cho phép nhân viên chỉnh sửa điểm chuẩn khi thiếu quyền override', async () => {

    render(

      <KPIAdjustments currentUser={{ username: 'staff', permissions: { adjustSubmit: true } }} />

    );

    await screen.findAllByText('Thêm điểm KPI +/-');

    const categorySelect = screen.getByLabelText('Hạng mục');

    await userEvent.selectOptions(categorySelect, 'license_support');

    const licenseInput = screen.getByLabelText('Mã giấy phép');

    await userEvent.clear(licenseInput);

    await userEvent.type(licenseInput, 'ZB03');

    const unitInput = await screen.findByLabelText('Điểm mỗi đơn vị');

    await waitFor(() => expect(unitInput).toHaveValue(2.8));

    expect(unitInput).toHaveAttribute('readonly');

    fireEvent.change(unitInput, { target: { value: '9' } });

    await waitFor(() => expect(unitInput).toHaveValue(2.8));


  });

  it('cho phép chỉnh sửa điểm support_misc dù không có quyền override', async () => {

    render(

      <KPIAdjustments currentUser={{ username: 'staff', permissions: { adjustSubmit: true } }} />

    );

    await screen.findAllByText('Thêm điểm KPI +/-');

    const categorySelect = screen.getByLabelText('Hạng mục');

    await userEvent.selectOptions(categorySelect, 'support_misc');

    const unitInput = screen.getByLabelText('Điểm mỗi đơn vị');

    expect(unitInput).not.toHaveAttribute('readonly');

    await userEvent.clear(unitInput);

    await userEvent.type(unitInput, '0.5');

    await waitFor(() => expect(unitInput).toHaveValue(0.5));


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

    const guidanceDialog = await screen.findByRole('dialog', {

      name: 'Hướng dẫn nhập điểm KPI +/-',

    });

    const supportMiscTriggers = within(guidanceDialog).getAllByRole('button', {

      name: /hỗ trợ khác/i,

    });

    await userEvent.click(supportMiscTriggers[0]);

    expect(

      await within(guidanceDialog).findByText('Đang áp dụng cấu hình tuỳ chỉnh của đơn vị.')

    ).toBeInTheDocument();

    expect(within(guidanceDialog).getAllByText('Tuỳ chỉnh').length).toBeGreaterThan(0);

    const licenseTriggers = within(guidanceDialog).getAllByRole('button', {

      name: /hỗ trợ giấy phép/i,

    });

    expect(licenseTriggers.length).toBeGreaterThan(0);

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

  it('khôi phục bộ lọc danh sách theo user sau khi mở lại màn hình', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    saveKpiAdjustment(
      {
        category: 'support_misc',
        month: currentMonth,
        staffName: 'Bình',
        teamName: 'Team 1',
        note: 'Đã duyệt cho Bình',
        references: ['TK002'],
        quantity: 1,
        unitPoints: 12,
        mode: 'fixed',
        status: 'approved',
      },
      { actor: 'seed', permissions: { adjustApprove: true } }
    );

    const approverUser = {
      username: 'manager.persist',
      permissions: { adjustApprove: true, adjustSubmit: true },
    };

    const firstRender = render(<KPIAdjustments currentUser={approverUser} />);

    await screen.findByText('Danh sách điểm KPI +/-');

    await userEvent.selectOptions(screen.getByLabelText('Trạng thái'), 'approved');
    await userEvent.selectOptions(screen.getByLabelText('Lọc theo nhân viên'), 'binh');

    await waitFor(() => expect(screen.getByRole('cell', { name: 'Bình' })).toBeInTheDocument());
    expect(screen.queryByRole('cell', { name: 'Lan' })).not.toBeInTheDocument();

    firstRender.unmount();

    render(<KPIAdjustments currentUser={approverUser} />);

    expect(await screen.findByLabelText('Trạng thái')).toHaveValue('approved');
    expect(screen.getByLabelText('Lọc theo nhân viên')).toHaveValue('binh');
    expect(await screen.findByRole('cell', { name: 'Bình' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Lan' })).not.toBeInTheDocument();
  });

});

