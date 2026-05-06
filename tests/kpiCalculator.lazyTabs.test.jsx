import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { getAppTabRootId } from '@/components/appShell/appShellWorkflowState.js';

let mstModuleLoadCount = 0;
let resolveAdjustmentsModule;

vi.mock('@/components/workflows/MSTWorkflowPanel.jsx', () => {
  mstModuleLoadCount += 1;

  return {
    default: function MSTWorkflowPanelStub() {
      return <div>MST workflow stub</div>;
    },
  };
});

vi.mock(
  '@/components/workflows/KPIAdjustmentsWorkflowPanel.jsx',
  () =>
    new Promise((resolve) => {
      resolveAdjustmentsModule = () =>
        resolve({
          default: function KPIAdjustmentsWorkflowPanelStub() {
            return <div>Adjustment workflow stub</div>;
          },
        });
    }),
);

vi.mock('@/components/workflows/ReportCenterPanel.jsx', () => ({
  default: function ReportCenterPanelStub() {
    return <div>Report center stub</div>;
  },
}));

import KPICalculator from '@/components/KPICalculator.tsx';

const adminAuth = {
  username: 'admin',
  role: 'admin',
  permissions: {
    importEdit: true,
    importUpload: true,
    mstEdit: true,
    rulesEdit: true,
    teamsEdit: true,
    accountManage: true,
    reportsExport: true,
    syncManage: true,
    alertsManage: true,
    auditView: true,
    aiAssistUse: true,
    dataHealthView: true,
    dataHealthManage: true,
  },
};

describe('KPICalculator lazy tab loading', () => {
  afterEach(() => {
    cleanup();
  });

  it('chỉ import tab MST sau khi người dùng chuyển sang tab đó', async () => {
    const view = render(<KPICalculator auth={adminAuth} activeTab="reports" />);

    expect(await screen.findByText('Report center stub')).toBeInTheDocument();
    expect(mstModuleLoadCount).toBe(0);

    view.rerender(<KPICalculator auth={adminAuth} activeTab="mst" />);

    expect(await screen.findByText('MST workflow stub')).toBeInTheDocument();
    expect(mstModuleLoadCount).toBe(1);
  });

  it('giu focus target va loading status san sang khi lazy tab dang resolve', async () => {
    const view = render(<KPICalculator auth={adminAuth} activeTab="reports" />);

    expect(await screen.findByText('Report center stub')).toBeInTheDocument();

    view.rerender(
      <KPICalculator
        auth={adminAuth}
        activeTab="adjustments"
        navigationIntent={{ tab: 'adjustments', focus: null }}
      />,
    );

    const panelRoot = document.getElementById(getAppTabRootId('adjustments'));

    expect(panelRoot).toBeInTheDocument();
    expect(panelRoot).toHaveAttribute('tabindex', '-1');
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Đang tải Điểm KPI \+\/- Thêm/,
    );

    await waitFor(() => {
      expect(panelRoot).toHaveFocus();
    });

    resolveAdjustmentsModule();

    expect(await screen.findByText('Adjustment workflow stub')).toBeInTheDocument();
  });
});
