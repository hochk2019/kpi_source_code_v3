import React, { Suspense, useEffect } from 'react';
import { t } from '@/lib/i18n.js';

import { TabsContent } from '@/components/ui/tabs';
import { useKpiPermissions } from '@/hooks/useKpiPermissions.js';
import type { AuthAccountView } from '@/types/index.js';

import {
  APP_SHELL_FALLBACK_TAB,
} from '@/lib/appShellNavigation';
import { getAppTabRootId } from '@/components/appShell/appShellWorkflowState.js';
import AppShellFrame from '@/components/appShell/AppShellFrame';
import useKpiShellState from '@/components/appShell/useKpiShellState.js';
import { useNavigationState } from '@/hooks/useNavigationState';
import { emitCommand } from '@/lib/commandBus.js';
import { SectionHeader, SectionSurface } from '@/components/designSystem/shellPrimitives.tsx';
import RuntimeErrorBoundary from '@/components/errorBoundaries/RuntimeErrorBoundary.jsx';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getDefaultDeviceHint,
  recordScreenRenderMetric,
  startWebVitalsCapture,
} from '@/lib/frontendPerformanceTelemetry.js';

// ─── Route-Level Lazy Loading (all 13 Page_Modules) ────────────────────────

export const PAGE_MODULES = {
  DataImporter: React.lazy(() => import('./DataImporter.tsx')),
  RulesEditor: React.lazy(() => import('./RulesEditor.tsx')),
  ReportViewer: React.lazy(() => import('./ReportViewer')),
  TeamManager: React.lazy(() => import('./TeamManager.tsx')),
  MSTAssignment: React.lazy(() => import('./MstHqContainer')),
  KPIAdjustments: React.lazy(() => import('@/components/workflows/KPIAdjustmentsWorkflowPanel.jsx')),
  AccountManager: React.lazy(() => import('./AccountManager.tsx')),
  HQAgencyManager: React.lazy(() => import('./HQAgencyManager')),
  DataHealthDashboard: React.lazy(() => import('./DataHealthDashboard.tsx')),
  AuditLog: React.lazy(() => import('./AuditLog.tsx')),
  AiAssistant: React.lazy(() => import('./AiAssistant')),
  ReportCenter: React.lazy(() => import('@/components/workflows/ReportCenterPanel.jsx')),
  AppDashboardLanding: React.lazy(() => import('./appShell/AppDashboardLanding.tsx')),
} as const;

const ExportAuditReport = React.lazy(() => import('./ExportAuditReport'));

// ─── Types ─────────────────────────────────────────────────────────────────

interface TabPanelLoadingStateProps {
  tabLabel: string;
}

interface TabPanelProps {
  children: React.ReactNode;
  panelRootId: string;
  tabLabel: string;
  panelClassName?: string;
}

interface KPICalculatorProps {
  auth: AuthAccountView | null | undefined;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  navigationIntent?: { tab: string; focus: string | null; nonce: number } | null;
}

// ─── Helper Components ─────────────────────────────────────────────────────

const TabPanelLoadingState = ({ tabLabel }: TabPanelLoadingStateProps) => (
  <div aria-live="polite" role="status">
    <span className="sr-only">{t('shell.loading', { module: tabLabel })}</span>
    <PageSkeleton />
  </div>
);

const TabPanel = ({ children, panelRootId, tabLabel, panelClassName = 'ds-panel__inner' }: TabPanelProps) => (
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
}: KPICalculatorProps) => {

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

  // Preserve scroll/filter state per Page_Module across same-session tab
  // navigation: auto-saves on tab leave, auto-restores on return. (Req 4.4)
  useNavigationState(tabValue);

  useEffect(() => {

    import('./ReportViewer');

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
    let firstFrameId: number | null = null;
    let secondFrameId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

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

              <PAGE_MODULES.AppDashboardLanding
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

        <TabsContent value="mst-hq" className="ds-panel">

          {loadedTabs.has('mst-hq') ? (
            <TabPanel panelRootId={getAppTabRootId('mst-hq')} tabLabel="Gán MST & HQ">

              <PAGE_MODULES.MSTAssignment
                currentUser={effectiveAuth}
                canManageMst={canMstEdit}
                canManageHq={true}
              />

            </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="import" className="ds-panel">

          {loadedTabs.has('import') ? (
            <TabPanel panelRootId={getAppTabRootId('import')} tabLabel="Import Data">

              <PAGE_MODULES.DataImporter
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

              <PAGE_MODULES.TeamManager canEdit={canTeamsEdit} currentUser={effectiveAuth} />

            </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="rules" className="ds-panel">

          {loadedTabs.has('rules') ? (
            <TabPanel panelRootId={getAppTabRootId('rules')} tabLabel="Quy tắc KPI">

              <PAGE_MODULES.RulesEditor canEdit={canRulesEdit} currentUser={effectiveAuth} />

            </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="adjustments" className="ds-panel">

          {loadedTabs.has('adjustments') ? (
            <TabPanel panelRootId={getAppTabRootId('adjustments')} tabLabel="Điểm KPI +/- Thêm">

              <PAGE_MODULES.KPIAdjustments
                currentUser={effectiveAuth}
                onNavigate={requestTabNavigation}
              />

            </TabPanel>
          ) : null}

        </TabsContent>



        <TabsContent value="reports" className="ds-panel">

          {loadedTabs.has('reports') ? (
            <TabPanel panelRootId={getAppTabRootId('reports')} tabLabel="Báo cáo KPI">

              <PAGE_MODULES.ReportCenter
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
                    info="Kiểm tra đồng bộ, cảnh báo dữ liệu và backlog trước khi chuyển sang module xử lý tương ứng."
                  />
                  <PAGE_MODULES.DataHealthDashboard currentUser={effectiveAuth} canManage={canManageDataHealth} />
                </SectionSurface>

              </TabPanel>
            ) : null}

          </TabsContent>

        )}



        {canUseAi && (

          <TabsContent value="ai" className="ds-panel">

            {loadedTabs.has('ai') ? (
              <TabPanel panelRootId={getAppTabRootId('ai')} tabLabel="Trợ lý AI">

                <PAGE_MODULES.AiAssistant currentUser={effectiveAuth} />

              </TabPanel>
            ) : null}

          </TabsContent>

        )}



        {canManageAccounts && (

          <TabsContent value="accounts" className="ds-panel">

            {loadedTabs.has('accounts') ? (
              <TabPanel panelRootId={getAppTabRootId('accounts')} tabLabel="Tài khoản">

                <PAGE_MODULES.AccountManager currentUser={effectiveAuth} />

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

                  <PAGE_MODULES.AuditLog currentUser={effectiveAuth} />

                </div>

                <div className="space-y-6">

                  {/* @ts-expect-error ExportAuditReport is .jsx without TS types */}
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

                {/* @ts-expect-error ExportAuditReport is .jsx without TS types */}
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

