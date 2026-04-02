import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

const REPORT_CENTER_MODULE_PATH = '@/components/workflows/ReportCenterPanel.jsx';

const baseAuth = {
  username: 'admin',
  role: 'admin',
  permissions: {
    accountManage: true,
    auditView: true,
    reportsExport: true,
  },
};

async function renderCalculatorWithReportCenterStub(
  factory,
  props = {},
) {
  vi.doMock(REPORT_CENTER_MODULE_PATH, () => ({
    default: factory,
  }));

  const { default: KPICalculator } = await import('@/components/KPICalculator.jsx');

  return render(
    <KPICalculator
      auth={baseAuth}
      activeTab="reports"
      {...props}
    />,
  );
}

describe('KPICalculator navigation and loading fallbacks', () => {
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
    vi.resetModules();
    vi.doUnmock(REPORT_CENTER_MODULE_PATH);
  });

  it('hiển thị loading status khi report center vẫn đang suspend', async () => {
    await renderCalculatorWithReportCenterStub(function ReportCenterPanelSuspenseStub() {
      throw new Promise(() => {});
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Đang tải Báo cáo KPI');
  });

  it('fallback focus về tab root khi target report export chưa mount', async () => {
    vi.useFakeTimers();

    await renderCalculatorWithReportCenterStub(
      function ReportCenterPanelSuspenseStub() {
        throw new Promise(() => {});
      },
      {
        navigationIntent: { tab: 'reports', focus: 'export' },
      },
    );

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải Báo cáo KPI');

    const reportsRoot = document.getElementById('app-tab-root-reports');

    expect(reportsRoot).not.toBeNull();

    await act(async () => {
      await Promise.resolve();
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(reportsRoot).toHaveFocus();
  });
});
