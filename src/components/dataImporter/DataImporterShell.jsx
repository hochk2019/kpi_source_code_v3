import { Suspense, lazy } from "react";

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
            <div className="font-semibold">Bạn chưa được cấp quyền tải file Import Data.</div>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
              Liên hệ quản lý hoặc quản trị viên để bật quyền{" "}
              <strong>Import Data – tải file</strong>. Nếu cần xử lý gấp, hãy gửi file cho quản trị
              viên để họ hỗ trợ import thay.
            </p>
          </div>
        )}
        {isReadOnlyForEdits && !canManageAlerts && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
            Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản được cấp quyền để import, chỉnh sửa
            và lưu dữ liệu tờ khai.
          </div>
        )}
        {isReadOnlyForEdits && canManageAlerts && (
          <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-200">
            Bạn có thể rà soát và đánh dấu các tờ khai thiếu thông tin nhưng không thể chỉnh sửa dữ
            liệu tờ khai.
          </div>
        )}

        <DataImporterWorkflowGuide {...workflowGuideProps} />

        {workflowState.currentStep === 1 && (
          <WorkflowStageSection
            id={stageIdByNumber.get(1)}
            ariaLabel="Bước 1: Nạp nguồn"
            title="1. Nạp nguồn"
            description="Chuẩn bị nguồn dữ liệu bằng file XLSX hoặc đồng bộ ECUS trước khi chuyển sang bước rà soát."
            status={sourceStageStatus}
          >
            <Suspense fallback={<StageLoadingState message="Đang tải khối nạp nguồn dữ liệu..." />}>
              <DataImporterSyncConfigPanel {...syncConfigPanelProps} />
              {isAdminRole ? <DataImporterCoCodeConfigPanel {...coCodeConfigProps} /> : null}
              <DataImporterFileActions {...fileActionsProps} />
            </Suspense>
          </WorkflowStageSection>
        )}

        {workflowState.currentStep === 2 && (
          <WorkflowStageSection
            id={stageIdByNumber.get(2)}
            ariaLabel="Bước 2: Rà soát dữ liệu"
            title="2. Rà soát dữ liệu"
            description={
              mode === "preview"
                ? previewSource === "sync"
                  ? "Kiểm tra dữ liệu xem trước từ ECUS, áp bộ lọc rà soát, rồi quyết định có chạy đồng bộ vào workspace hay không."
                  : "Kiểm tra dữ liệu xem trước, xử lý bộ lọc và quyết định có import vào workspace hay không."
                : "Điều chỉnh bộ lọc và cách hiển thị để rà soát workspace trước khi chốt thay đổi."
            }
            status={reviewStageStatus}
          >
            <Suspense fallback={<StageLoadingState message="Đang tải khối rà soát dữ liệu..." />}>
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
            ariaLabel="Bước 3: Lưu và theo dõi"
            title="3. Lưu và theo dõi"
            description={
              mode === "preview"
                ? "Sau khi import, dữ liệu sẽ chuyển sang workspace đã lưu để tiếp tục theo dõi và xử lý hậu kiểm."
                : "Chốt thay đổi, theo dõi cảnh báo sau đồng bộ, và tiếp tục giám sát dữ liệu đã lưu."
            }
            status={saveStageStatus}
          >
            <DataImporterSummaryCards {...summaryCardsProps} />
            <DataImporterUpdatedRowsBanner {...updatedRowsBannerProps} />
            <Suspense fallback={<StageLoadingState message="Đang tải khối lưu và theo dõi..." />}>
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
                Import xong, toàn bộ workspace đã lưu và bề mặt theo dõi cảnh báo sẽ xuất hiện ở bước này.
              </p>
            ) : null}
          </WorkflowStageSection>
        )}
      </div>
    </>
  );
}
