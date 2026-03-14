import { describe, expect, it } from 'vitest';

import {
  APP_SHELL_FALLBACK_TAB,
  getAppShellAccess,
  getVisibleAppNavigationSections,
  getVisibleAppTabs,
  resolveVisibleAppTab,
} from '@/lib/appShellNavigation.js';

describe('appShellNavigation', () => {
  it('giữ bộ tab nền cho tài khoản khách', () => {
    const tabs = getVisibleAppTabs({ username: 'guest', role: 'viewer', permissions: {} }).map((tab) => tab.id);

    expect(tabs).toEqual(['mst', 'hq', 'import', 'teams', 'rules', 'adjustments', 'reports']);
  });

  it('mở rộng tab theo quyền điều hướng nâng cao', () => {
    const currentUser = {
      username: 'admin',
      role: 'admin',
      permissions: {
        accountManage: true,
        aiAssistManage: true,
        dataHealthManage: true,
      },
    };

    const access = getAppShellAccess(currentUser);
    const tabs = getVisibleAppTabs(currentUser).map((tab) => tab.id);

    expect(access).toMatchObject({
      canManageAccounts: true,
      canUseAi: true,
      canViewAudit: true,
      canViewDataHealth: true,
    });
    expect(tabs).toEqual([
      'mst',
      'hq',
      'import',
      'teams',
      'rules',
      'adjustments',
      'reports',
      'health',
      'ai',
      'accounts',
      'audit',
      'export-audit',
    ]);
  });

  it('gom tab nhìn thấy thành các nhóm shell theo domain', () => {
    const currentUser = {
      username: 'ops-admin',
      role: 'admin',
      permissions: {
        accountManage: true,
        dataHealthView: true,
      },
    };

    const sections = getVisibleAppNavigationSections(currentUser).map((section) => ({
      id: section.id,
      tabs: section.tabs.map((tab) => tab.id),
    }));

    expect(sections).toEqual([
      { id: 'operations', tabs: ['mst', 'hq', 'import'] },
      { id: 'performance', tabs: ['teams', 'rules', 'adjustments', 'reports'] },
      { id: 'observability', tabs: ['health'] },
      { id: 'governance', tabs: ['accounts', 'audit', 'export-audit'] },
    ]);
  });

  it('fallback về tab báo cáo khi tab yêu cầu không khả dụng', () => {
    const currentUser = { username: 'guest', role: 'viewer', permissions: {} };

    expect(resolveVisibleAppTab('health', currentUser)).toBe(APP_SHELL_FALLBACK_TAB);
    expect(resolveVisibleAppTab('does-not-exist', currentUser)).toBe(APP_SHELL_FALLBACK_TAB);
  });
});
