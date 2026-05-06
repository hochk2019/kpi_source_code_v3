import { useMemo } from 'react';
import type { AuthAccountView } from '@/types';

/**
 * Tab identifiers for permission checking
 */
export type EditPermissionTab =
  | 'import'
  | 'mst'
  | 'hq'
  | 'rules'
  | 'teams'
  | 'accounts'
  | 'reports'
  | 'sync'
  | 'alerts'
  | 'ai'
  | 'health'
  | 'audit'
  | 'adjustments';

/**
 * Hook to centralize edit permission logic for different tabs/features.
 * Provides a unified interface for checking if user can edit specific sections.
 *
 * @param tab - The tab/feature identifier
 * @param currentUser - The current user object
 * @returns Object containing canEdit flag and permission details
 *
 * @example
 * const { canEdit, reason } = useEditPermission('teams', currentUser);
 * if (canEdit) { // show edit UI }
 */
interface PermissionSet {
  importEdit?: boolean;
  mstEdit?: boolean;
  rulesEdit?: boolean;
  teamsEdit?: boolean;
  accountManage?: boolean;
  reportsExport?: boolean;
  syncManage?: boolean;
  alertsManage?: boolean;
  aiAssistUse?: boolean;
  aiAssistManage?: boolean;
  dataHealthManage?: boolean;
  dataHealthView?: boolean;
  auditView?: boolean;
}

export function useEditPermission(
  tab: EditPermissionTab,
  currentUser?: AuthAccountView | null
): {
  canEdit: boolean;
  canView: boolean;
  reason: string;
  isAdmin: boolean;
} {
  return useMemo(() => {
    const effectiveUser = currentUser || { username: 'guest', role: 'viewer', permissions: {} };
    const permissions = (effectiveUser.permissions || {}) as PermissionSet;
    const role = effectiveUser.role || 'viewer';
    const isAdmin = role === 'admin' || role === 'manager';

    // Define permission mapping for each tab
    const permissionMap: Record<EditPermissionTab, { edit: boolean; view: boolean; reason: string }> = {
      import: {
        edit: !!permissions.importEdit || isAdmin,
        view: true, // Import is viewable by all authenticated users
        reason: 'Cần quyền importEdit hoặc vai trò admin/manager',
      },
      mst: {
        edit: !!permissions.mstEdit || isAdmin,
        view: true,
        reason: 'Cần quyền mstEdit hoặc vai trò admin/manager',
      },
      hq: {
        edit: !!permissions.mstEdit || isAdmin, // HQ shares MST edit permission
        view: true,
        reason: 'Cần quyền mstEdit hoặc vai trò admin/manager',
      },
      rules: {
        edit: !!permissions.rulesEdit || isAdmin,
        view: true,
        reason: 'Cần quyền rulesEdit hoặc vai trò admin/manager',
      },
      teams: {
        edit: !!permissions.teamsEdit || isAdmin,
        view: true,
        reason: 'Cần quyền teamsEdit hoặc vai trò admin/manager',
      },
      accounts: {
        edit: !!permissions.accountManage || isAdmin,
        view: !!permissions.accountManage || isAdmin,
        reason: 'Cần quyền accountManage hoặc vai trò admin/manager',
      },
      reports: {
        edit: permissions.reportsExport !== false,
        view: true,
        reason: 'Cần quyền reportsExport (mặc định cho phép)',
      },
      sync: {
        edit: !!permissions.syncManage || isAdmin,
        view: true,
        reason: 'Cần quyền syncManage hoặc vai trò admin/manager',
      },
      alerts: {
        edit: !!permissions.alertsManage || isAdmin,
        view: true,
        reason: 'Cần quyền alertsManage hoặc vai trò admin/manager',
      },
      ai: {
        edit: !!permissions.aiAssistManage || isAdmin,
        view: !!permissions.aiAssistUse || !!permissions.aiAssistManage || isAdmin,
        reason: 'Cần quyền aiAssistManage để chỉnh sửa, aiAssistUse để xem',
      },
      health: {
        edit: !!permissions.dataHealthManage || isAdmin,
        view: !!permissions.dataHealthView || !!permissions.dataHealthManage || isAdmin,
        reason: 'Cần quyền dataHealthManage để chỉnh sửa, dataHealthView để xem',
      },
      audit: {
        edit: false, // Audit is read-only
        view: !!permissions.auditView || !!permissions.accountManage || isAdmin,
        reason: 'Audit chỉ cho phép xem (read-only)',
      },
      adjustments: {
        edit: isAdmin, // Adjustments typically require admin
        view: true,
        reason: 'Cần vai trò admin/manager để chỉnh sửa điều chỉnh',
      },
    };

    const result = permissionMap[tab] || { edit: false, view: false, reason: 'Tab không xác định' };

    return {
      canEdit: result.edit,
      canView: result.view,
      reason: result.reason,
      isAdmin,
    };
  }, [tab, currentUser]);
}

/**
 * Hook to check multiple edit permissions at once.
 * Useful for pages with multiple editable sections.
 *
 * @param tabs - Array of tab identifiers
 * @param currentUser - The current user object
 * @returns Record of permission results keyed by tab
 */
export function useEditPermissions(
  tabs: EditPermissionTab[],
  currentUser?: AuthAccountView | null
): Record<EditPermissionTab, { canEdit: boolean; canView: boolean; reason: string; isAdmin: boolean }> {
  return useMemo(() => {
    const result = {} as Record<EditPermissionTab, { canEdit: boolean; canView: boolean; reason: string; isAdmin: boolean }>;
    
    for (const tab of tabs) {
      // Create a mock hook result for each tab
      const effectiveUser = currentUser || { username: 'guest', role: 'viewer', permissions: {} };
      const permissions = (effectiveUser.permissions || {}) as PermissionSet;
      const role = effectiveUser.role || 'viewer';
      const isAdmin = role === 'admin' || role === 'manager';

      const single = new Map<EditPermissionTab, { canEdit: boolean; canView: boolean; reason: string }>([
        ['import', { canEdit: !!permissions.importEdit || isAdmin, canView: true, reason: '' }],
        ['mst', { canEdit: !!permissions.mstEdit || isAdmin, canView: true, reason: '' }],
        ['hq', { canEdit: !!permissions.mstEdit || isAdmin, canView: true, reason: '' }],
        ['rules', { canEdit: !!permissions.rulesEdit || isAdmin, canView: true, reason: '' }],
        ['teams', { canEdit: !!permissions.teamsEdit || isAdmin, canView: true, reason: '' }],
        ['accounts', { canEdit: !!permissions.accountManage || isAdmin, canView: !!permissions.accountManage || isAdmin, reason: '' }],
        ['reports', { canEdit: permissions.reportsExport !== false, canView: true, reason: '' }],
        ['sync', { canEdit: !!permissions.syncManage || isAdmin, canView: true, reason: '' }],
        ['alerts', { canEdit: !!permissions.alertsManage || isAdmin, canView: true, reason: '' }],
        ['ai', { canEdit: !!permissions.aiAssistManage || isAdmin, canView: !!permissions.aiAssistUse || !!permissions.aiAssistManage || isAdmin, reason: '' }],
        ['health', { canEdit: !!permissions.dataHealthManage || isAdmin, canView: !!permissions.dataHealthView || !!permissions.dataHealthManage || isAdmin, reason: '' }],
        ['audit', { canEdit: false, canView: !!permissions.auditView || !!permissions.accountManage || isAdmin, reason: '' }],
        ['adjustments', { canEdit: isAdmin, canView: true, reason: '' }],
      ]).get(tab) || { canEdit: false, canView: false, reason: '' };

      result[tab] = { ...single, isAdmin };
    }

    return result;
  }, [tabs, currentUser]);
}
