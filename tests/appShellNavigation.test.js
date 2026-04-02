import { describe, expect, it } from 'vitest';

import {
  APP_SHELL_FALLBACK_TAB,
  APP_SHELL_SECTION_QUERY_PARAM,
  APP_SHELL_TAB_QUERY_PARAM,
  getAppShellAccess,
  getVisibleAppNavigationSections,
  getVisibleAppTabs,
  parseAppShellLocation,
  resolveVisibleAppTab,
  serializeAppShellLocation,
} from '@/lib/appShellNavigation.js';

describe('appShellNavigation', () => {
  it('giữ bộ tab nền cho tài khoản khách', () => {
    const tabs = getVisibleAppTabs({ username: 'guest', role: 'viewer', permissions: {} }).map((tab) => tab.id);

    expect(tabs).toEqual(['dashboard', 'mst', 'hq', 'import', 'teams', 'rules', 'adjustments', 'reports']);
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
      'dashboard',
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
      { id: 'overview', tabs: ['dashboard'] },
      { id: 'operations', tabs: ['mst', 'hq', 'import'] },
      { id: 'performance', tabs: ['teams', 'rules', 'adjustments', 'reports'] },
      { id: 'observability', tabs: ['health'] },
      { id: 'governance', tabs: ['accounts', 'audit', 'export-audit'] },
    ]);
  });

  it('fallback về dashboard khi tab yêu cầu không khả dụng', () => {
    const currentUser = { username: 'guest', role: 'viewer', permissions: {} };

    expect(resolveVisibleAppTab('health', currentUser)).toBe(APP_SHELL_FALLBACK_TAB);
    expect(resolveVisibleAppTab('does-not-exist', currentUser)).toBe(APP_SHELL_FALLBACK_TAB);
  });

  it('fallback theo section khi chỉ còn section hợp lệ trong URL', () => {
    const currentUser = { username: 'guest', role: 'viewer', permissions: {} };

    expect(resolveVisibleAppTab('health', currentUser, APP_SHELL_FALLBACK_TAB, 'operations')).toBe('mst');
  });

  it('parse shell location về tab nhìn thấy được và giữ section tương ứng', () => {
    const currentUser = { username: 'guest', role: 'viewer', permissions: {} };

    expect(parseAppShellLocation('?section=operations&tab=import', currentUser)).toMatchObject({
      section: 'operations',
      tab: 'import',
      requestedSection: 'operations',
      requestedTab: 'import',
    });

    expect(parseAppShellLocation('?section=governance&tab=accounts', currentUser)).toMatchObject({
      section: 'overview',
      tab: 'dashboard',
    });
  });

  it('serialize shell location với section/tab chuẩn hóa', () => {
    const currentUser = { username: 'guest', role: 'viewer', permissions: {} };

    expect(
      serializeAppShellLocation({
        search: '?foo=bar',
        tab: 'import',
        currentUser,
      }),
    ).toBe(`?foo=bar&${APP_SHELL_SECTION_QUERY_PARAM}=operations&${APP_SHELL_TAB_QUERY_PARAM}=import`);

    expect(
      serializeAppShellLocation({
        search: '?foo=bar',
        tab: 'health',
        currentUser,
      }),
    ).toBe(`?foo=bar&${APP_SHELL_SECTION_QUERY_PARAM}=overview&${APP_SHELL_TAB_QUERY_PARAM}=dashboard`);
  });
});
