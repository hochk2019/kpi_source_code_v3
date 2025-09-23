import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import DataImporter from './DataImporter.jsx';
import RulesEditor from './RulesEditor.jsx';
import MSTAssignment from './MSTAssignment.jsx';
import TeamManager from './TeamManager.jsx';
import ReportViewer from './ReportViewer.jsx';
import AccountManager from './AccountManager.jsx';
import AuditLog from './AuditLog.jsx';

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
    <div className="max-w-6xl mx-auto p-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">Hệ thống tính KPI Hải quan</h1>
        <p className="text-gray-500">Công cụ tính điểm KPI cho nhân viên làm thủ tục hải quan</p>
      </div>

      <Tabs defaultValue="import" className="space-y-6">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="import">Import Excel</TabsTrigger>
          <TabsTrigger value="rules">Quy tắc KPI</TabsTrigger>
          <TabsTrigger value="mst">Gán MST</TabsTrigger>
          <TabsTrigger value="teams">Quản lý Thành viên &amp; Tổ đội</TabsTrigger>
          <TabsTrigger value="reports">Báo cáo/In</TabsTrigger>
          {canManageAccounts && <TabsTrigger value="accounts">Tài khoản</TabsTrigger>}
          {canViewAudit && <TabsTrigger value="audit">Nhật ký</TabsTrigger>}
        </TabsList>

        <TabsContent value="import">
          <DataImporter
            canEdit={canImportEdit}
            currentUser={effectiveAuth}
            canManageSync={canManageSync}
            canManageAlerts={canManageAlerts}
          />
        </TabsContent>

        <TabsContent value="rules">
          <RulesEditor canEdit={canRulesEdit} currentUser={effectiveAuth} />
        </TabsContent>

        <TabsContent value="mst">
          <MSTAssignment canEdit={canMstEdit} currentUser={effectiveAuth} />
        </TabsContent>

        <TabsContent value="teams">
          <TeamManager canEdit={canTeamsEdit} currentUser={effectiveAuth} />
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
