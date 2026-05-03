import { Suspense, lazy } from "react";
import { t } from '@/lib/i18n.js';

import DataImporterSummaryCards from "@/components/dataImporter/DataImporterSummaryCards.jsx";
import DataImporterUpdatedRowsBanner from "@/components/dataImporter/DataImporterUpdatedRowsBanner.jsx";
import DataImporterWorkflowGuide from "@/components/dataImporter/DataImporterWorkflowGuide.jsx";
import {
  buildWorkflowGuideState,
  getWorkflowStageStatus,
} from "@/components/dataImporter/dataImporterWorkflowGuideState.js";
import { Info } from "lucide-react";

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
  const workflowState = buildWorkflowGuideState(workflowGuideProps);
  const previewSource = workflowGuideProps?.previewSource || null;
  const hasRows = !!workflowGuideProps?.hasRows;
  const stageIdByNumber = new Map(workflowState.steps.map((step) => [step.number, step.targetId]));
  const sourceStageStatus = getWorkflowStageStatus(1, workflowState.currentStep);
  const reviewStageStatus = getWorkflowStageStatus(2, workflowState.currentStep);
  const saveStageStatus = getWorkflowStageStatus(3, workflowState.currentStep);

  return (
    <>
      <Suspense fallback={null}>
        <DataImporterDeletedRowsDialog {...deletedRowsDialogProps} />
        <DataImporterColumnConfigDialog {...columnConfigDialogProps} />
        <DataImporterDuplicateDiffDialog {...duplicateDiffDialogProps} />
        <DataImporterDuplicateReviewDialog {...duplicateReviewDialogProps} />
      </Suspense>

      <div ref={rootRef} className="import-data-view space-y-3">
        {!canUploadFiles && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="font-semibold">{t('import.noPermission.title')}</div>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
              {t('import.noPermission.desc', { permission: 'Import Data – tải file' })}
            </p>
          </div>
        )}
        {isReadOnlyForEdits && !canManageAlerts && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
            {t('import.readonly.view')}
          </div>
        )}
        {isReadOnlyForEdits && canManageAlerts && (
          <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-200">
            {t('import.readonly.alerts')}
          </div>
        )}

        <DataImporterWorkflowGuide {...workflowGuideProps} />

        {workflowState.currentStep === 1 && (
          <WorkflowStageSection
            id={stageIdByNumber.get(1)}
            ariaLabel={t('import.step.source.title')}
            title={t('import.step.source.title')}
            description={t('import.step.source.desc')}
            status={sourceStageStatus}
          >
            <Suspense fallback={<StageLoadingState message={t('import.loading.source')} />}>
              <DataImporterSyncConfigPanel {...syncConfigPanelProps} />
              {isAdminRole ? <DataImporterCoCodeConfigPanel {...coCodeConfigProps} /> : null}
              <DataImporterFileActions {...fileActionsProps} />
            </Suspense>
          </WorkflowStageSection>
        )}

        {workflowState.currentStep === 2 && (
          <WorkflowStageSection
            id={stageIdByNumber.get(2)}
            ariaLabel={t('import.step.review.title')}
            title={t('import.step.review.title')}
            description={
              mode === "preview"
                ? previewSource === "sync"
                  ? t('import.step.review.desc.sync')
                  : t('import.step.review.desc.preview')
                : t('import.step.review.desc.workspace')
            }
            status={reviewStageStatus}
          >
            <Suspense fallback={<StageLoadingState message={t('import.loading.review')} />}>
              {mode === "preview" ? (
                <>
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
                </>
              ) : (
                <DataImporterListControlsPanel {...listControlsPanelProps} />
              )}
            </Suspense>
          </WorkflowStageSection>
        )}

        {hasRows && (
          <WorkflowStageSection
            id={stageIdByNumber.get(3)}
            ariaLabel={t('import.step.save.title')}
            title={t('import.step.save.title')}
            description={
              mode === "preview"
                ? t('import.step.save.desc.preview')
                : t('import.step.save.desc.workspace')
            }
            status={saveStageStatus}
          >
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
              {isAdminRole ? <DataImporterMonitoringPanel {...monitoringPanelProps} /> : null}
            </Suspense>
            {mode === "preview" ? (
              <p className="text-xs text-[color:var(--ds-text-muted)]">
                {t('import.afterImport.note')}
              </p>
            ) : null}
          </WorkflowStageSection>
        )}
      </div>
    </>
  );
}
