import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AppDashboardLanding from '@/components/appShell/AppDashboardLanding.jsx';

const sections = [
  {
    id: 'overview',
    label: 'Tổng quan',
    description: 'Điểm vào mặc định.',
    tabs: [{ id: 'dashboard', label: 'Tổng quan KPI' }],
  },
  {
    id: 'operations',
    label: 'Vận hành',
    description: 'Nhập liệu và gán MST.',
    tabs: [
      { id: 'mst', label: 'Gán MST' },
      { id: 'import', label: 'Import Data' },
    ],
  },
  {
    id: 'performance',
    label: 'Hiệu suất',
    description: 'Báo cáo và điều chỉnh KPI.',
    tabs: [{ id: 'reports', label: 'Báo cáo KPI' }],
  },
];

describe('AppDashboardLanding', () => {
  it('hiển thị số liệu tổng quan và bản đồ module theo cụm', () => {
    render(
      <AppDashboardLanding
        currentUser={{ username: 'ops.lead', name: 'Trưởng nhóm Ops', role: 'manager' }}
        sections={sections}
        canUseAi
        canViewAudit
        canViewDataHealth
      />,
    );

    expect(screen.getByRole('heading', { name: /Tổng quan KPI/i })).toBeInTheDocument();
    expect(screen.getByText(/Trưởng nhóm Ops/i)).toBeInTheDocument();
    expect(screen.getByText('Cụm điều hướng')).toBeInTheDocument();
    expect(screen.getByText('Bề mặt hỗ trợ')).toBeInTheDocument();
    const moduleMap = screen.getAllByRole('region', { name: /Bản đồ module theo cụm/i })[0];
    expect(within(moduleMap).getByRole('button', { name: /^Import Data$/i })).toBeInTheDocument();
    expect(within(moduleMap).getByRole('button', { name: /^Báo cáo KPI$/i })).toBeInTheDocument();
  });

  it('đi nhanh tới workflow chính từ quick actions', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    const { container } = render(
      <AppDashboardLanding
        currentUser={{ username: 'ops.lead', name: 'Trưởng nhóm Ops', role: 'manager' }}
        sections={sections}
        onNavigate={onNavigate}
        canViewDataHealth
      />,
    );

    const quickActions = container.querySelector('.ds-dashboard__quick-actions');
    expect(quickActions).not.toBeNull();

    await user.click(within(quickActions).getByRole('button', { name: /Bắt đầu với Import dữ liệu/i }));
    expect(onNavigate).toHaveBeenCalledWith('import', 'source');

    await user.click(within(quickActions).getByRole('button', { name: /Kiểm tra sức khỏe dữ liệu/i }));
    expect(onNavigate).toHaveBeenCalledWith('health', 'sync');
  });

  it('hiển thị empty state khi không có module ngoài dashboard', async () => {
    const user = userEvent.setup();
    const onOpenCommandCenter = vi.fn();

    render(
      <AppDashboardLanding
        currentUser={{ username: 'guest', role: 'viewer' }}
        sections={[sections[0]]}
        onOpenCommandCenter={onOpenCommandCenter}
      />,
    );

    const emptyStateTitle = screen.getByText(/Chưa có module khả dụng/i);
    expect(emptyStateTitle).toBeInTheDocument();
    const emptyStateCard = emptyStateTitle.closest('[data-tone="empty"]');
    expect(emptyStateCard).not.toBeNull();

    await user.click(within(emptyStateCard).getByRole('button', { name: /Mở Command Center/i }));
    expect(onOpenCommandCenter).toHaveBeenCalledTimes(1);
  });
});
