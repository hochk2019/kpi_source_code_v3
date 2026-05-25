import { describe, expect, it, vi } from 'vitest';

import { buildAppDashboardSummaryState } from '@/components/appShell/appDashboardSummary.js';

const sections = [
  {
    id: 'overview',
    label: 'Tổng quan',
    tabs: [{ id: 'dashboard', label: 'Tổng quan KPI' }],
  },
  {
    id: 'operations',
    label: 'Vận hành',
    tabs: [
      { id: 'mst', label: 'Gán MST' },
      { id: 'import', label: 'Import Data' },
    ],
  },
  {
    id: 'performance',
    label: 'Hiệu suất',
    tabs: [{ id: 'reports', label: 'Báo cáo KPI' }],
  },
];

describe('buildAppDashboardSummaryState', () => {
  it('tạo summary counts và quick actions theo quyền hiện tại', () => {
    const state = buildAppDashboardSummaryState({
      currentUser: { username: 'ops.lead', name: 'Ops Lead' },
      sections,
      canUseAi: true,
      canViewAudit: true,
      canViewDataHealth: true,
    });

    expect(state.operatorName).toBe('Ops Lead');
    expect(state.isGuest).toBe(false);
    expect(state.workflowSections).toHaveLength(2);
    expect(state.visibleModuleCount).toBe(3);
    expect(state.enabledAssistCount).toBe(3);
    expect(state.quickActions.map((action) => action.label)).toContain('Gọi trợ lý AI');
  });

  it('fallback sang Command Center khi AI chưa khả dụng', () => {
    const onOpenCommandCenter = vi.fn();
    const state = buildAppDashboardSummaryState({
      currentUser: { username: 'guest', role: 'viewer' },
      sections: [sections[0]],
      onOpenCommandCenter,
    });

    expect(state.isGuest).toBe(true);
    expect(state.visibleModuleCount).toBe(0);
    expect(state.quickActions.at(-1)?.label).toBe('Mở Command Center');

    state.quickActions.at(-1)?.onClick();
    expect(onOpenCommandCenter).toHaveBeenCalledTimes(1);
  });
});
