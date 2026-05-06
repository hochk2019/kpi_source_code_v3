import { Suspense, lazy, useState } from "react";
import { t } from '@/lib/i18n.js';

import DataImporterSummaryCards from "@/components/dataImporter/DataImporterSummaryCards.jsx";
import DataImporterUpdatedRowsBanner from "@/components/dataImporter/DataImporterUpdatedRowsBanner.jsx";
import {
  buildWorkflowGuideState,
  getWorkflowStageStatus,
} from "@/components/dataImporter/dataImporterWorkflowGuideState.js";
import { PageHeader } from '@/components/designSystem/PageHeader';
import { PermissionBanner } from '@/components/designSystem/primitives';
import { FileUp, History, RefreshCw, Table } from "lucide-react";

const DataImporterCoCodeConfigPanel = lazy(
  () => import("@/components/dataImporter/DataImporterCoCodeConfigPanel.jsx"),
);
const DataImporterColumnConfigDialog = lazy(
  () => import("@/components/dataImporter/DataImporterColumnConfigDialog.jsx"),
);
const DataImporterDeletedRowsDialog = lazy(
  () => import("@/components/dataImporter/DataImporterDeletedRowsDialog.jsx"),
);
const DataImporterDuplicateDiffDialog = lazy(
  () => import("@/components/dataImporter/DataImporterDuplicateDiffDialog.jsx"),
);
const DataImporterDuplicateReviewDialog = lazy(
  () => import("@/components/dataImporter/DataImporterDuplicateReviewDialog.jsx"),
);
const DataImporterFileActions = lazy(
  () => import("@/components/dataImporter/DataImporterFileActions.jsx"),
);
const DataImporterImportPreviewSummary = lazy(
  () => import("@/components/dataImporter/DataImporterImportPreviewSummary.jsx"),
);
const DataImporterListControlsPanel = lazy(
  () => import("@/components/dataImporter/DataImporterListControlsPanel.jsx"),
);
const DataImporterMonitoringPanel = lazy(
  () => import("@/components/dataImporter/DataImporterMonitoringPanel.jsx"),
);
const DataImporterResultsPanel = lazy(
  () => import("@/components/dataImporter/DataImporterResultsPanel.jsx"),
);
const DataImporterSyncConfigPanel = lazy(
  () => import("@/components/dataImporter/DataImporterSyncConfigPanel.jsx"),
);

function WorkflowStageSection({ ariaLabel, title, description, status, children, ...props }) {
  return (
    <div
      aria-label={ariaLabel}
      className={`rounded-2xl p-6 shadow-sm border border-gray-200/50 bg-white/40 backdrop-blur-md space-y-4 ${status.cardClass}`}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">{title}</h2>
          {description && (
            <div title={description} className="text-gray-400 hover:text-teal-600 transition-colors cursor-help">
              <Info size={16} />
            </div>
          )}
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${status.badgeClass}`}
        >
          {status.label}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function StageLoadingState({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded border border-dashed border-[color:var(--ds-border-subtle)] px-3 py-2 text-xs text-[color:var(--ds-text-muted)]"
    >
      {message}
    </div>
  );
}

export default function DataImporterShell({
  rootRef,
  canUploadFiles,
  isReadOnlyForEdits,
  canManageAlerts,
  isAdminRole,
  mode,
  deletedRowsDialogProps,
  columnConfigDialogProps,
  duplicateDiffDialogProps,
  duplicateReviewDialogProps,
  workflowGuideProps,
  summaryCardsProps,
  updatedRowsBannerProps,
  syncConfigPanelProps,
  coCodeConfigProps,
  monitoringPanelProps,
  fileActionsProps,
  importPreviewSummaryProps,
  listControlsPanelProps,
  resultsPanelProps,
}) {
  const [activeTab, setActiveTab] = useState('table');
  const workflowState = buildWorkflowGuideState(workflowGuideProps);
  const previewSource = workflowGuideProps?.previewSource || null;
  const hasRows = !!workflowGuideProps?.hasRows;
  const stageIdByNumber = new Map(workflowState.steps.map((step) => [step.number, step.targetId]));
  const sourceStageStatus = getWorkflowStageStatus(1, workflowState.currentStep);
  const reviewStageStatus = getWorkflowStageStatus(2, workflowState.currentStep);
  const saveStageStatus = getWorkflowStageStatus(3, workflowState.currentStep);

  // Permission banner message
  let permissionBanner = null;
  if (!canUploadFiles) {
    permissionBanner = {
      level: 'warning',
      title: t('import.noPermission.title'),
      description: t('import.noPermission.desc', { permission: 'Import Data – tải file' }),
    };
  } else if (isReadOnlyForEdits && !canManageAlerts) {
    permissionBanner = {
      level: 'warning',
      title: t('import.readonly.title') || 'Chế độ xem',
      description: t('import.readonly.view'),
    };
  } else if (isReadOnlyForEdits && canManageAlerts) {
    permissionBanner = {
      level: 'info',
      title: t('import.readonly.alertsTitle') || 'Chế độ cảnh báo',
      description: t('import.readonly.alerts'),
    };
  }

  const tabs = [
    { id: 'table', label: 'Bảng tờ khai', icon: Table },
    { id: 'preview', label: 'Xem trước', icon: FileUp },
    { id: 'sync', label: 'Đồng bộ ECUS', icon: RefreshCw },
    { id: 'history', label: 'Lịch sử', icon: History },
  ];

  return (
    <>
      <Suspense fallback={null}>
        <DataImporterDeletedRowsDialog {...deletedRowsDialogProps} />
        <DataImporterColumnConfigDialog {...columnConfigDialogProps} />
        <DataImporterDuplicateDiffDialog {...duplicateDiffDialogProps} />
        <DataImporterDuplicateReviewDialog {...duplicateReviewDialogProps} />
      </Suspense>

      <div ref={rootRef} className="import-data-view space-y-3">
        <PageHeader
          eyebrow="VẬN HÀNH"
          title="Import dữ liệu"
          info="Quản lý import tờ khai, đồng bộ ECUS, và lịch sử thay đổi"
          meta={[
            mode === 'preview' && previewSource === 'sync' ? 'Xem trước đồng bộ' :
            mode === 'preview' ? 'Xem trước import' : 'Dữ liệu đã lưu'
          ].filter(Boolean)}
        />

        {permissionBanner && (
          <PermissionBanner
            level={permissionBanner.level}
            title={permissionBanner.title}
            description={permissionBanner.description}
          />
        )}

        {/* Page Tabs */}
        <div className="border-b border-ds-border-subtle">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-ds-accent text-ds-accent'
                      : 'border-transparent text-ds-text-secondary hover:text-ds-text-primary'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'table' && (
          <div className="space-y-3">
            {workflowState.currentStep === 1 && (
              <Suspense fallback={<StageLoadingState message={t('import.loading.source')} />}>
                <DataImporterSyncConfigPanel {...syncConfigPanelProps} />
                {isAdminRole ? <DataImporterCoCodeConfigPanel {...coCodeConfigProps} /> : null}
                <DataImporterFileActions {...fileActionsProps} />
              </Suspense>
            )}

            {workflowState.currentStep === 2 && mode === "preview" && (
              <Suspense fallback={<StageLoadingState message={t('import.loading.review')} />}>
                {!hasRows ? (
                  <>
                    <DataImporterSyncConfigPanel {...syncConfigPanelProps} />
                    {isAdminRole ? <DataImporterCoCodeConfigPanel {...coCodeConfigProps} /> : null}
                    <DataImporterFileActions {...fileActionsProps} />
                  </>
                ) : null}
                <DataImporterImportPreviewSummary {...importPreviewSummaryProps} />
                <DataImporterListControlsPanel {...listControlsPanelProps} />
                <DataImporterResultsPanel {...resultsPanelProps} />
              </Suspense>
            )}

            {hasRows && (
              <>
                <DataImporterSummaryCards {...summaryCardsProps} />
                <DataImporterUpdatedRowsBanner {...updatedRowsBannerProps} />
                <Suspense fallback={<StageLoadingState message={t('import.loading.save')} />}>
                  <DataImporterSyncConfigPanel {...syncConfigPanelProps} />
                  {isAdminRole ? <DataImporterCoCodeConfigPanel {...coCodeConfigProps} /> : null}
                  <DataImporterFileActions {...fileActionsProps} />
                  {mode !== "preview" ? (
                    <>
                      <DataImporterListControlsPanel {...listControlsPanelProps} />
                      <DataImporterResultsPanel {...resultsPanelProps} />
                    </>
                  ) : null}
                </Suspense>
                {mode === "preview" && (
                  <p className="text-xs text-ds-text-muted">
                    {t('import.afterImport.note')}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'preview' && workflowState.currentStep >= 2 && (
          <Suspense fallback={<StageLoadingState message={t('import.loading.review')} />}>
            <DataImporterImportPreviewSummary {...importPreviewSummaryProps} />
          </Suspense>
        )}

        {activeTab === 'sync' && isAdminRole && (
          <Suspense fallback={<StageLoadingState message={t('import.loading.sync')} />}>
            <DataImporterSyncConfigPanel {...syncConfigPanelProps} />
            <DataImporterMonitoringPanel {...monitoringPanelProps} />
          </Suspense>
        )}

        {activeTab === 'history' && (
          <div className="text-sm text-ds-text-muted">
            {t('import.history.comingSoon', { defaultValue: 'Lịch sử import sẽ hiển thị tại đây' })}
          </div>
        )}
      </div>
    </>
  );
}
