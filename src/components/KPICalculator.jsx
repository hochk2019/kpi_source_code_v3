import React, { Suspense, useEffect } from 'react';
import { t } from '@/lib/i18n.js';

import { TabsContent } from '@/components/ui/tabs.jsx';
import { useKpiPermissions } from '@/hooks/useKpiPermissions.js';

const DataImporter = React.lazy(() => import('./DataImporter.jsx'));

const RulesEditor = React.lazy(() => import('./RulesEditor.jsx'));

const TeamManager = React.lazy(() => import('./TeamManager.jsx'));

const AccountManager = React.lazy(() => import('./AccountManager.jsx'));



const AiAssistant = React.lazy(() => import('./AiAssistant.jsx'));

const DataHealthDashboard = React.lazy(() => import('./DataHealthDashboard.jsx'));

const ExportAuditReport = React.lazy(() => import('./ExportAuditReport.jsx'));

import {
  APP_SHELL_FALLBACK_TAB,
} from '@/lib/appShellNavigation.js';
import { getAppTabRootId } from '@/components/appShell/appShellWorkflowState.js';
import { AppShellLoadingState } from '@/components/appShell/AppShellAsyncStates.jsx';
import AppShellFrame from '@/components/appShell/AppShellFrame.jsx';
import AppDashboardLanding from '@/components/appShell/AppDashboardLanding.jsx';
import useKpiShellState from '@/components/appShell/useKpiShellState.js';
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
  <div aria-live="polite" role="status">
    <AppShellLoadingState
      title={t('shell.loading', { module: tabLabel })}
      description={t('shell.loadingDesc')}
    />
  </div>
);

const TabPanel = ({ children, panelRootId, tabLabel, panelClassName = 'ds-panel__inner' }) => (
  <RuntimeErrorBoundary
    level="panel"
    title={t('shell.error.title', { module: tabLabel })}
    description={t('shell.error.desc')}
  >
    <div className={panelClassName} id={panelRootId} tabIndex={-1}>
      <Suspense fallback={<TabPanelLoadingState tabLabel={tabLabel} />}>{children}</Suspense>
    </div>
  </RuntimeErrorBoundary>
);

const KPICalculator = ({
  auth,
  activeTab = APP_SHELL_FALLBACK_TAB,
  onTabChange,
  navigationIntent = null,
}) => {

  const {
    effectiveAuth,
    canImportEdit,
    canImportUpload,
    canMstEdit,
    canRulesEdit,
    canTeamsEdit,
    canManageAccounts,
    canExportReports,
    canManageSync,
    canManageAlerts,
    canViewAudit,
    canUseAi,
    canManageDataHealth,
    canViewDataHealth,
  } = useKpiPermissions(auth);

  const {
    currentSection,
    currentTab,
    handleTabChange,
    loadedTabs,
    navigationSections,
    requestTabNavigation,
    tabValue,
  } = useKpiShellState({
    activeTab,
    currentUser: effectiveAuth,
    onTabChange,
    navigationIntent,
  });



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





  return (

    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:max-w-screen-2xl">
      <AppShellFrame
        sections={navigationSections}
        value={tabValue}
        onValueChange={handleTabChange}
        currentTab={currentTab}
        currentSection={currentSection}
        currentUser={effectiveAuth}
        onOpenCommandCenter={() => emitCommand('open:command-center')}
      >

        <TabsContent value="dashboard" className="ds-panel">

          {loadedTabs.has('dashboard') ? (
            <TabPanel panelRootId={getAppTabRootId('dashboard')} tabLabel="Tổng quan KPI">

              <AppDashboardLanding
                currentUser={effectiveAuth}
                sections={navigationSections}
                onNavigate={requestTabNavigation}
                onOpenCommandCenter={() => emitCommand('open:command-center')}
                canUseAi={canUseAi}
                canViewAudit={canViewAudit}
                canViewDataHealth={canViewDataHealth}
              />

            </TabPanel>
          ) : null}

        </TabsContent>

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
    </div >

  );

};



export default KPICalculator;

