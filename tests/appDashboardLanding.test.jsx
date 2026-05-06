import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useDashboardKpiOverview.js', () => ({
  useDashboardKpiOverview: () => ({
    loading: false,
    error: '',
    reload: vi.fn(),
    summary: {},
    trendSeries: [],
    trendComparison: null,
    adjustmentsReport: {},
    teamPieData: [],
    teamDeclPieData: [],
    topStaffByKpi: [],
    topStaffByDecls: [],
    dateRange: { from: '2026-04-01', to: '2026-04-27' },
  }),
}));

import AppDashboardLanding from '@/components/appShell/AppDashboardLanding.tsx';

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
  it('hiển thị tổng quan KPI và thông tin operator', () => {
    render(
      <AppDashboardLanding
        currentUser={{ username: 'ops.lead', name: 'Trưởng nhóm Ops', role: 'manager' }}
        sections={sections}
        canUseAi
        canViewAudit
        canViewDataHealth
      />,
    );

    expect(screen.getByText(/Tổng quan KPI/i)).toBeInTheDocument();
    expect(screen.getByText(/Trưởng nhóm Ops/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng tờ khai/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng điểm KPI/i)).toBeInTheDocument();
  });

  it('hiển thị hành động nhanh bao gồm báo cáo KPI', () => {
    const onNavigate = vi.fn();

    render(
      <AppDashboardLanding
        currentUser={{ username: 'ops.lead', name: 'Trưởng nhóm Ops', role: 'manager' }}
        sections={sections}
        onNavigate={onNavigate}
        canViewDataHealth
      />,
    );

    expect(screen.getAllByText(/Hành động nhanh/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mở báo cáo KPI/i).length).toBeGreaterThan(0);
  });

  it('hiển thị chế độ khách cho guest user', () => {
    render(
      <AppDashboardLanding
        currentUser={{ username: 'guest', role: 'viewer' }}
        sections={[sections[0]]}
      />,
    );

    expect(screen.getByText(/Chế độ khách/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Tổng quan KPI/i).length).toBeGreaterThan(0);
  });
});
