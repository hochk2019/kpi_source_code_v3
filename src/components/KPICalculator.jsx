import React, { Suspense, useEffect, useMemo, useState } from 'react';

import { TabsContent } from '@/components/ui/tabs.jsx';

const DataImporter = React.lazy(() => import('./DataImporter.jsx'));

const RulesEditor = React.lazy(() => import('./RulesEditor.jsx'));

const TeamManager = React.lazy(() => import('./TeamManager.jsx'));

const AccountManager = React.lazy(() => import('./AccountManager.jsx'));

const AuditLog = React.lazy(() => import('./AuditLog.jsx'));

const HQAgencyManager = React.lazy(() => import('./HQAgencyManager.jsx'));

const AiAssistant = React.lazy(() => import('./AiAssistant.jsx'));

const DataHealthDashboard = React.lazy(() => import('./DataHealthDashboard.jsx'));

const ExportAuditReport = React.lazy(() => import('./ExportAuditReport.jsx'));

import {
  getVisibleAppNavigationSections,
  getVisibleAppTabIds,
  getVisibleAppTabs,
  resolveVisibleAppTab,
} from '@/lib/appShellNavigation.js';
import {
  buildAppShellWorkflowState,
  getAppTabRootId,
  resolveAppShellFocusTarget,
} from '@/components/appShell/appShellWorkflowState.js';
import AppShellFrame from '@/components/appShell/AppShellFrame.jsx';
import { emitCommand } from '@/lib/commandBus.js';
const MSTWorkflowPanel = React.lazy(() => import('@/components/workflows/MSTWorkflowPanel.jsx'));
const KPIAdjustmentsWorkflowPanel = React.lazy(() =>
  import('@/components/workflows/KPIAdjustmentsWorkflowPanel.jsx'),
);
const ReportCenterPanel = React.lazy(() => import('@/components/workflows/ReportCenterPanel.jsx'));
import { SectionHeader, SectionSurface } from '@/components/designSystem/shellPrimitives.jsx';
import RuntimeErrorBoundary from '@/components/errorBoundaries/RuntimeErrorBoundary.jsx';

const TabPanel = ({ children, tabLabel }) => (
  <RuntimeErrorBoundary
    level="panel"
    title={`Không thể hiển thị ${tabLabel}.`}
    description="Bạn có thể thử hiển thị lại module này hoặc chuyển sang tab khác để tiếp tục công việc."
  >
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Đang tải nội dung...</div>}>
      <div className="ds-panel__inner">{children}</div>
    </Suspense>
  </RuntimeErrorBoundary>
);


const KPICalculator = ({
  auth,
  activeTab = 'reports',
  onTabChange,
  navigationIntent = null,
}) => {

  const effectiveAuth = useMemo(
    () => auth || { username: 'guest', role: 'viewer', permissions: {} },
    [auth],
  );

  const permissions = effectiveAuth.permissions || {};

  const canImportEdit = !!permissions.importEdit;

  const canImportUpload = !!permissions.importUpload;

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

  const visibleTabs = useMemo(() => getVisibleAppTabs(effectiveAuth), [effectiveAuth]);

  const navigationSections = useMemo(() => getVisibleAppNavigationSections(effectiveAuth), [effectiveAuth]);

  const allowedTabs = useMemo(() => getVisibleAppTabIds(effectiveAuth), [effectiveAuth]);

  const initialTab = useMemo(() => resolveVisibleAppTab(activeTab, effectiveAuth), [activeTab, effectiveAuth]);

  const [tabValue, setTabValue] = useState(initialTab);
  const [loadedTabs, setLoadedTabs] = useState(() => new Set([initialTab]));
  const [pendingFocusTarget, setPendingFocusTarget] = useState(null);



  useEffect(() => {

    const nextTab = resolveVisibleAppTab(activeTab, effectiveAuth);

    setLoadedTabs((prev) => {
      if (prev.has(nextTab)) {
        return prev;
      }
      return new Set([...prev, nextTab]);
    });

    setTabValue(nextTab);

  }, [activeTab, effectiveAuth]);



  useEffect(() => {

    if (!allowedTabs.has(tabValue)) {

      const fallback = resolveVisibleAppTab(tabValue, effectiveAuth);

      setLoadedTabs((prev) => {
        if (prev.has(fallback)) {
          return prev;
        }
        return new Set([...prev, fallback]);
      });

      setTabValue(fallback);

      if (fallback !== tabValue) {

        onTabChange?.(fallback);

      }

    }

  }, [allowedTabs, effectiveAuth, tabValue, onTabChange]);



  useEffect(() => {

    import('./ReportViewer.jsx');

  }, []);

  const handleTabChange = (value) => {

    if (!allowedTabs.has(value)) {

      return;

    }

    setTabValue(value);
    setLoadedTabs((prev) => {
      if (prev.has(value)) {
        return prev;
      }
      return new Set([...prev, value]);
    });

    onTabChange?.(value);

  };

  useEffect(() => {
    const nextTarget = resolveAppShellFocusTarget(navigationIntent?.tab, navigationIntent?.focus);
    if (nextTarget) {
      setPendingFocusTarget(nextTarget);
    }
  }, [navigationIntent]);

  useEffect(() => {
    if (!pendingFocusTarget || typeof window === 'undefined') {
      return undefined;
    }

    let attempts = 0;
    let timeoutId = null;

    const scrollToTarget = () => {
      const target = document.getElementById(pendingFocusTarget);
      if (target) {
        if (typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
        setPendingFocusTarget(null);
        return;
      }

      attempts += 1;
      if (attempts < 8) {
        timeoutId = window.setTimeout(scrollToTarget, 90);
      }
    };

    timeoutId = window.setTimeout(scrollToTarget, 60);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pendingFocusTarget, tabValue]);

  const requestTabNavigation = (tabId, focus = null) => {
    const targetId = resolveAppShellFocusTarget(tabId, focus);
    if (targetId) {
      setPendingFocusTarget(targetId);
    }
    handleTabChange(tabId);
  };

  const currentTab = useMemo(
    () => visibleTabs.find((tab) => tab.id === tabValue) || visibleTabs[0] || null,
    [tabValue, visibleTabs],
  );

  const currentSection = useMemo(
    () =>
      navigationSections.find((section) =>
        section.tabs.some((tab) => tab.id === currentTab?.id),
      ) ||
      navigationSections[0] ||
      null,
    [currentTab, navigationSections],
  );

  const workflowGuide = buildAppShellWorkflowState({
    currentTab,
    canViewAudit,
    onNavigate: requestTabNavigation,
    onOpenCommandCenter: () => emitCommand('open:command-center'),
  });



  return (

    <div className="mx-auto max-w-7xl">
      <AppShellFrame
        sections={navigationSections}
        value={tabValue}
        onValueChange={handleTabChange}
        currentTab={currentTab}
        currentSection={currentSection}
        currentUser={effectiveAuth}
        workflowGuide={workflowGuide}
        onOpenCommandCenter={() => emitCommand('open:command-center')}
      >



        <TabsContent value="mst" className="ds-panel">

          {loadedTabs.has('mst') ? (
          <TabPanel tabLabel="Gán MST">

            <MSTWorkflowPanel
              canEdit={canMstEdit}
              currentUser={effectiveAuth}
              onNavigate={requestTabNavigation}
            />

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="hq" className="ds-panel">

          {loadedTabs.has('hq') ? (
          <TabPanel tabLabel="Đại Lý HQ">

            <div id={getAppTabRootId('hq')} tabIndex={-1}>
              <HQAgencyManager canEdit={canMstEdit} currentUser={effectiveAuth} />
            </div>

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="import" className="ds-panel">

          {loadedTabs.has('import') ? (
          <TabPanel tabLabel="Import Data">

            <div id={getAppTabRootId('import')} tabIndex={-1}>
              <DataImporter
                canEdit={canImportEdit}
                canImportUpload={canImportUpload}
                currentUser={effectiveAuth}
                canManageSync={canManageSync}
                canManageAlerts={canManageAlerts}
              />
            </div>

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="teams" className="ds-panel">

          {loadedTabs.has('teams') ? (
          <TabPanel tabLabel="Quản lý tổ đội">

            <div id={getAppTabRootId('teams')} tabIndex={-1}>
              <TeamManager canEdit={canTeamsEdit} currentUser={effectiveAuth} />
            </div>

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="rules" className="ds-panel">

          {loadedTabs.has('rules') ? (
          <TabPanel tabLabel="Quy tắc KPI">

            <div id={getAppTabRootId('rules')} tabIndex={-1}>
              <RulesEditor canEdit={canRulesEdit} currentUser={effectiveAuth} />
            </div>

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="adjustments" className="ds-panel">

          {loadedTabs.has('adjustments') ? (
          <TabPanel tabLabel="Điểm KPI +/- Thêm">

            <KPIAdjustmentsWorkflowPanel
              currentUser={effectiveAuth}
              onNavigate={requestTabNavigation}
            />

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="reports" className="ds-panel">

          {loadedTabs.has('reports') ? (
          <TabPanel tabLabel="Báo cáo KPI">

            <ReportCenterPanel
              canExport={canExportReports}
              canViewAudit={canViewAudit}
              currentUser={effectiveAuth}
              onNavigate={requestTabNavigation}
            />

          </TabPanel>
          ) : null}

        </TabsContent>



        {canViewDataHealth && (

        <TabsContent value="health" className="ds-panel">

          {loadedTabs.has('health') ? (
          <TabPanel tabLabel="Health & sync">

              <div id={getAppTabRootId('health')} className="space-y-4" tabIndex={-1}>
                <SectionSurface id="app-workflow-health-sync" tabIndex={-1}>
                  <SectionHeader
                    title="Health & sync triage"
                    description="Kiểm tra đồng bộ, cảnh báo dữ liệu và backlog trước khi chuyển sang module xử lý tương ứng."
                  />
              <DataHealthDashboard currentUser={effectiveAuth} canManage={canManageDataHealth} />
                </SectionSurface>
              </div>

          </TabPanel>
          ) : null}

        </TabsContent>

        )}



        {canUseAi && (

          <TabsContent value="ai" className="ds-panel">

            {loadedTabs.has('ai') ? (
            <TabPanel tabLabel="Trợ lý AI">

              <div id={getAppTabRootId('ai')} tabIndex={-1}>
                <AiAssistant currentUser={effectiveAuth} />
              </div>

            </TabPanel>
            ) : null}

          </TabsContent>

        )}



        {canManageAccounts && (

          <TabsContent value="accounts" className="ds-panel">

            {loadedTabs.has('accounts') ? (
            <TabPanel tabLabel="Tài khoản">

              <div id={getAppTabRootId('accounts')} tabIndex={-1}>
                <AccountManager currentUser={effectiveAuth} />
              </div>

            </TabPanel>
            ) : null}

          </TabsContent>

        )}



        {canViewAudit && (

          <TabsContent value="audit" className="ds-panel">

            {loadedTabs.has('audit') ? (
            <TabPanel tabLabel="Nhật ký hệ thống">

              <div id={getAppTabRootId('audit')} className="grid gap-6 xl:grid-cols-[5fr,3fr]" tabIndex={-1}>

                <div className="space-y-6">

                  <AuditLog currentUser={effectiveAuth} />

                </div>

                <div className="space-y-6">

                  <ExportAuditReport currentUser={effectiveAuth} />

                </div>

              </div>

            </TabPanel>
            ) : null}

          </TabsContent>

        )}



        {canViewAudit && (

          <TabsContent value="export-audit" className="ds-panel">

            {loadedTabs.has('export-audit') ? (
            <TabPanel tabLabel="Xuất nhật ký">

              <div id={getAppTabRootId('export-audit')} tabIndex={-1}>
                <ExportAuditReport currentUser={effectiveAuth} />
              </div>

            </TabPanel>
            ) : null}

          </TabsContent>

        )}
      </AppShellFrame>
    </div>

  );

};



export default KPICalculator;

