import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKpiShellState } from '@/components/appShell/useKpiShellState.js';

function ShellStateHarness({
  activeTab = 'dashboard',
  currentUser,
  navigationIntent = null,
  onTabChange = vi.fn(),
}) {
  const state = useKpiShellState({
    activeTab,
    currentUser,
    navigationIntent,
    onTabChange,
  });

  return (
    <div>
      <div id="app-tab-root-dashboard" tabIndex={-1}>
        dashboard-root
      </div>
      <div id="app-tab-root-reports" tabIndex={-1}>
        reports-root
      </div>
      <output data-testid="tab-value">{state.tabValue}</output>
      <output data-testid="loaded-tabs">{Array.from(state.loadedTabs).join(',')}</output>
      <output data-testid="section-id">{state.currentSection?.id || ''}</output>
      <button type="button" onClick={() => state.requestTabNavigation('reports', 'export')}>
        go-reports-export
      </button>
    </div>
  );
}

describe('useKpiShellState', () => {
  const guestUser = { username: 'guest', role: 'viewer', permissions: {} };
  const adminUser = {
    username: 'admin',
    role: 'admin',
    permissions: {
      accountManage: true,
      auditView: true,
      reportsExport: true,
    },
  };

  beforeEach(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }

    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('chuẩn hóa tab bị khóa về dashboard fallback', () => {
    render(<ShellStateHarness activeTab="accounts" currentUser={guestUser} />);

    expect(screen.getByTestId('tab-value')).toHaveTextContent('dashboard');
    expect(screen.getByTestId('loaded-tabs')).toHaveTextContent('dashboard');
    expect(screen.getByTestId('section-id')).toHaveTextContent('overview');
  });

  it('điều hướng sang tab khác và giữ loaded set mở rộng', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <ShellStateHarness
        activeTab="dashboard"
        currentUser={adminUser}
        onTabChange={onTabChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /go-reports-export/i }));

    expect(onTabChange).toHaveBeenCalledWith('reports');
    expect(screen.getByTestId('tab-value')).toHaveTextContent('reports');
    expect(screen.getByTestId('loaded-tabs')).toHaveTextContent('dashboard,reports');
  });

  it('fallback focus về tab root khi target workflow chưa mount', async () => {
    vi.useFakeTimers();

    render(
      <ShellStateHarness
        activeTab="reports"
        currentUser={adminUser}
        navigationIntent={{ tab: 'reports', focus: 'export' }}
      />,
    );

    const reportsRoot = document.getElementById('app-tab-root-reports');
    expect(reportsRoot).not.toBeNull();

    await act(async () => {
      await Promise.resolve();
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(screen.getByTestId('tab-value')).toHaveTextContent('reports');
    expect(reportsRoot).toHaveFocus();
  });
});
