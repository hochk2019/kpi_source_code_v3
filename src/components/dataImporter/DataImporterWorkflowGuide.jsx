import React from "react";
import {
  buildWorkflowGuideState,
  getWorkflowStageStatus,
} from "@/components/dataImporter/dataImporterWorkflowGuideState.js";

export default function DataImporterWorkflowGuide({
  mode = "saved",
  canEdit = false,
  canImport = false,
  canSave = false,
  canUploadFiles = false,
  canManageSync = false,
  selectedFile = "",
  previewRowCount = 0,
  previewSource = null,
  syncPreviewRowCount = 0,
  previewLoading = false,
  syncRunning = false,
  hasRows = false,
  hasUnsaved = false,
  onOpenFilePicker,
  onImport,
  onLoadSavedRows,
  onSaveAll,
  onPreviewSync,
  onRunSync,
}) {
  const { actions, currentStep, headline, steps } = buildWorkflowGuideState({
    mode,
    canEdit,
    canImport,
    canSave,
    canManageSync,
    canUploadFiles,
    selectedFile,
    previewRowCount,
    previewSource,
    syncPreviewRowCount,
    previewLoading,
    syncRunning,
    hasRows,
    hasUnsaved,
    onOpenFilePicker,
    onImport,
    onLoadSavedRows,
    onSaveAll,
    onPreviewSync,
    onRunSync,
  });

  return (
    <section className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--ds-text-muted)]">
            Workflow nhập liệu
          </div>
          <div className="text-lg font-semibold text-[color:var(--ds-text-primary)]">
            {headline}
          </div>
        </div>
        <div className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
          {`Bước ${currentStep}/3`}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ds-text-muted)]">
            Bước kế tiếp đề xuất
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => {
              const isPrimary = action.variant === "primary";
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                    isPrimary
                      ? "bg-black text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                      : "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] hover:bg-[color:var(--ds-surface-muted)]"
                  }`}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {steps.map((step) => {
          const status = getWorkflowStageStatus(step.number, currentStep);
          return (
            <a
              key={step.number}
              href={`#${step.targetId}`}
              aria-current={step.number === currentStep ? "step" : undefined}
              className={`block rounded-lg border p-3 transition-colors hover:border-[color:var(--ds-border-strong)] ${status.cardClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                    {step.title}
                  </div>
                  <div className="text-xs leading-5 text-[color:var(--ds-text-muted)]">
                    {step.detail}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${status.badgeClass}`}
                >
                  {status.label}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
