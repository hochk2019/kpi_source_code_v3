import React, { Suspense, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';

const DataImporter = React.lazy(() => import('./DataImporter.jsx'));
const RulesEditor = React.lazy(() => import('./RulesEditor.jsx'));
const MSTAssignment = React.lazy(() => import('./MSTAssignment.jsx'));
const TeamManager = React.lazy(() => import('./TeamManager.jsx'));
const ReportViewer = React.lazy(() => import('./ReportViewer.jsx'));
const AccountManager = React.lazy(() => import('./AccountManager.jsx'));
const AuditLog = React.lazy(() => import('./AuditLog.jsx'));
const HQAgencyManager = React.lazy(() => import('./HQAgencyManager.jsx'));

const TabPanel = ({ children }) => (
  <Suspense fallback={<div className="p-4 text-sm text-gray-500">Đang tải nội dung...</div>}>
    {children}
  </Suspense>
);

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

  useEffect(() => {
    import('./ReportViewer.jsx');
  }, []);

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
          <TabPanel>
            <MSTAssignment canEdit={canMstEdit} currentUser={effectiveAuth} />
          </TabPanel>
        </TabsContent>

        <TabsContent value="hq">
          <TabPanel>
            <HQAgencyManager canEdit={canMstEdit} currentUser={effectiveAuth} />
          </TabPanel>
        </TabsContent>

        <TabsContent value="import">
          <TabPanel>
            <DataImporter
              canEdit={canImportEdit}
              currentUser={effectiveAuth}
              canManageSync={canManageSync}
              canManageAlerts={canManageAlerts}
            />
          </TabPanel>
        </TabsContent>

        <TabsContent value="teams">
          <TabPanel>
            <TeamManager canEdit={canTeamsEdit} currentUser={effectiveAuth} />
          </TabPanel>
        </TabsContent>

        <TabsContent value="rules">
          <TabPanel>
            <RulesEditor canEdit={canRulesEdit} currentUser={effectiveAuth} />
          </TabPanel>
        </TabsContent>

        <TabsContent value="reports">
          <TabPanel>
            <ReportViewer canExport={canExportReports} currentUser={effectiveAuth} />
          </TabPanel>
        </TabsContent>

        {canManageAccounts && (
          <TabsContent value="accounts">
            <TabPanel>
              <AccountManager currentUser={effectiveAuth} />
            </TabPanel>
          </TabsContent>
        )}

        {canViewAudit && (
          <TabsContent value="audit">
            <TabPanel>
              <AuditLog currentUser={effectiveAuth} />
            </TabPanel>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default KPICalculator;
