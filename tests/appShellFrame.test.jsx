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

describe('AppShellFrame', () => {
  afterEach(() => {
    cleanup();
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

    expect(screen.getByText('KPI Control Center')).toBeInTheDocument();
    expect(screen.getAllByText('Hieu suat')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /Bao cao KPI/i })).toBeInTheDocument();
    expect(screen.getByText(/Nguoi dung admin/i)).toBeInTheDocument();
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
});
