import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/KPICalculator.tsx', () => ({
  default: function KPICalculatorStub({ activeTab }) {
    return <div data-testid="active-tab">{activeTab}</div>;
  },
}));

vi.mock('@/components/Login.jsx', () => ({
  default: function LoginStub() {
    return null;
  },
}));

vi.mock('@/components/ChangePasswordDialog.jsx', () => ({
  default: function ChangePasswordDialogStub() {
    return null;
  },
}));

vi.mock('@/components/SupportCenter.jsx', () => ({
  default: function SupportCenterStub() {
    return null;
  },
}));

vi.mock('@/components/ThemeToggle.jsx', () => ({
  default: function ThemeToggleStub() {
    return null;
  },
}));

vi.mock('@/components/NotificationCenter.tsx', () => ({
  default: function NotificationCenterStub() {
    return null;
  },
}));

vi.mock('@/components/CommandCenter.tsx', () => ({
  default: function CommandCenterStub() {
    return null;
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

import { loadSession } from '@/auth/localAuth.js';
import { subscribeCommand } from '@/lib/commandBus.js';
import { subscribeSyncStatus } from '@/lib/storageClient.js';
import App from '@/App.tsx';

describe('App shell URL state', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.mocked(loadSession).mockResolvedValue(null);
    vi.mocked(subscribeSyncStatus).mockReturnValue(() => {});
    vi.mocked(subscribeCommand).mockReturnValue(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('hydrates the active tab from the shell URL contract', async () => {
    window.history.replaceState({}, '', '/?section=operations&tab=import');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('import');
    });
  });

  it('normalizes invalid deep links back to the dashboard landing', async () => {
    window.history.replaceState({}, '', '/?section=governance&tab=accounts');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('dashboard');
    });

    expect(window.location.search).toContain('section=overview');
    expect(window.location.search).toContain('tab=dashboard');
  });
});
