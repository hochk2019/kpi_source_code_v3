import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { emitCommand, setTheme } = vi.hoisted(() => ({
  emitCommand: vi.fn(),
  setTheme: vi.fn(),
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

import CommandCenter from '@/components/CommandCenter.jsx';

describe('CommandCenter navigation coverage', () => {
  beforeEach(() => {
    emitCommand.mockReset();
    setTheme.mockReset();
    commandSubscriber = () => {};
    window.localStorage?.clear?.();
  });

  afterEach(() => {
    cleanup();
  });

  it('không gợi ý tab bị khóa theo quyền truy cập', async () => {
    const user = userEvent.setup();

    render(<CommandCenter currentUser={{ username: 'guest', role: 'viewer', permissions: {} }} />);

    await user.click(screen.getByRole('button', { name: /command center/i }));
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

    await user.click(screen.getByRole('button', { name: /command center/i }));
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

    await user.click(screen.getByRole('button', { name: /command center/i }));
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
});
