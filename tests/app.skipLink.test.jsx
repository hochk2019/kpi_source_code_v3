import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/KPICalculator.tsx', () => ({
  default: function KPICalculatorStub() {
    return <div>Dashboard stub</div>;
  },
}));

vi.mock('@/components/Login.jsx', () => ({
  default: function LoginStub() {
    return <div>Login stub</div>;
  },
}));

vi.mock('@/components/ChangePasswordDialog.jsx', () => ({
  default: function ChangePasswordDialogStub() {
    return <div>Change password stub</div>;
  },
}));

vi.mock('@/components/SupportCenter.jsx', () => ({
  default: function SupportCenterStub() {
    return <button type="button">Support center</button>;
  },
}));

vi.mock('@/components/ThemeToggle.jsx', () => ({
  default: function ThemeToggleStub() {
    return <button type="button">Theme</button>;
  },
}));

vi.mock('@/components/NotificationCenter.tsx', () => ({
  default: function NotificationCenterStub() {
    return <button type="button">Notifications</button>;
  },
}));

vi.mock('@/components/CommandCenter.tsx', () => ({
  default: function CommandCenterStub() {
    return <button type="button">Command center</button>;
  },
}));

vi.mock('@/auth/localAuth.js', () => ({
  getAuth: vi.fn(() => null),
  getViewerAuth: vi.fn(() => ({
    username: 'guest',
    name: 'Guest',
    role: 'viewer',
    permissions: {},
  })),
  loadSession: vi.fn(async () => null),
  logout: vi.fn(async () => null),
}));

vi.mock('@/lib/storageClient.js', () => ({
  clearStorageCache: vi.fn(),
  getSyncStatus: vi.fn(() => ({
    waitingForBackend: false,
    remoteEnabled: true,
    pendingWrites: 0,
    nextRetryAt: null,
    retryDelayMs: 0,
    lastError: '',
  })),
  initSharedStorage: vi.fn(async () => null),
  subscribeSyncStatus: vi.fn(() => () => {}),
}));

vi.mock('@/hooks/useTooltipTitles.js', () => ({
  default: vi.fn(() => {}),
}));

vi.mock('@/lib/commandBus.js', () => ({
  subscribeCommand: vi.fn(() => () => {}),
}));

import App from '@/App.tsx';
import { getAuth, getViewerAuth, loadSession, logout } from '@/auth/localAuth.js';
import {
  clearStorageCache,
  getSyncStatus,
  initSharedStorage,
  subscribeSyncStatus,
} from '@/lib/storageClient.js';
import useTooltipTitles from '@/hooks/useTooltipTitles.js';
import { subscribeCommand } from '@/lib/commandBus.js';

describe('App skip link', () => {
  beforeEach(() => {
    getAuth.mockReturnValue(null);
    getViewerAuth.mockReturnValue({
      username: 'guest',
      name: 'Guest',
      role: 'viewer',
      permissions: {},
    });
    loadSession.mockResolvedValue(null);
    logout.mockResolvedValue(null);

    clearStorageCache.mockImplementation(() => {});
    getSyncStatus.mockReturnValue({
      waitingForBackend: false,
      remoteEnabled: true,
      pendingWrites: 0,
      nextRetryAt: null,
      retryDelayMs: 0,
      lastError: '',
    });
    initSharedStorage.mockResolvedValue(null);
    subscribeSyncStatus.mockReturnValue(() => {});
    subscribeCommand.mockReturnValue(() => {});
    useTooltipTitles.mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a skip link that targets the main content region', () => {
    render(<App />);

    const skipLink = screen.getByRole('link', { name: /Bỏ qua tới nội dung chính/i });
    const main = screen.getByRole('main');

    expect(skipLink).toHaveAttribute('href', '#app-main-content');
    expect(main).toHaveAttribute('id', 'app-main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus to main content when skip link is activated from keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);

    const skipLink = screen.getByRole('link', { name: /Bỏ qua tới nội dung chính/i });
    const main = screen.getByRole('main');

    await user.tab();
    expect(skipLink).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(main).toHaveFocus();
  });
});
