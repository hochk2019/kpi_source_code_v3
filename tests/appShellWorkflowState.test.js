import { describe, expect, it, vi } from 'vitest';

import {
  APP_SHELL_WORKFLOW_TARGETS,
  buildAppShellWorkflowState,
  getAppTabRootId,
  resolveAppShellFocusTarget,
} from '@/components/appShell/appShellWorkflowState.js';

describe('appShellWorkflowState', () => {
  it('maps legacy focus payloads to concrete workflow targets', () => {
    expect(resolveAppShellFocusTarget('import', 'favorites')).toBe(APP_SHELL_WORKFLOW_TARGETS.import.review);
    expect(resolveAppShellFocusTarget('reports', 'export')).toBe(APP_SHELL_WORKFLOW_TARGETS.reports.export);
    expect(resolveAppShellFocusTarget('health', 'sync')).toBe(APP_SHELL_WORKFLOW_TARGETS.health.sync);
    expect(resolveAppShellFocusTarget('teams', null)).toBe(getAppTabRootId('teams'));
  });

  it('builds report center workflow actions and export stage', () => {
    const onNavigate = vi.fn();
    const onOpenCommandCenter = vi.fn();

    const state = buildAppShellWorkflowState({
      currentTab: { id: 'reports', label: 'Báo cáo KPI' },
      canViewAudit: true,
      onNavigate,
      onOpenCommandCenter,
    });

    expect(state.eyebrow).toMatch(/Report center/i);
    expect(state.steps.at(-1).targetId).toBe(APP_SHELL_WORKFLOW_TARGETS.reports.export);

    state.actions[0].onClick();
    expect(onNavigate).toHaveBeenCalledWith('reports', 'dashboard');
  });

  it('falls back to a generic workflow for non-specialized tabs', () => {
    const onNavigate = vi.fn();

    const state = buildAppShellWorkflowState({
      currentTab: { id: 'teams', label: 'Quản lý Tổ đội' },
      onNavigate,
      onOpenCommandCenter: vi.fn(),
    });

    expect(state.headline).toMatch(/Quản lý Tổ đội/);
    expect(state.steps[0].targetId).toBe(getAppTabRootId('teams'));
  });
});
