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
  APP_SHELL_WORKFLOW_TARGETS,
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
import {
  getDefaultDeviceHint,
  recordScreenRenderMetric,
  startWebVitalsCapture,
} from '@/lib/frontendPerformanceTelemetry.js';

const TabPanelLoadingState = ({ tabLabel }) => (
  <div aria-live="polite" className="p-4 text-sm text-gray-500" role="status">
    {`Đang tải nội dung ${tabLabel}...`}
  </div>
);

const TabPanel = ({ children, panelRootId, tabLabel, panelClassName = 'ds-panel__inner' }) => (
  <RuntimeErrorBoundary
    level="panel"
    title={`Không thể hiển thị ${tabLabel}.`}
    description="Bạn có thể thử hiển thị lại module này hoặc chuyển sang tab khác để tiếp tục công việc."
  >
    <div className={panelClassName} id={panelRootId} tabIndex={-1}>
      <Suspense fallback={<TabPanelLoadingState tabLabel={tabLabel} />}>{children}</Suspense>
    </div>
  </RuntimeErrorBoundary>
);

const resolveTabRootFallbackTarget = (targetId) => {
  if (!targetId) {
    return null;
  }

  if (targetId.startsWith('app-tab-root-')) {
    return targetId;
  }

  const matchingTabId = Object.entries(APP_SHELL_WORKFLOW_TARGETS).find(([, targets]) =>
    Object.values(targets).includes(targetId),
  )?.[0];

  return matchingTabId ? getAppTabRootId(matchingTabId) : null;
};


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

  useEffect(() => {
    if (!tabValue) {
      return undefined;
    }

    const now = () =>
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    const startAt = now();
    let firstFrameId = null;
    let secondFrameId = null;
    let timeoutId = null;

    const flushMetric = () => {
      const durationMs = Math.max(0, now() - startAt);
      recordScreenRenderMetric({
        screen: tabValue,
        durationMs,
        slowThresholdMs: 800,
        source: 'tab_panel_render',
        deviceHint: getDefaultDeviceHint(),
      });
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      firstFrameId = window.requestAnimationFrame(() => {
        secondFrameId = window.requestAnimationFrame(() => {
          flushMetric();
        });
      });
    } else {
      timeoutId = setTimeout(flushMetric, 0);
    }

    return () => {
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        if (firstFrameId != null) {
          window.cancelAnimationFrame(firstFrameId);
        }
        if (secondFrameId != null) {
          window.cancelAnimationFrame(secondFrameId);
        }
      }
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    };
  }, [tabValue]);

  useEffect(() => {
    const stopWebVitalsCapture = startWebVitalsCapture({ source: 'kpi_calculator' });
    return () => {
      stopWebVitalsCapture?.();
    };
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

      const fallbackTargetId = resolveTabRootFallbackTarget(pendingFocusTarget);
      if (fallbackTargetId && fallbackTargetId !== pendingFocusTarget) {
        const fallbackTarget = document.getElementById(fallbackTargetId);
        if (fallbackTarget) {
          if (typeof fallbackTarget.scrollIntoView === 'function') {
            fallbackTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          if (typeof fallbackTarget.focus === 'function') {
            fallbackTarget.focus({ preventScroll: true });
          }
          setPendingFocusTarget(null);
          return;
        }
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
          <TabPanel panelRootId={getAppTabRootId('mst')} tabLabel="Gán MST">

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
          <TabPanel panelRootId={getAppTabRootId('hq')} tabLabel="Đại Lý HQ">

            <HQAgencyManager canEdit={canMstEdit} currentUser={effectiveAuth} />

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="import" className="ds-panel">

          {loadedTabs.has('import') ? (
          <TabPanel panelRootId={getAppTabRootId('import')} tabLabel="Import Data">

            <DataImporter
              canEdit={canImportEdit}
              canImportUpload={canImportUpload}
              currentUser={effectiveAuth}
              canManageSync={canManageSync}
              canManageAlerts={canManageAlerts}
            />

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="teams" className="ds-panel">

          {loadedTabs.has('teams') ? (
          <TabPanel panelRootId={getAppTabRootId('teams')} tabLabel="Quản lý tổ đội">

            <TeamManager canEdit={canTeamsEdit} currentUser={effectiveAuth} />

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="rules" className="ds-panel">

          {loadedTabs.has('rules') ? (
          <TabPanel panelRootId={getAppTabRootId('rules')} tabLabel="Quy tắc KPI">

            <RulesEditor canEdit={canRulesEdit} currentUser={effectiveAuth} />

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="adjustments" className="ds-panel">

          {loadedTabs.has('adjustments') ? (
          <TabPanel panelRootId={getAppTabRootId('adjustments')} tabLabel="Điểm KPI +/- Thêm">

            <KPIAdjustmentsWorkflowPanel
              currentUser={effectiveAuth}
              onNavigate={requestTabNavigation}
            />

          </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="reports" className="ds-panel">

          {loadedTabs.has('reports') ? (
          <TabPanel panelRootId={getAppTabRootId('reports')} tabLabel="Báo cáo KPI">

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
          <TabPanel
            panelClassName="ds-panel__inner space-y-4"
            panelRootId={getAppTabRootId('health')}
            tabLabel="Health & sync"
          >

            <SectionSurface id="app-workflow-health-sync" tabIndex={-1}>
              <SectionHeader
                title="Health & sync triage"
                description="Kiểm tra đồng bộ, cảnh báo dữ liệu và backlog trước khi chuyển sang module xử lý tương ứng."
              />
              <DataHealthDashboard currentUser={effectiveAuth} canManage={canManageDataHealth} />
            </SectionSurface>

          </TabPanel>
          ) : null}

        </TabsContent>

        )}



        {canUseAi && (

          <TabsContent value="ai" className="ds-panel">

            {loadedTabs.has('ai') ? (
            <TabPanel panelRootId={getAppTabRootId('ai')} tabLabel="Trợ lý AI">

              <AiAssistant currentUser={effectiveAuth} />

            </TabPanel>
            ) : null}

          </TabsContent>

        )}



        {canManageAccounts && (

          <TabsContent value="accounts" className="ds-panel">

            {loadedTabs.has('accounts') ? (
            <TabPanel panelRootId={getAppTabRootId('accounts')} tabLabel="Tài khoản">

              <AccountManager currentUser={effectiveAuth} />

            </TabPanel>
            ) : null}

          </TabsContent>

        )}



        {canViewAudit && (

          <TabsContent value="audit" className="ds-panel">

            {loadedTabs.has('audit') ? (
            <TabPanel
              panelClassName="ds-panel__inner grid gap-6 xl:grid-cols-[5fr,3fr]"
              panelRootId={getAppTabRootId('audit')}
              tabLabel="Nhật ký hệ thống"
            >

              <div className="space-y-6">

                <AuditLog currentUser={effectiveAuth} />

              </div>

              <div className="space-y-6">

                <ExportAuditReport currentUser={effectiveAuth} />

              </div>

            </TabPanel>
            ) : null}

          </TabsContent>

        )}



        {canViewAudit && (

          <TabsContent value="export-audit" className="ds-panel">

            {loadedTabs.has('export-audit') ? (
            <TabPanel panelRootId={getAppTabRootId('export-audit')} tabLabel="Xuất nhật ký">

              <ExportAuditReport currentUser={effectiveAuth} />

            </TabPanel>
            ) : null}

          </TabsContent>

        )}
      </AppShellFrame>
    </div>

  );

};



export default KPICalculator;

