import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import userEvent from '@testing-library/user-event';

import KPIAdjustments from '@/components/KPIAdjustments.tsx';
import { AppDialogProvider } from '@/hooks/useAppDialog.tsx';

import {

  KPI_ADJUSTMENTS_KEY,

  KPI_ADJUSTMENT_SETTINGS_KEY,

  TEAM_KEY,

  DECL_KEY,

  getKpiAdjustments,

  saveKpiAdjustment,

} from '@/lib/store.js';

import { clearStorageCache, setItem as sharedSetItem } from '@/lib/storageClient.js';

vi.mock('@/lib/storageClient.js', async () => {
  const actual = await vi.importActual('@/lib/storageClient.js');
  return {
    ...actual,
    setItem: vi.fn(async (key, value) => {
      actual.updateCachedItem(key, value);
      return value;
    }),
  };
});



async function openAdjustmentFormIfCollapsed(expectedFieldId = 'kpi-adjust-staff') {
  if (document.getElementById(expectedFieldId)) {
    return;
  }

  let openButton = null;
  await waitFor(() => {
    if (document.getElementById(expectedFieldId)) {
      return;
    }
    const toggles = Array.from(document.querySelectorAll('button[aria-expanded]'));
    openButton = toggles.find((button) => /(form|kpi\.form|mở)/i.test(button.textContent || '')) || null;
    expect(openButton).toBeTruthy();
  });

  if (document.getElementById(expectedFieldId)) {
    return;
  }

  expect(openButton).toBeTruthy();

  if (openButton.getAttribute('aria-expanded') === 'false') {
    await userEvent.click(openButton);
  }
  await waitFor(() => expect(document.getElementById(expectedFieldId)).toBeTruthy());
}

function getFormInputById(id) {
  const element = document.getElementById(id);
  expect(element).toBeTruthy();
  return element;
}

async function findListTab() {
  return screen.findByRole('tab', { name: /danh sách|lịch sử|list/i });
}

function findSelectByOptionValue(value) {
  const candidateValues = Array.isArray(value) ? value : [value];
  const selects = screen.getAllByRole('combobox');
  const matched = selects.find((select) =>
    Array.from(select.querySelectorAll('option')).some((option) =>
      candidateValues.some((candidate) => option.value === candidate || option.value.includes(candidate))
    )
  );
  expect(matched).toBeTruthy();
  return matched;
}


describe('KPIAdjustments UI', () => {

  beforeEach(() => {

    const now = new Date();

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    window.localStorage.clear();
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

    vi.spyOn(window, 'alert').mockImplementation(() => { });

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
    window.localStorage.clear();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();

  });



  it.skip('tự động điền tên nhân viên và tổ đội theo tài khoản hiện tại', async () => {

    render(

      <AppDialogProvider><KPIAdjustments

        currentUser={{

          username: 'binh.staff',

          memberName: 'Bình',

          teamName: '',

          permissions: { adjustSubmit: true },

        }}

      /></AppDialogProvider>

    );

    await openAdjustmentFormIfCollapsed();

    await waitFor(() => expect(getFormInputById('kpi-adjust-staff')).toBeTruthy());
    const staffInput = getFormInputById('kpi-adjust-staff');

    expect(staffInput).toHaveValue('Bình');


    const teamInput = getFormInputById('kpi-adjust-team');

    expect(teamInput).toHaveValue('Team 1');

  });



  it('quan ly co the bat duyet tu dong', async () => {

    render(

      <AppDialogProvider><KPIAdjustments

        currentUser={{ username: 'manager', permissions: { adjustApprove: true, adjustSubmit: true } }}

      /></AppDialogProvider>

    );

    const toggle = await screen.findByTestId('auto-approve-toggle');

    expect(toggle).toHaveAttribute('aria-pressed', 'false');


    await userEvent.click(toggle);



    const toggledButton = await screen.findByTestId('auto-approve-toggle');
    expect(toggledButton).toHaveAttribute('aria-pressed', 'true');
    expect(toggledButton.textContent || '').toMatch(/tắt duyệt tự động|tat duyet tu dong|kpi\.form\.autoapproveon/i);


    expect(screen.getByText(/duyệt tự động đang bật|duyet tu dong dang bat/i)).toBeInTheDocument();

  });



  it.skip('tra cuu duoc to khai 12 chu so tu file ECUS va them vao tham chieu', async () => {

    render(

      <AppDialogProvider><KPIAdjustments

        currentUser={{ username: 'staff.ecus', permissions: { adjustSubmit: true } }}

      /></AppDialogProvider>

    );

    await openAdjustmentFormIfCollapsed('kpi-adjust-references');


    const declarationSectionLabel = await screen.findByText(/tra cứu tờ khai|kpi\.form\.declarationsearch/i);
    const declarationSection = declarationSectionLabel.closest('div');
    expect(declarationSection).toBeTruthy();
    const searchInput = within(declarationSection).getByRole('textbox');

    await userEvent.clear(searchInput);

    await userEvent.type(searchInput, '307871769240');



    const suggestionText = await screen.findByText('307871769240', { selector: 'div' });

    const suggestionContainer = suggestionText.parentElement?.parentElement;

    expect(suggestionContainer).toBeTruthy();



    const addButton = within(suggestionContainer).getByRole('button', { name: 'Thêm' });

    await userEvent.click(addButton);



    const referenceInput = getFormInputById('kpi-adjust-references');

    await waitFor(() => expect(referenceInput).toHaveValue('307871769240'));

  });


  it('giữ trống trường nhân viên khi tài khoản chưa gán nhân viên', async () => {

    render(

      <AppDialogProvider><KPIAdjustments currentUser={{ username: 'khach', permissions: { adjustSubmit: true } }} /></AppDialogProvider>

    );

    await openAdjustmentFormIfCollapsed('kpi-adjust-category');

    await waitFor(() => expect(getFormInputById('kpi-adjust-staff')).toBeTruthy());
    const staffInput = getFormInputById('kpi-adjust-staff');

    expect(staffInput).toHaveValue('');


    const teamInput = getFormInputById('kpi-adjust-team');

    expect(teamInput).toHaveValue('');

  });



  it('vô hiệu hóa nút gửi đề xuất khi tài khoản không có quyền', async () => {

    render(<AppDialogProvider><KPIAdjustments currentUser={{ username: 'guest', permissions: { adjustSubmit: false } }} /></AppDialogProvider>);

    const submitButton = screen.queryByRole('button', { name: /Thêm điểm KPI|kpi\.form\.submit/i });
    if (submitButton) {
      expect(submitButton).toBeDisabled();
    } else {
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    }

  });


  it.skip('cho phép chuyển chế độ và cập nhật điểm dự kiến theo cấu hình', async () => {

    render(

      <AppDialogProvider><KPIAdjustments

        currentUser={{ username: 'admin', permissions: { adjustApprove: true, adjustSubmit: true } }}

      /></AppDialogProvider>

    );

    await openAdjustmentFormIfCollapsed('kpi-adjust-category');
    await waitFor(() => expect(screen.getByTestId('kpi-adjust-active-settings')).toBeInTheDocument());



    const categorySelect = getFormInputById('kpi-adjust-category');

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

    const unitInput = getFormInputById('kpi-adjust-unitpoints');

    expect(unitInput).toHaveValue(2.8);

  });

  it('cho phép mở nhanh cấu hình của hạng mục đang chọn ngay từ form', async () => {

    render(

      <AppDialogProvider><KPIAdjustments

        currentUser={{ username: 'admin', permissions: { adjustApprove: true, adjustSubmit: true } }}

      /></AppDialogProvider>

    );



    await openAdjustmentFormIfCollapsed('kpi-adjust-category');

    const categorySelect = getFormInputById('kpi-adjust-category');

    await userEvent.selectOptions(categorySelect, 'support_misc');



    const settingsSummary = screen.getByTestId('kpi-adjust-active-settings');

    expect(within(settingsSummary).getByText('Cấu hình đang áp dụng')).toBeInTheDocument();

    expect(within(settingsSummary).getByText('Chế độ mặc định')).toBeInTheDocument();



    await userEvent.click(within(settingsSummary).getByRole('button', { name: 'Chỉnh cấu hình hạng mục này' }));



    const focusBanner = await screen.findByTestId('kpi-adjust-settings-focus-banner');

    expect(focusBanner).toHaveTextContent('Đang chỉnh nhanh cho: Hỗ trợ khác');

  });

  it.skip('không cho phép nhân viên chỉnh sửa điểm chuẩn khi thiếu quyền override', async () => {

    render(

      <AppDialogProvider><KPIAdjustments currentUser={{ username: 'staff', permissions: { adjustSubmit: true } }} /></AppDialogProvider>

    );

    await openAdjustmentFormIfCollapsed('kpi-adjust-category');

    const categorySelect = getFormInputById('kpi-adjust-category');

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

  it.skip('cho phép chỉnh sửa điểm support_misc dù không có quyền override', async () => {

    render(

      <AppDialogProvider><KPIAdjustments currentUser={{ username: 'staff', permissions: { adjustSubmit: true } }} /></AppDialogProvider>

    );

    await openAdjustmentFormIfCollapsed('kpi-adjust-unitpoints');

    const unitInput = getFormInputById('kpi-adjust-unitpoints');

    expect(unitInput).not.toHaveAttribute('readonly');

    await userEvent.clear(unitInput);

    await userEvent.type(unitInput, '0.5');

    await waitFor(() => expect(unitInput).toHaveValue(0.5));


  });



  it.skip('mở dialog hướng dẫn và xem chi tiết điểm hiện có', async () => {

    render(

      <AppDialogProvider><KPIAdjustments

        currentUser={{ username: 'leader', permissions: { adjustApprove: true, adjustSubmit: true } }}

      /></AppDialogProvider>

    );



    const historyTab = await screen.findByRole('tab', { name: 'Lịch sử' });
    await userEvent.click(historyTab);

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

    const firstRender = render(<AppDialogProvider><KPIAdjustments currentUser={approverUser} /></AppDialogProvider>);

    await userEvent.click(await findListTab());

    await screen.findByText(/danh sách điểm kpi \+\/-/i);

    const statusSelect = findSelectByOptionValue('approved');
    await userEvent.selectOptions(statusSelect, 'approved');

    await waitFor(() => expect(screen.getByRole('cell', { name: 'Bình' })).toBeInTheDocument());


    firstRender.unmount();

    render(<AppDialogProvider><KPIAdjustments currentUser={approverUser} /></AppDialogProvider>);

    await userEvent.click(await findListTab());

    expect(findSelectByOptionValue('approved')).toHaveValue('approved');

    expect(await screen.findByRole('cell', { name: 'Bình' })).toBeInTheDocument();
  });

  it.skip('phân trang danh sách và khôi phục số dòng mỗi trang sau khi mở lại', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    Array.from({ length: 18 }, (_, index) => index + 1).forEach((index) => {
      saveKpiAdjustment(
        {
          category: 'support_misc',
          month: currentMonth,
          staffName: 'Lan',
          teamName: 'Team 1',
          companyName: `Công ty ${index}`,
          taxCode: `01000000${String(index).padStart(2, '0')}`,
          note: `Dòng ${index}`,
          references: ['TK001'],
          quantity: 1,
          unitPoints: 1,
          mode: 'fixed',
          status: 'pending',
        },
        { actor: 'seed', permissions: { adjustApprove: true } }
      );
    });

    const approverUser = {
      username: 'manager.pagination',
      permissions: { adjustApprove: true, adjustSubmit: true },
    };

    const firstRender = render(<AppDialogProvider><KPIAdjustments currentUser={approverUser} /></AppDialogProvider>);

    const historyTab = await screen.findByRole('tab', { name: 'Lịch sử' });
    await userEvent.click(historyTab);

    expect(await screen.findByText('Hiển thị 1-15 / 19 mục')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));

    expect(await screen.findByText('Hiển thị 16-19 / 19 mục')).toBeInTheDocument();
    expect(screen.getByText('Trang 2 / 2')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Số dòng mỗi trang'), '30');

    expect(await screen.findByText('Hiển thị 1-19 / 19 mục')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();

    firstRender.unmount();

    render(<AppDialogProvider><KPIAdjustments currentUser={approverUser} /></AppDialogProvider>);

    const historyTab2 = await screen.findByRole('tab', { name: 'Lịch sử' });
    await userEvent.click(historyTab2);

    expect(await screen.findByLabelText('Số dòng mỗi trang')).toHaveValue('30');
    expect(screen.getByText('Hiển thị 1-19 / 19 mục')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  });

  it.skip('duyệt hàng loạt các mục đã chọn trong trang hiện tại', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const secondEntry = saveKpiAdjustment(
      {
        category: 'support_misc',
        month: currentMonth,
        staffName: 'Bình',
        teamName: 'Team 1',
        note: 'Chờ duyệt hàng loạt',
        references: ['TK002'],
        quantity: 1,
        unitPoints: 2,
        mode: 'fixed',
        status: 'pending',
      },
      { actor: 'seed', permissions: { adjustApprove: true } }
    );

    render(
      <AppDialogProvider><KPIAdjustments
        currentUser={{ username: 'manager.bulk', permissions: { adjustApprove: true, adjustSubmit: true } }}
      /></AppDialogProvider>
    );

    const historyTab = await screen.findByRole('tab', { name: 'Lịch sử' });
    await userEvent.click(historyTab);

    await screen.findByText('Danh sách điểm KPI +/-');

    const rowCheckboxes = screen.getAllByRole('checkbox', { name: /Chọn mục điểm/i });
    expect(rowCheckboxes.length).toBeGreaterThan(1);

    await userEvent.click(rowCheckboxes[0]);
    await userEvent.click(rowCheckboxes[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Duyệt đã chọn (2)' }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Bạn có chắc chắn muốn duyệt 2 mục điểm KPI bổ sung đã chọn?'
    );

    await waitFor(() => {
      const updatedItems = getKpiAdjustments().filter((item) => item.id === secondEntry.id || item.staffName === 'Lan');
      expect(updatedItems).toHaveLength(2);
      expect(updatedItems.every((item) => item.status === 'approved')).toBe(true);
    });

    expect(screen.getByText('Chưa chọn mục nào để xử lý hàng loạt')).toBeInTheDocument();
  });

  it.skip('từ chối hàng loạt các mục đã chọn với cùng ghi chú', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const secondEntry = saveKpiAdjustment(
      {
        category: 'support_misc',
        month: currentMonth,
        staffName: 'Bình',
        teamName: 'Team 1',
        note: 'Từ chối hàng loạt',
        references: ['TK002'],
        quantity: 1,
        unitPoints: 2,
        mode: 'fixed',
        status: 'pending',
      },
      { actor: 'seed', permissions: { adjustApprove: true } }
    );

    window.prompt.mockReturnValue('Thiếu chứng từ');

    render(
      <AppDialogProvider><KPIAdjustments
        currentUser={{ username: 'manager.bulk', permissions: { adjustApprove: true, adjustSubmit: true } }}
      /></AppDialogProvider>
    );

    const historyTab = await screen.findByRole('tab', { name: 'Lịch sử' });
    await userEvent.click(historyTab);

    await screen.findByText('Danh sách điểm KPI +/-');

    const rowCheckboxes = screen.getAllByRole('checkbox', { name: /Chọn mục điểm/i });
    await userEvent.click(rowCheckboxes[0]);
    await userEvent.click(rowCheckboxes[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Từ chối đã chọn (2)' }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Bạn có chắc chắn muốn từ chối 2 mục điểm KPI bổ sung đã chọn?'
    );
    expect(window.prompt).toHaveBeenCalledWith(
      'Nhập lý do từ chối cho các mục đã chọn (tuỳ chọn)',
      ''
    );

    await waitFor(() => {
      const updatedItems = getKpiAdjustments().filter((item) => item.id === secondEntry.id || item.staffName === 'Lan');
      expect(updatedItems).toHaveLength(2);
      expect(updatedItems.every((item) => item.status === 'rejected')).toBe(true);
      expect(updatedItems.every((item) => item.history.at(-1)?.detail === 'Thiếu chứng từ')).toBe(true);
    });

    expect(screen.getByText('Chưa chọn mục nào để xử lý hàng loạt')).toBeInTheDocument();
  });

});

