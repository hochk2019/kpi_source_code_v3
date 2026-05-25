import { useMemo } from 'react';

/**
 * Custom hook to extract and manage KPI Calculator user permissions.
 * Abstracts the permission checks out from the heavy UI components.
 * 
 * @param {Object} auth - The raw authorization object.
 * @returns {Object} An object containing the unified permissions flags.
 */
export function useKpiPermissions(auth) {
    // CQ-002: Single useMemo to avoid re-render from effectiveAuth object reference changes
    return useMemo(() => {
        const effectiveAuth = auth || { username: 'guest', role: 'viewer', permissions: {} };
        const permissions = effectiveAuth.permissions || {};
        return {
            effectiveAuth,
            canImportEdit: !!permissions.importEdit,
            canImportUpload: !!permissions.importUpload,
            canMstEdit: !!permissions.mstEdit,
            canRulesEdit: !!permissions.rulesEdit,
            canTeamsEdit: !!permissions.teamsEdit,
            canManageAccounts: !!permissions.accountManage,
            canExportReports: permissions.reportsExport !== false,
            canManageSync: !!permissions.syncManage,
            canManageAlerts: !!permissions.alertsManage,
            canViewAudit: !!permissions.auditView || !!permissions.accountManage,
            canUseAi: !!permissions.aiAssistUse || !!permissions.aiAssistManage,
            canManageDataHealth: !!permissions.dataHealthManage,
            canViewDataHealth: !!permissions.dataHealthView || !!permissions.dataHealthManage,
        };
    }, [auth]);
}
