import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TabsContent } from '@/components/ui/tabs.jsx';
import AppShellFrame from '@/components/appShell/AppShellFrame.jsx';

const sections = [
  {
    id: 'operations',
    label: 'Van hanh',
    description: 'Nhap lieu va gan MST.',
    tabs: [
      {
        id: 'import',
        label: 'Import Data',
        tooltip: 'Nhap va dong bo du lieu to khai tu ECUS',
        commandDescription: 'Xu ly file XLSX va preview sync.',
      },
    ],
  },
  {
    id: 'performance',
    label: 'Hieu suat',
    description: 'Dashboard va dieu chinh KPI.',
    tabs: [
      {
        id: 'reports',
        label: 'Bao cao KPI',
        tooltip: 'Xem va xuat bao cao KPI tong hop',
        commandDescription: 'Dashboard tong hop va xuat bao cao theo ky.',
      },
      {
        id: 'adjustments',
        label: 'Diem KPI +/- Them',
        tooltip: 'Cong tru diem KPI bo sung theo thang',
        commandDescription: 'Dieu chinh diem KPI thu cong theo ky.',
      },
    ],
  },
];

function stubMatchMedia(matches) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('AppShellFrame', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('render sidebar groups and current workflow summary', () => {
    const onOpenCommandCenter = vi.fn();

    render(
      <AppShellFrame
        sections={sections}
        value="reports"
        onValueChange={vi.fn()}
        currentTab={sections[1].tabs[0]}
        currentSection={sections[1]}
        currentUser={{ username: 'admin', role: 'admin' }}
        workflowGuide={{
          headline: 'Workflow báo cáo KPI đã được tách riêng.',
          actions: [{ label: 'Mở dashboard KPI', onClick: vi.fn(), variant: 'primary' }],
          steps: [
            { number: 1, title: '1. Chốt phạm vi', detail: 'Khóa kỳ.', targetId: 'report-scope' },
          ],
        }}
        onOpenCommandCenter={onOpenCommandCenter}
      >
        <TabsContent value="reports">Dashboard KPI</TabsContent>
      </AppShellFrame>,
    );

    expect(screen.getByText('Bảng điều hành KPI')).toBeInTheDocument();
    expect(screen.getAllByText('Hieu suat').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('tab', { name: /Bao cao KPI/i })).toBeInTheDocument();
    expect(screen.getByText(/Người dùng admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Workflow Bao cao KPI/i)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard tong hop va xuat bao cao theo ky\./i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Command Center/i }).length).toBeGreaterThan(0);
  });

  it('forwards tab selection through sidebar triggers', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <AppShellFrame
        sections={sections}
        value="reports"
        onValueChange={onValueChange}
        currentTab={sections[1].tabs[0]}
        currentSection={sections[1]}
        currentUser={{ username: 'admin', role: 'admin' }}
      >
        <TabsContent value="reports">Dashboard KPI</TabsContent>
        <TabsContent value="adjustments">Adjustment Panel</TabsContent>
      </AppShellFrame>,
    );

    const [adjustmentsTab] = screen.getAllByRole('tab', { name: /Diem KPI \+\/- Them/i });

    await user.click(adjustmentsTab);

    expect(onValueChange).toHaveBeenCalledWith('adjustments');
  });

  it('collapses navigation groups into compact mode on small viewports', async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);

    render(
      <AppShellFrame
        sections={sections}
        value="reports"
        onValueChange={vi.fn()}
        currentTab={sections[1].tabs[0]}
        currentSection={sections[1]}
        currentUser={{ username: 'admin', role: 'admin' }}
      >
        <TabsContent value="reports">Dashboard KPI</TabsContent>
        <TabsContent value="adjustments">Adjustment Panel</TabsContent>
        <TabsContent value="import">Import Panel</TabsContent>
      </AppShellFrame>,
    );

    const shell = document.querySelector('.ds-app-shell__layout');
    expect(shell).toHaveAttribute('data-shell-layout', 'compact');
    expect(screen.getByText('3 module')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Import Data/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Bao cao KPI/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Van hanh/i }));

    expect(screen.getByRole('tab', { name: /Import Data/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Bao cao KPI/i })).not.toBeInTheDocument();
  });
});
