import React, { Suspense, useEffect, useMemo, useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';



import DataImporter from './DataImporter.jsx';

const RulesEditor = React.lazy(() => import('./RulesEditor.jsx'));

const MSTAssignment = React.lazy(() => import('./MSTAssignment.jsx'));

const TeamManager = React.lazy(() => import('./TeamManager.jsx'));

const ReportViewer = React.lazy(() => import('./ReportViewer.jsx'));

const KPIAdjustments = React.lazy(() => import('./KPIAdjustments.jsx'));

const AccountManager = React.lazy(() => import('./AccountManager.jsx'));

const AuditLog = React.lazy(() => import('./AuditLog.jsx'));

import HQAgencyManager from './HQAgencyManager.jsx';

const AiAssistant = React.lazy(() => import('./AiAssistant.jsx'));

const DataHealthDashboard = React.lazy(() => import('./DataHealthDashboard.jsx'));

const ExportAuditReport = React.lazy(() => import('./ExportAuditReport.jsx'));



const TabPanel = ({ children }) => (

  <Suspense fallback={<div className="p-4 text-sm text-gray-500">Đang tải nội dung...</div>}>

    <div className="ds-panel__inner">{children}</div>

  </Suspense>

);



const TAB_TRIGGER_CLASS = 'ds-tab-trigger';



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

  const canManageDataHealth = !!permissions.dataHealthManage;

  const canViewDataHealth = !!permissions.dataHealthView || canManageDataHealth;



  const allowedTabs = useMemo(() => {

    const base = new Set(['mst', 'hq', 'import', 'teams', 'rules', 'adjustments', 'reports']);

    if (canViewDataHealth) {

      base.add('health');

    }

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

  }, [canManageAccounts, canUseAi, canViewAudit, canViewDataHealth]);



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

    <div className="mx-auto max-w-6xl space-y-6">

      <Tabs value={tabValue} onValueChange={handleTabChange} className="space-y-6">

        <TabsList className="ds-tab-list">

          <TabsTrigger

            value="mst"

            data-tooltip="Quản lý gán MST cho doanh nghiệp và người phụ trách"

            className={TAB_TRIGGER_CLASS}

          >

            Gán MST

          </TabsTrigger>

          <TabsTrigger

            value="hq"

            data-tooltip="Quản lý danh sách đại lý hải quan hợp tác"

            className={TAB_TRIGGER_CLASS}

          >

            Đại Lý HQ

          </TabsTrigger>

          <TabsTrigger

            value="import"

            data-tooltip="Nhập và đồng bộ dữ liệu tờ khai từ ECUS"

            className={TAB_TRIGGER_CLASS}

          >

            Import Data

          </TabsTrigger>

          <TabsTrigger

            value="teams"

            data-tooltip="Thiết lập tổ đội và phân bổ chỉ tiêu"

            className={TAB_TRIGGER_CLASS}

          >

            Quản lý Tổ đội

          </TabsTrigger>

          <TabsTrigger

            value="rules"

            data-tooltip="Cấu hình quy tắc tính điểm KPI"

            className={TAB_TRIGGER_CLASS}

          >

            Quy tắc KPI

          </TabsTrigger>

          <TabsTrigger

            value="adjustments"

            data-tooltip="Cộng/trừ điểm KPI bổ sung theo tháng"

            className={TAB_TRIGGER_CLASS}

          >

            Điểm KPI +/- Thêm

          </TabsTrigger>

          <TabsTrigger

            value="reports"

            data-tooltip="Xem và xuất báo cáo KPI tổng hợp"

            className={TAB_TRIGGER_CLASS}

          >

            Báo cáo KPI

          </TabsTrigger>

          {canViewDataHealth && (

            <TabsTrigger

              value="health"

              data-tooltip="Theo dõi dữ liệu trùng, cảnh báo và trạng thái đồng bộ"

              className={TAB_TRIGGER_CLASS}

            >

              Sức khỏe dữ liệu

            </TabsTrigger>

          )}

          {canUseAi && (

            <TabsTrigger

              value="ai"

              data-tooltip="Trợ lý AI nội bộ hỗ trợ KPI và tờ khai"

              className={TAB_TRIGGER_CLASS}

            >

              Trợ lý AI

            </TabsTrigger>

          )}

          {canManageAccounts && (

            <TabsTrigger

              value="accounts"

              data-tooltip="Quản trị tài khoản đăng nhập hệ thống"

              className={TAB_TRIGGER_CLASS}

            >

              Tài khoản

            </TabsTrigger>

          )}

          {canViewAudit && (

            <>

              <TabsTrigger

                value="audit"

                data-tooltip="Xem nhật ký thao tác hệ thống"

                className={TAB_TRIGGER_CLASS}

              >

                Nhật ký

              </TabsTrigger>

              <TabsTrigger

                value="export-audit"

                data-tooltip="Tra cứu lịch sử tải báo cáo Excel"

                className={TAB_TRIGGER_CLASS}

              >

                Lịch sử export

              </TabsTrigger>

            </>

          )}

        </TabsList>



        <TabsContent value="mst" className="ds-panel">

          <TabPanel>

            <MSTAssignment canEdit={canMstEdit} currentUser={effectiveAuth} />

          </TabPanel>

        </TabsContent>



        <TabsContent value="hq" className="ds-panel">

          <TabPanel>

            <HQAgencyManager canEdit={canMstEdit} currentUser={effectiveAuth} />

          </TabPanel>

        </TabsContent>



        <TabsContent value="import" className="ds-panel">

          <TabPanel>

            <DataImporter

              canEdit={canImportEdit}

              currentUser={effectiveAuth}

              canManageSync={canManageSync}

              canManageAlerts={canManageAlerts}

            />

          </TabPanel>

        </TabsContent>



        <TabsContent value="teams" className="ds-panel">

          <TabPanel>

            <TeamManager canEdit={canTeamsEdit} currentUser={effectiveAuth} />

          </TabPanel>

        </TabsContent>



        <TabsContent value="rules" className="ds-panel">

          <TabPanel>

            <RulesEditor canEdit={canRulesEdit} currentUser={effectiveAuth} />

          </TabPanel>

        </TabsContent>



        <TabsContent value="adjustments" className="ds-panel">

          <TabPanel>

            <KPIAdjustments currentUser={effectiveAuth} />

          </TabPanel>

        </TabsContent>



        <TabsContent value="reports" className="ds-panel">

          <TabPanel>

            <ReportViewer canExport={canExportReports} currentUser={effectiveAuth} />

          </TabPanel>

        </TabsContent>



        {canViewDataHealth && (

        <TabsContent value="health" className="ds-panel">

          <TabPanel>

              <DataHealthDashboard currentUser={effectiveAuth} canManage={canManageDataHealth} />

          </TabPanel>

        </TabsContent>

        )}



        {canUseAi && (

          <TabsContent value="ai" className="ds-panel">

            <TabPanel>

              <AiAssistant currentUser={effectiveAuth} />

            </TabPanel>

          </TabsContent>

        )}



        {canManageAccounts && (

          <TabsContent value="accounts" className="ds-panel">

            <TabPanel>

              <AccountManager currentUser={effectiveAuth} />

            </TabPanel>

          </TabsContent>

        )}



        {canViewAudit && (

          <TabsContent value="audit" className="ds-panel">

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

          <TabsContent value="export-audit" className="ds-panel">

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

