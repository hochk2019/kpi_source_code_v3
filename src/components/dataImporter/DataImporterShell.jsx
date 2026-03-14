import DataImporterCoCodeConfigPanel from "@/components/dataImporter/DataImporterCoCodeConfigPanel.jsx";
import DataImporterColumnConfigDialog from "@/components/dataImporter/DataImporterColumnConfigDialog.jsx";
import DataImporterDeletedRowsDialog from "@/components/dataImporter/DataImporterDeletedRowsDialog.jsx";
import DataImporterDuplicateDiffDialog from "@/components/dataImporter/DataImporterDuplicateDiffDialog.jsx";
import DataImporterDuplicateReviewDialog from "@/components/dataImporter/DataImporterDuplicateReviewDialog.jsx";
import DataImporterFileActions from "@/components/dataImporter/DataImporterFileActions.jsx";
import DataImporterImportPreviewSummary from "@/components/dataImporter/DataImporterImportPreviewSummary.jsx";
import DataImporterListControlsPanel from "@/components/dataImporter/DataImporterListControlsPanel.jsx";
import DataImporterMonitoringPanel from "@/components/dataImporter/DataImporterMonitoringPanel.jsx";
import DataImporterResultsPanel from "@/components/dataImporter/DataImporterResultsPanel.jsx";
import DataImporterSummaryCards from "@/components/dataImporter/DataImporterSummaryCards.jsx";
import DataImporterSyncConfigPanel from "@/components/dataImporter/DataImporterSyncConfigPanel.jsx";
import DataImporterUpdatedRowsBanner from "@/components/dataImporter/DataImporterUpdatedRowsBanner.jsx";
import DataImporterWorkflowGuide from "@/components/dataImporter/DataImporterWorkflowGuide.jsx";
import {
  SectionHeader,
  SectionSurface,
} from "@/components/designSystem/shellPrimitives.jsx";
import {
  buildWorkflowGuideState,
  getWorkflowStageStatus,
} from "@/components/dataImporter/dataImporterWorkflowGuideState.js";

function WorkflowStageSection({ ariaLabel, title, description, status, children, ...props }) {
  return (
    <SectionSurface
      aria-label={ariaLabel}
      className={`space-y-3 p-4 ${status.cardClass}`}
      {...props}
    >
      <SectionHeader
        title={title}
        description={description}
        meta={
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${status.badgeClass}`}
          >
            {status.label}
          </span>
        }
      />
      {children}
    </SectionSurface>
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
  const stageIdByNumber = new Map(workflowState.steps.map((step) => [step.number, step.targetId]));
  const sourceStageStatus = getWorkflowStageStatus(1, workflowState.currentStep);
  const reviewStageStatus = getWorkflowStageStatus(2, workflowState.currentStep);
  const saveStageStatus = getWorkflowStageStatus(3, workflowState.currentStep);

  return (
    <>
      <DataImporterDeletedRowsDialog {...deletedRowsDialogProps} />
      <DataImporterColumnConfigDialog {...columnConfigDialogProps} />
      <DataImporterDuplicateDiffDialog {...duplicateDiffDialogProps} />
      <DataImporterDuplicateReviewDialog {...duplicateReviewDialogProps} />

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

        <WorkflowStageSection
          id={stageIdByNumber.get(1)}
          ariaLabel="Bước 1: Nạp nguồn"
          title="1. Nạp nguồn"
          description="Chuẩn bị nguồn dữ liệu bằng file XLSX hoặc đồng bộ ECUS trước khi chuyển sang bước rà soát."
          status={sourceStageStatus}
        >
          <DataImporterSyncConfigPanel {...syncConfigPanelProps} />
          {isAdminRole ? <DataImporterCoCodeConfigPanel {...coCodeConfigProps} /> : null}
          <DataImporterFileActions {...fileActionsProps} />
        </WorkflowStageSection>

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
          {mode === "preview" ? (
            <>
              <DataImporterImportPreviewSummary {...importPreviewSummaryProps} />
              <DataImporterListControlsPanel {...listControlsPanelProps} />
              <DataImporterResultsPanel {...resultsPanelProps} />
            </>
          ) : (
            <DataImporterListControlsPanel {...listControlsPanelProps} />
          )}
        </WorkflowStageSection>

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
          {mode !== "preview" ? <DataImporterResultsPanel {...resultsPanelProps} /> : null}
          {isAdminRole ? <DataImporterMonitoringPanel {...monitoringPanelProps} /> : null}
          {mode === "preview" ? (
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              Import xong, toàn bộ workspace đã lưu và bề mặt theo dõi cảnh báo sẽ xuất hiện ở bước này.
            </p>
          ) : null}
        </WorkflowStageSection>
      </div>
    </>
  );
}
