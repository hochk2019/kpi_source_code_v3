import React from "react";

export default function DataImporterFileActions({
  fileInputRef,
  onFileChange,
  onOpenFilePicker,
  onImport,
  onLoadSavedRows,
  onOpenDeletedList,
  isReadOnlyForEdits = false,
  canEdit = false,
  canImport = false,
  importDisabledReason = "",
  canViewSavedRows = false,
  selectedFile = "",
  modeLabel = "",
  isImporting = false, // CRIT-001: Loading state
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        data-testid="import-file-input"
        ref={fileInputRef}
        onChange={onFileChange}
        accept=".xls,.xlsx"
        className="hidden"
        disabled={isReadOnlyForEdits}
      />
      {canEdit ? (
        <button
          type="button"
          onClick={onOpenFilePicker}
          className="px-3 py-1.5 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm hover:bg-[color:var(--ds-surface-muted)]"
        >
          Chọn file XLSX
        </button>
      ) : null}
      {selectedFile ? <span className="text-sm text-gray-600">Đã chọn: {selectedFile}</span> : null}
      {canEdit ? (
        <button
          type="button"
          onClick={onImport}
          disabled={!canImport || isImporting}
          className={`px-3 py-1.5 rounded ${
            canImport && !isImporting
              ? "bg-black text-white"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isImporting ? "Đang import..." : "Import XLSX"}
        </button>
      ) : null}
      {canEdit && !canImport && importDisabledReason ? (
        <p
          className="basis-full text-xs text-[color:var(--ds-text-muted)]"
          data-testid="import-disabled-reason"
        >
          {importDisabledReason}
        </p>
      ) : null}
      <button type="button" onClick={onLoadSavedRows} className="px-3 py-1.5 rounded border">
        Hiển thị dữ liệu đã lưu
      </button>
      {canViewSavedRows ? (
        <button
          type="button"
          onClick={onOpenDeletedList}
          className="px-3 py-1.5 rounded border"
          data-testid="deleted-list-trigger"
        >
          Danh sách tờ khai đã xóa
        </button>
      ) : null}
      <span className="ml-auto text-sm text-gray-600">{modeLabel}</span>
    </div>
  );
}
