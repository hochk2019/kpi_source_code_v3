import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { cleanup, render, screen, waitFor, within, fireEvent } from '@testing-library/react';

import userEvent from '@testing-library/user-event';

import React from 'react';



import MSTAssignment from '@/components/MSTAssignment.tsx';

import HQAgencyManager from '@/components/HQAgencyManager.tsx';

import ReportViewer from '@/components/ReportViewer.tsx';

import AccountManager from '@/components/AccountManager.tsx';
import { AppDialogProvider } from '@/hooks/useAppDialog.tsx';

import { clearStorageCache, setItem as sharedSetItem } from '@/lib/storageClient.js';

import { MST_KEY, MST_HISTORY_KEY, HQ_KEY, HQ_HISTORY_KEY, DECL_KEY, getMSTMap, getHQAgencies } from '@/lib/store.js';

import { seedSampleDeclarations } from '../packages/domain/src/sampleDeclarations.js';

import { installMockApi } from './helpers/mockApi.js';



vi.mock('@/lib/hqHistoryClient.js', () => ({

  fetchHQHistoryEntries: vi.fn(async () => ({ entries: [], total: 0, limit: 0 })),

  refreshHQHistoryCache: vi.fn(async () => []),

}));

// Mock Radix-based UI components to avoid composeRefs/Slot infinite loop in React 19 + JSDOM
// These mocks MUST be in the test file (not setupFiles) because vi.mock() is hoisted only in test files.

vi.mock('@/components/ui/button.tsx', () => ({
  Button: function MockButton({ children, onClick, onPointerDown, disabled, type, className, role, 'aria-label': ariaLabel, 'aria-expanded': ariaExpanded }) {
    return React.createElement('button', {
      onClick,
      onPointerDown,
      disabled,
      type: type || 'button',
      className,
      role,
      'aria-label': ariaLabel,
      'aria-expanded': ariaExpanded,
    }, children);
  },
  buttonVariants: () => '',
}));

vi.mock('@/components/ui/popover.tsx', () => ({
  Popover: function MockPopover({ children }) {
    return React.createElement('div', { 'data-testid': 'mock-popover' }, children);
  },
  PopoverTrigger: function MockPopoverTrigger({ children, asChild, onClick, onPointerDown }) {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: children.props.onClick || onClick,
        onPointerDown: children.props.onPointerDown || onPointerDown,
      });
    }
    return React.createElement('div', { 'data-testid': 'mock-popover-trigger', onClick, onPointerDown }, children);
  },
  PopoverContent: function MockPopoverContent({ children }) {
    return React.createElement('div', { 'data-testid': 'mock-popover-content' }, children);
  },
  PopoverAnchor: function MockPopoverAnchor({ children }) {
    return React.createElement('div', null, children);
  },
}));

vi.mock('@/components/ui/command.tsx', () => ({
  Command: ({ children }) => React.createElement('div', { 'data-testid': 'mock-command' }, children),
  CommandInput: function MockCommandInput({ value, onValueChange, placeholder }) {
    return React.createElement('input', {
      'data-testid': 'mock-command-input',
      value: value || '',
      placeholder,
      onChange: (e) => onValueChange && onValueChange(e.target.value),
    });
  },
  CommandList: ({ children }) => React.createElement('div', { 'data-testid': 'mock-command-list' }, children),
  CommandEmpty: ({ children }) => React.createElement('div', { 'data-testid': 'mock-command-empty' }, children),
  CommandGroup: ({ children }) => React.createElement('div', { 'data-testid': 'mock-command-group' }, children),
  CommandItem: function MockCommandItem({ children, onSelect, value }) {
    return React.createElement('div', {
      'data-testid': 'mock-command-item',
      'data-value': value,
      onClick: () => onSelect && onSelect(value),
    }, children);
  },
  CommandSeparator: () => React.createElement('hr', null),
  CommandShortcut: ({ children }) => React.createElement('span', null, children),
  CommandDialog: ({ children, open }) => open ? React.createElement('div', null, children) : null,
}));

vi.mock('@/components/shared/StaffCombobox.tsx', () => ({
  default: function MockStaffCombobox({ value, onSelect, ariaLabel, searchPlaceholder, disabled, teams }) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const displayValue = value || 'Chọn nhân viên';
    const searchTrimmed = search.trim();

    const allMembers = React.useMemo(() => {
      if (!teams || !Array.isArray(teams)) return [];
      const result = [];
      teams.forEach((team) => {
        const members = team.members || team.persons || [];
        members.forEach((m) => {
          result.push({ name: m.name || m, teamName: team.name || team });
        });
      });
      return result;
    }, [teams]);

    const filteredMembers = searchTrimmed
      ? allMembers.filter((m) => m.name.toLowerCase().includes(searchTrimmed.toLowerCase()))
      : allMembers;

    const showCustom = searchTrimmed && !allMembers.some((m) => m.name.toLowerCase() === searchTrimmed.toLowerCase());

    function handleToggle() {
      if (disabled) return;
      setOpen((v) => !v);
      setSearch('');
    }

    function handleSelectMember(name, teamName) {
      onSelect && onSelect({ staffName: name, teamName: teamName || '' });
      setOpen(false);
      setSearch('');
    }

    function handleCustom() {
      onSelect && onSelect({ staffName: searchTrimmed, teamName: '', isCustom: true });
      setOpen(false);
      setSearch('');
    }

    return React.createElement('div', { 'data-testid': 'mock-staff-combobox' },
      React.createElement('button', {
        type: 'button',
        role: 'combobox',
        'aria-label': ariaLabel || displayValue,
        'aria-expanded': open,
        disabled: !!disabled,
        // Only use onClick (not onPointerDown) to avoid double-toggle:
        // Test uses both fireEvent.pointerDown + fireEvent.click, both would call handleToggle
        // which would toggle open→closed→open, leaving closed. Use click only.
        onClick: handleToggle,
      }, displayValue),
      open ? React.createElement('div', { 'data-testid': 'mock-staff-combobox-popover' },
        React.createElement('input', {
          type: 'text',
          placeholder: searchPlaceholder || 'Tìm nhân viên',
          value: search,
          autoFocus: true,
          onChange: (e) => setSearch(e.target.value),
        }),
        showCustom ? React.createElement('div', {
          role: 'option',
          'data-testid': 'mock-custom-option',
          onClick: handleCustom,
        }, `Dùng giá trị "${searchTrimmed}"`) : null,
        ...filteredMembers.map((m, i) => React.createElement('div', {
          key: i,
          role: 'option',
          'data-testid': 'mock-member-option',
          onClick: () => handleSelectMember(m.name, m.teamName),
        }, m.name))
      ) : null
    );
  },
}));

const { mockAlert, mockConfirm } = vi.hoisted(() => ({
  mockAlert: vi.fn().mockResolvedValue(undefined),
  mockConfirm: vi.fn().mockResolvedValue(true)
}));

vi.mock('@/hooks/useAppDialog', () => ({
  useAppDialog: () => ({
    alert: mockAlert,
    confirm: mockConfirm
  }),
  AppDialogProvider: ({ children }) => <>{children}</>
}));



function ensureTestGlobals() {

  if (!globalThis.ResizeObserver) {

    vi.stubGlobal('ResizeObserver', class {

      observe() {}

      unobserve() {}

      disconnect() {}

    });

  }

  if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.scrollIntoView) {

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {

      configurable: true,

      value() {},

    });

  }

  if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {

    Object.defineProperty(Element.prototype, 'hasPointerCapture', {

      configurable: true,

      value() {
        return false;
      },

    });

  }

  if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {

    Object.defineProperty(Element.prototype, 'setPointerCapture', {

      configurable: true,

      value() {},

    });

  }

  if (typeof Element !== 'undefined' && !Element.prototype.releasePointerCapture) {

    Object.defineProperty(Element.prototype, 'releasePointerCapture', {

      configurable: true,

      value() {},

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
    cleanup();

  });



  it('thêm dòng mới và lưu vào bảng MST', async () => {

    const user = userEvent.setup();

    render(<AppDialogProvider><MSTAssignment canEdit currentUser={{ username: 'admin' }} /></AppDialogProvider>);



    await user.click(screen.getByRole('button', { name: /thêm mới/i }));
    const addFormSubmit = await screen.findByRole('button', { name: /thêm vào danh sách/i });
    const addForm = addFormSubmit.closest('form');
    const addFormScope = within(addForm ?? document.body);

    await user.type(addFormScope.getByLabelText('Mã số thuế'), '0312345678');

    await user.type(addFormScope.getByLabelText('Tên công ty'), 'Công ty Kim Liên');

    await user.type(addFormScope.getByLabelText('Tổ đội (tuỳ chọn)'), 'Tổ 1');

    const importStaffCombobox = addFormScope.getByRole('combobox', { name: 'Người phụ trách Nhập' });
    await user.click(importStaffCombobox);

    await user.type(addFormScope.getByPlaceholderText('Tìm nhân viên Nhập'), 'Minh Trí');
    await user.click(await addFormScope.findByText('Dùng giá trị "Minh Trí"'));

    // Wait for import combobox to close before opening export combobox
    await waitFor(() => expect(addFormScope.queryByText('Dùng giá trị "Minh Trí"')).not.toBeInTheDocument());

    const exportStaffCombobox = addFormScope.getByRole('combobox', { name: 'Người phụ trách Xuất' });
    await user.click(exportStaffCombobox);

    await user.type(addFormScope.getByPlaceholderText('Tìm nhân viên Xuất'), 'Ngọc Hà');
    await user.click(await addFormScope.findByText('Dùng giá trị "Ngọc Hà"'));

    fireEvent.change(addFormScope.getByLabelText('Áp dụng từ ngày'), {
      target: { value: '2025-01-01' },
    });



    await user.click(addFormSubmit);

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Đã thêm vào danh sách. Bấm Lưu để ghi vào hệ thống.'));



    await user.click(screen.getByRole('button', { name: /^lưu$/i }));

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Lưu thành công!'));



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

  }, 30000);

  it('lọc danh sách theo trạng thái nhân viên từ bộ lọc lịch sử', async () => {

    const user = userEvent.setup();

    sharedSetItem(
      MST_KEY,
      JSON.stringify([
        { mst: '0101010101', company: 'Công ty Đã Gán', person_import: 'Ngọc Trâm', person_export: 'Anh Khoa', team: 'Tổ A', effective_from: '2024-01-01' },
        { mst: '0202020202', company: 'Công ty Chưa Gán', person_import: '', person_export: '', team: '', effective_from: '2024-01-01' },
      ]),
    );

    // Seed history entries so the status-based history filter has data to work with.
    // rowKey format: `${mst}__${effective_from}__${effective_to}`
    sharedSetItem(
      MST_HISTORY_KEY,
      JSON.stringify([
        {
          id: 'hist-1',
          mst: '0101010101',
          field: 'status',
          from: 'Chưa gán nhân viên',
          to: 'Đã gán nhân viên',
          actor: 'admin',
          timestamp: '2024-01-02T00:00:00.000Z',
          rowKey: '0101010101__2024-01-01__',
          type: 'update',
          effective_from: '2024-01-01',
          effective_to: '',
        },
        {
          id: 'hist-2',
          mst: '0202020202',
          field: 'status',
          from: 'Đã gán nhân viên',
          to: 'Chưa gán nhân viên',
          actor: 'admin',
          timestamp: '2024-01-02T01:00:00.000Z',
          rowKey: '0202020202__2024-01-01__',
          type: 'update',
          effective_from: '2024-01-01',
          effective_to: '',
        },
      ]),
    );

    render(<AppDialogProvider><MSTAssignment canEdit currentUser={{ username: 'admin' }} /></AppDialogProvider>);

    await waitFor(() => {

      expect(screen.getByText('Công ty Đã Gán')).toBeInTheDocument();

      expect(screen.getByText('Công ty Chưa Gán')).toBeInTheDocument();

    });

    const historyFilterSection = screen.getByText('Bộ lọc lịch sử thay đổi').closest('section');
    const typeSelect = within(historyFilterSection ?? document.body).getByLabelText('Thao tác / Chuyển trạng thái');

    await user.selectOptions(typeSelect, 'status:assigned');

    await waitFor(() => {

      expect(screen.getByText('Công ty Đã Gán')).toBeInTheDocument();

      expect(screen.queryByText('Công ty Chưa Gán')).not.toBeInTheDocument();

    });

    await user.selectOptions(typeSelect, 'status:pending');

    await waitFor(() => {

      expect(screen.getByText('Công ty Chưa Gán')).toBeInTheDocument();

      expect(screen.queryByText('Công ty Đã Gán')).not.toBeInTheDocument();

    });

  });

});



describe('Luồng quản trị – Đại Lý HQ', () => {

  beforeEach(() => {

    ensureTestGlobals();

    clearStorageCache();

    sharedSetItem(HQ_KEY, JSON.stringify([]));

    sharedSetItem(HQ_HISTORY_KEY, JSON.stringify([]));

    sharedSetItem(DECL_KEY, JSON.stringify([]));
    
    mockAlert.mockClear();

  });



  afterEach(() => {

    vi.unstubAllGlobals();
    cleanup();

  });



  it('thêm dòng đại lý và lưu cấu hình', async () => {

    const user = userEvent.setup();

    render(<AppDialogProvider><HQAgencyManager canEdit currentUser={{ username: 'admin' }} /></AppDialogProvider>);

    await user.click(screen.getByRole('button', { name: /\+ thêm dòng/i }));

    const hqSection = screen.getByText('Danh sách Đại lý Hải quan').closest('section');
    const resolveDraftRowControls = () => {
      const agentInput = within(hqSection ?? document.body).queryByPlaceholderText('Ví dụ: Đại lý A, Đại lý B');
      const draftRow = agentInput?.closest('tr');
      if (!agentInput || !draftRow) {
        throw new Error('Không tìm thấy dòng đại lý có thể chỉnh sửa');
      }

      const textboxes = within(draftRow).queryAllByRole('textbox');
      if (textboxes.length < 2) {
        throw new Error('Không tìm thấy đầy đủ ô nhập MST và công ty');
      }

      const [mstInput, companyInput] = textboxes;
      return { mstInput, companyInput, agentInput };
    };

    await waitFor(() => {
      expect(resolveDraftRowControls().agentInput).toBeInTheDocument();
    });

    let { mstInput } = resolveDraftRowControls();

    fireEvent.change(mstInput, { target: { value: '0312345678' } });

    await waitFor(() => {
      ({ mstInput } = resolveDraftRowControls());
      expect(mstInput).toHaveValue('0312345678');
    });

    let { companyInput } = resolveDraftRowControls();

    fireEvent.change(companyInput, { target: { value: 'Công ty Hợp Tác' } });

    await waitFor(() => {
      ({ companyInput } = resolveDraftRowControls());
      expect(companyInput).toHaveValue('Công ty Hợp Tác');
    });

    let { agentInput } = resolveDraftRowControls();

    fireEvent.change(agentInput, { target: { value: 'AnExpress, BLogistics' } });

    await waitFor(() => {
      ({ agentInput } = resolveDraftRowControls());
      expect(agentInput).toHaveValue('AnExpress, BLogistics');
    });

    const saveBtn = screen.getByRole('button', { name: /lưu cấu hình/i });
    await user.click(saveBtn);

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Đã lưu cấu hình Đại lý HQ.'));



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

  }, 30000);

});



describe('Luồng quản trị – Báo Cáo KPI', () => {

  beforeEach(() => {

    ensureTestGlobals();

    clearStorageCache();

    seedSampleDeclarations({ actor: 'vitest', count: 24 });

    installMockApi();

    window.localStorage.setItem(

      'kpi_report_viewer_prefs_v1',

      JSON.stringify({ quickRange: 'all_time' })

    );

  });



  afterEach(() => {

    vi.unstubAllGlobals();
    cleanup();

  });



  it('hiển thị bảng tổng hợp và cho phép đổi khoảng thời gian', async () => {

    const user = userEvent.setup();

    render(

      <AppDialogProvider><div role="tabpanel" style={{ minWidth: 1024, minHeight: 640 }}>

        <ReportViewer canExport />

      </div></AppDialogProvider>,

    );



    await screen.findByText(/Khám phá phạm vi báo cáo/i);

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

  }, 30000);

});



describe('Luồng quản trị – Tài khoản', () => {

  let fetchMock;



  beforeEach(() => {

    ensureTestGlobals();

    clearStorageCache();

    fetchMock = installMockApi();

    mockAlert.mockClear();
    mockConfirm.mockClear();

    vi.stubGlobal('prompt', vi.fn(() => 'MatKhauMoi!'));

    vi.stubGlobal('confirm', vi.fn(() => true));

  });



  afterEach(() => {

    vi.unstubAllGlobals();
    cleanup();

  });



  it('tạo tài khoản mới từ giao diện quản trị', async () => {

    const user = userEvent.setup();

    render(<AppDialogProvider><AccountManager currentUser={{ username: 'admin' }} /></AppDialogProvider>);



    const createSection = screen.getByText('Tạo tài khoản mới').closest('section');

    await user.type(within(createSection ?? document.body).getByPlaceholderText('username'), 'tester');

    await user.type(within(createSection ?? document.body).getByPlaceholderText('Tên người dùng'), 'Tài khoản thử nghiệm');

    await user.type(within(createSection ?? document.body).getByPlaceholderText(/Ít nhất \d+ ký tự/), 'Tester@2025');

    const roleSelect = within(createSection ?? document.body).getAllByRole('combobox').at(-1);
    fireEvent.pointerDown(roleSelect);
    fireEvent.click(roleSelect);

    const staffOption = await screen.findByRole('option', { name: 'Quản lý' });
    fireEvent.click(staffOption);

    const createBtn = screen.getByRole('button', { name: /^tạo$/i });
    fireEvent.submit(createBtn.closest('form') || createBtn);

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Đã tạo tài khoản mới.'));

    await waitFor(() => expect(screen.getByText('tester')).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v4/auth/accounts'), expect.anything());

  }, 30000);

});

