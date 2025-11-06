import React from "react";

export default function PickerSection({ context }) {
  const {
    fileInputRef,
    onFileChange,
    isReadOnlyForEdits,
    canEdit,
    onSelectFile,
    selectedFile,
    onImport,
    canImport,
    onShowSavedRows,
    canViewSavedRows,
    onOpenDeleted,
    modeLabel,
  } = context;

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
          onClick={onSelectFile}
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
          disabled={!canImport}
          className={`px-3 py-1.5 rounded ${canImport ? "bg-black text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
        >
          Import XLSX
        </button>
      ) : null}
      <button type="button" onClick={onShowSavedRows} className="px-3 py-1.5 rounded border">
        Hiển thị dữ liệu đã lưu
      </button>
      {canViewSavedRows ? (
        <button
          type="button"
          onClick={onOpenDeleted}
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
