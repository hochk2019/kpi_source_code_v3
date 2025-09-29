import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import DataImporter from './DataImporter.jsx';
import RulesEditor from './RulesEditor.jsx';
import MSTAssignment from './MSTAssignment.jsx';
import TeamManager from './TeamManager.jsx';
import ReportViewer from './ReportViewer.jsx';
import AccountManager from './AccountManager.jsx';
import AuditLog from './AuditLog.jsx';
import HQAgencyManager from './HQAgencyManager.jsx';

const KPICalculator = ({ auth }) => {
  const effectiveAuth = auth || { username: 'guest', role: 'viewer', permissions: {} };
  const permissions = effectiveAuth.permissions || {};
  const canImportEdit = !!permissions.importEdit;
  const canMstEdit = !!permissions.mstEdit;
  const canRulesEdit = !!permissions.rulesEdit;
  const canTeamsEdit = !!permissions.teamsEdit;
  const canManageAccounts = !!permissions.accountManage;
  const canExportReports = permissions.reportsExport !== false;
  const canManageSync = !!permissions.syncManage;
  const canManageAlerts = !!permissions.alertsManage;
  const canViewAudit = !!permissions.auditView || canManageAccounts;

  return (
    <div className="mx-auto max-w-6xl">
      <Tabs defaultValue="reports" className="space-y-6">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="mst">Gán MST</TabsTrigger>
          <TabsTrigger value="hq">Đại Lý HQ</TabsTrigger>
          <TabsTrigger value="import">Import Data</TabsTrigger>
          <TabsTrigger value="teams">Quản lý Tổ đội</TabsTrigger>
          <TabsTrigger value="rules">Quy tắc KPI</TabsTrigger>
          <TabsTrigger value="reports">Báo cáo KPI</TabsTrigger>
          {canManageAccounts && <TabsTrigger value="accounts">Tài khoản</TabsTrigger>}
          {canViewAudit && <TabsTrigger value="audit">Nhật ký</TabsTrigger>}
        </TabsList>

        <TabsContent value="mst">
          <MSTAssignment canEdit={canMstEdit} currentUser={effectiveAuth} />
        </TabsContent>

        <TabsContent value="hq">
          <HQAgencyManager canEdit={canMstEdit} currentUser={effectiveAuth} />
        </TabsContent>

        <TabsContent value="import">
          <DataImporter
            canEdit={canImportEdit}
            currentUser={effectiveAuth}
            canManageSync={canManageSync}
            canManageAlerts={canManageAlerts}
          />
        </TabsContent>

        <TabsContent value="teams">
          <TeamManager canEdit={canTeamsEdit} currentUser={effectiveAuth} />
        </TabsContent>

        <TabsContent value="rules">
          <RulesEditor canEdit={canRulesEdit} currentUser={effectiveAuth} />
        </TabsContent>

        <TabsContent value="reports">
          <ReportViewer canExport={canExportReports} currentUser={effectiveAuth} />
        </TabsContent>

        {canManageAccounts && (
          <TabsContent value="accounts">
            <AccountManager currentUser={effectiveAuth} />
          </TabsContent>
        )}

        {canViewAudit && (
          <TabsContent value="audit">
            <AuditLog currentUser={effectiveAuth} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default KPICalculator;
