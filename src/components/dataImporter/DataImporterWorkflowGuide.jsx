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
    <section className="relative overflow-hidden p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-200/50 shadow-sm mb-2">
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Quản lý Nhập liệu</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            {headline}
          </p>
        </div>

        <div className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 ring-1 ring-inset ring-teal-600/20">
          GIAI ĐOẠN {currentStep}/3
        </div>
      </div>

      {actions.length > 0 && (
        <div className="mt-4 relative z-10 flex flex-wrap gap-3 items-center">
          <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold mr-2">Hành động:</span>
          {actions.map((action) => {
            const isPrimary = action.variant === "primary";
            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all shadow-sm ${isPrimary
                    ? "bg-teal-600 text-white hover:bg-teal-700 shadow-teal-500/20 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
                    : "border border-gray-200 bg-white/80 hover:bg-teal-50 text-gray-700"
                  }`}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
