import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { emitCommand, setTheme } = vi.hoisted(() => ({
  emitCommand: vi.fn(),
  setTheme: vi.fn(),
}));
const {
  getSharedItem,
  setSharedItem,
  subscribeSharedItem,
  emitSharedStorageChange,
} = vi.hoisted(() => {
  const listeners = new Map();

  return {
    getSharedItem: vi.fn(),
    setSharedItem: vi.fn(),
    subscribeSharedItem: vi.fn((key, listener) => {
      if (!listeners.has(key)) {
        listeners.set(key, new Set());
      }
      listeners.get(key).add(listener);
      return () => {
        listeners.get(key)?.delete(listener);
      };
    }),
    emitSharedStorageChange: (key) => {
      for (const listener of listeners.get(key) ?? []) {
        listener();
      }
    },
  };
});
const { listAccountsMock } = vi.hoisted(() => ({
  listAccountsMock: vi.fn(() => []),
}));

let commandSubscriber = () => {};

vi.mock('@/lib/commandBus.js', () => ({
  emitCommand,
  subscribeCommand: (handler) => {
    commandSubscriber = handler;
    return () => {
      commandSubscriber = () => {};
    };
  },
}));

vi.mock('@/designSystem/useTheme.js', () => ({
  useTheme: () => ({
    theme: 'system',
    resolvedTheme: 'light',
    setTheme,
  }),
}));

vi.mock('@/lib/storageClient.js', () => ({
  getItem: getSharedItem,
  setItem: setSharedItem,
  subscribe: subscribeSharedItem,
}));

vi.mock('@/auth/localAuth.js', () => ({
  listAccounts: listAccountsMock,
}));

import CommandCenter from '@/components/CommandCenter.tsx';

describe('CommandCenter navigation coverage', () => {
  beforeEach(() => {
    emitCommand.mockReset();
    setTheme.mockReset();
    getSharedItem.mockReset();
    setSharedItem.mockReset();
    subscribeSharedItem.mockClear();
    listAccountsMock.mockReset();
    listAccountsMock.mockReturnValue([]);
    commandSubscriber = () => {};
    window.localStorage?.clear?.();
  });

  afterEach(() => {
    cleanup();
  });

  it('không gợi ý tab bị khóa theo quyền truy cập', async () => {
    const user = userEvent.setup();

    render(<CommandCenter currentUser={{ username: 'guest', role: 'viewer', permissions: {} }} />);

    await user.click(screen.getByRole('textbox', { name: /tìm kiếm lệnh/i }));
    const dialog = screen.getByRole('dialog', { name: /command center/i });
    await user.type(
      within(dialog).getByRole('searchbox', { name: /tìm thao tác trong command center/i }),
      'nhật ký',
    );

    expect(screen.getByText(/không tìm thấy kết quả phù hợp/i)).toBeInTheDocument();
  });

  it('bao phủ các tab điều hướng mới qua command center', async () => {
    const user = userEvent.setup();
    const currentUser = {
      username: 'admin',
      role: 'admin',
      permissions: {
        accountManage: true,
        aiAssistManage: true,
        dataHealthManage: true,
      },
    };

    render(<CommandCenter currentUser={currentUser} />);

    await user.click(screen.getByRole('textbox', { name: /tìm kiếm lệnh/i }));
    const dialog = screen.getByRole('dialog', { name: /command center/i });

    const searchInput = within(dialog).getByRole('searchbox', {
      name: /tìm thao tác trong command center/i,
    });
    await user.type(searchInput, 'đại lý');

    const agencyCommand = within(dialog).getByText('Đi tới tab Đại Lý HQ').closest('[role="button"]');
    expect(agencyCommand).toBeTruthy();
    await user.click(agencyCommand);

    await waitFor(() => {
      expect(emitCommand).toHaveBeenCalledWith('navigate:tab', { tab: 'hq' });
    });

    await user.click(screen.getByRole('textbox', { name: /tìm kiếm lệnh/i }));
    const reopenedDialog = screen.getByRole('dialog', { name: /command center/i });

    const auditSearchInput = within(reopenedDialog).getByRole('searchbox', {
      name: /tìm thao tác trong command center/i,
    });
    await user.clear(auditSearchInput);
    await user.type(auditSearchInput, 'nhật ký');

    expect(await within(reopenedDialog).findByText('Đi tới tab Nhật ký')).toBeInTheDocument();
  });

  it('mở command center từ command bus launcher', async () => {
    render(<CommandCenter currentUser={{ username: 'guest', role: 'viewer', permissions: {} }} />);

    commandSubscriber('open:command-center', {});

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /command center/i })).toBeInTheDocument();
    });
  });

  it('gợi ý shortcut report workflow theo focus mục tiêu', async () => {
    const user = userEvent.setup();

    render(
      <CommandCenter
        currentUser={{ username: 'analyst', role: 'viewer', permissions: { reportsExport: true } }}
      />,
    );

    await user.click(screen.getByRole('textbox', { name: /tìm kiếm lệnh/i }));
    const dialog = screen.getByRole('dialog', { name: /command center/i });
    const searchInput = within(dialog).getByRole('searchbox', {
      name: /tìm thao tác trong command center/i,
    });

    await user.type(searchInput, 'phát hành');
    await user.click(within(dialog).getByText('Báo cáo KPI: phát hành & export').closest('[role="button"]'));

    await waitFor(() => {
      expect(emitCommand).toHaveBeenCalledWith('navigate:tab', { tab: 'reports', focus: 'export' });
    });
  });

  it('gợi ý người dùng khi tài khoản có quyền quản trị tài khoản', async () => {
    const user = userEvent.setup();
    listAccountsMock.mockReturnValue([
      {
        username: 'ops.lead',
        name: 'Trưởng nhóm Ops',
        role: 'manager',
        teamName: 'OPS',
        memberName: 'Nguyễn Minh',
      },
    ]);

    render(
      <CommandCenter
        currentUser={{ username: 'admin', role: 'admin', permissions: { accountManage: true } }}
      />,
    );

    await user.click(screen.getByRole('textbox', { name: /tìm kiếm lệnh/i }));
    const dialog = screen.getByRole('dialog', { name: /command center/i });
    const searchInput = within(dialog).getByRole('searchbox', {
      name: /tìm thao tác trong command center/i,
    });

    await user.type(searchInput, 'ops');

    expect(within(dialog).getByText('Người dùng: Trưởng nhóm Ops')).toBeInTheDocument();
    await user.click(within(dialog).getByText('Người dùng: Trưởng nhóm Ops').closest('[role="button"]'));

    await waitFor(() => {
      expect(emitCommand).toHaveBeenCalledWith('navigate:tab', { tab: 'accounts' });
    });
  });

  it('hydrate trạng thái ghim từ shared storage và ghi lại khi đổi pin', async () => {
    const user = userEvent.setup();
    const currentUser = {
      username: 'admin',
      role: 'admin',
      permissions: {
        accountManage: true,
        aiAssistManage: true,
        dataHealthManage: true,
      },
    };
    getSharedItem.mockImplementation((key) =>
      key === 'kpi_command_center_pins_v1' ? JSON.stringify(['navigate:hq']) : null,
    );

    render(<CommandCenter currentUser={currentUser} />);

    await user.click(screen.getByRole('textbox', { name: /tìm kiếm lệnh/i }));
    const dialog = screen.getByRole('dialog', { name: /command center/i });
    const searchInput = within(dialog).getByRole('searchbox', {
      name: /tìm thao tác trong command center/i,
    });
    await user.type(searchInput, 'đại lý');

    expect(within(dialog).getByRole('button', { name: /bỏ ghim thao tác/i })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /bỏ ghim thao tác/i }));

    expect(setSharedItem).toHaveBeenCalledWith('kpi_command_center_pins_v1', JSON.stringify([]));

    getSharedItem.mockImplementation((key) =>
      key === 'kpi_command_center_pins_v1' ? JSON.stringify([]) : null,
    );
    emitSharedStorageChange('kpi_command_center_pins_v1');

    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: /ghim thao tác/i })).toBeInTheDocument();
    });
  });
});
