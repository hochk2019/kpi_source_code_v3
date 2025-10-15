import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';

const DataImporter = React.lazy(() => import('./DataImporter.jsx'));
const RulesEditor = React.lazy(() => import('./RulesEditor.jsx'));
const MSTAssignment = React.lazy(() => import('./MSTAssignment.jsx'));
const TeamManager = React.lazy(() => import('./TeamManager.jsx'));
const ReportViewer = React.lazy(() => import('./ReportViewer.jsx'));
const KPIAdjustments = React.lazy(() => import('./KPIAdjustments.jsx'));
const AccountManager = React.lazy(() => import('./AccountManager.jsx'));
const AuditLog = React.lazy(() => import('./AuditLog.jsx'));
const HQAgencyManager = React.lazy(() => import('./HQAgencyManager.jsx'));
const AiAssistant = React.lazy(() => import('./AiAssistant.jsx'));
const DataHealthDashboard = React.lazy(() => import('./DataHealthDashboard.jsx'));
const ExportAuditReport = React.lazy(() => import('./ExportAuditReport.jsx'));

const TabPanel = ({ children }) => (
  <Suspense fallback={<div className="p-4 text-sm text-gray-500">Đang tải nội dung...</div>}>
    {children}
  </Suspense>
);

const KPICalculator = ({ auth, activeTab = 'reports', onTabChange }) => {
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
  const canUseAi = !!permissions.aiAssistUse || !!permissions.aiAssistManage;

  const allowedTabs = useMemo(() => {
    const base = new Set(['mst', 'hq', 'import', 'teams', 'rules', 'adjustments', 'reports', 'health']);
    if (canUseAi) {
      base.add('ai');
    }
    if (canManageAccounts) {
      base.add('accounts');
    }
    if (canViewAudit) {
      base.add('audit');
      base.add('export-audit');
    }
    return base;
  }, [canManageAccounts, canUseAi, canViewAudit]);

  const initialTab = useMemo(() => (allowedTabs.has(activeTab) ? activeTab : 'reports'), [activeTab, allowedTabs]);
  const [tabValue, setTabValue] = useState(initialTab);

  useEffect(() => {
    setTabValue(allowedTabs.has(activeTab) ? activeTab : 'reports');
  }, [activeTab, allowedTabs]);

  useEffect(() => {
    if (!allowedTabs.has(tabValue)) {
      const fallback = allowedTabs.has('reports') ? 'reports' : Array.from(allowedTabs)[0] || 'reports';
      setTabValue(fallback);
      if (fallback !== tabValue) {
        onTabChange?.(fallback);
      }
    }
  }, [allowedTabs, tabValue, onTabChange]);

  useEffect(() => {
    import('./ReportViewer.jsx');
  }, []);

  const handleTabChange = (value) => {
    if (!allowedTabs.has(value)) {
      return;
    }
    setTabValue(value);
    onTabChange?.(value);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Tabs value={tabValue} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="mst" data-tooltip="Quản lý gán MST cho doanh nghiệp và người phụ trách">
            Gán MST
          </TabsTrigger>
          <TabsTrigger value="hq" data-tooltip="Quản lý danh sách đại lý hải quan hợp tác">
            Đại Lý HQ
          </TabsTrigger>
          <TabsTrigger value="import" data-tooltip="Nhập và đồng bộ dữ liệu tờ khai từ ECUS">
            Import Data
          </TabsTrigger>
          <TabsTrigger value="teams" data-tooltip="Thiết lập tổ đội và phân bổ chỉ tiêu">
            Quản lý Tổ đội
          </TabsTrigger>
          <TabsTrigger value="rules" data-tooltip="Cấu hình quy tắc tính điểm KPI">
            Quy tắc KPI
          </TabsTrigger>
          <TabsTrigger value="adjustments" data-tooltip="Cộng/trừ điểm KPI bổ sung theo tháng">
            Điểm KPI +/- Thêm
          </TabsTrigger>
          <TabsTrigger value="reports" data-tooltip="Xem và xuất báo cáo KPI tổng hợp">
            Báo cáo KPI
          </TabsTrigger>
          <TabsTrigger value="health" data-tooltip="Theo dõi dữ liệu trùng, cảnh báo và trạng thái đồng bộ">
            Sức khỏe dữ liệu
          </TabsTrigger>
          {canUseAi && (
            <TabsTrigger value="ai" data-tooltip="Trợ lý AI nội bộ hỗ trợ KPI và tờ khai">
              Trợ lý AI
            </TabsTrigger>
          )}
          {canManageAccounts && (
            <TabsTrigger value="accounts" data-tooltip="Quản trị tài khoản đăng nhập hệ thống">
              Tài khoản
            </TabsTrigger>
          )}
          {canViewAudit && (
            <>
              <TabsTrigger value="audit" data-tooltip="Xem nhật ký thao tác hệ thống">
                Nhật ký
              </TabsTrigger>
              <TabsTrigger value="export-audit" data-tooltip="Tra cứu lịch sử tải báo cáo Excel">
                Lịch sử export
              </TabsTrigger>
            </>
          )}
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

        <TabsContent value="adjustments">
          <TabPanel>
            <KPIAdjustments currentUser={effectiveAuth} />
          </TabPanel>
        </TabsContent>

        <TabsContent value="reports">
          <TabPanel>
            <ReportViewer canExport={canExportReports} currentUser={effectiveAuth} />
          </TabPanel>
        </TabsContent>

        <TabsContent value="health">
          <TabPanel>
            <DataHealthDashboard currentUser={effectiveAuth} />
          </TabPanel>
        </TabsContent>

        {canUseAi && (
          <TabsContent value="ai">
            <TabPanel>
              <AiAssistant currentUser={effectiveAuth} />
            </TabPanel>
          </TabsContent>
        )}

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
              <div className="grid gap-6 xl:grid-cols-[5fr,3fr]">
                <div className="space-y-6">
                  <AuditLog currentUser={effectiveAuth} />
                </div>
                <div className="space-y-6">
                  <ExportAuditReport currentUser={effectiveAuth} />
                </div>
              </div>
            </TabPanel>
          </TabsContent>
        )}

        {canViewAudit && (
          <TabsContent value="export-audit">
            <TabPanel>
              <ExportAuditReport currentUser={effectiveAuth} />
            </TabPanel>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default KPICalculator;
