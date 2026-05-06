import React from "react";

import { Switch } from "@/components/ui/switch.tsx";

function formatServerSearchStatus(serverSearchState) {
  if (!serverSearchState) {
    return null;
  }

  if (serverSearchState.loading) {
    return "Đang lọc trên máy chủ – đang tải...";
  }

  return `Đang lọc trên máy chủ • ${(serverSearchState.total || 0).toLocaleString("vi-VN")} dòng phù hợp`;
}

function formatDeletedRowsLabel(showDeletedRows, deletedRowCount) {
  if (showDeletedRows) {
    return "Ẩn bản ghi đã xóa";
  }

  if (deletedRowCount > 0) {
    return `Hiện bản ghi đã xóa (${deletedRowCount.toLocaleString("vi-VN")})`;
  }

  return "Hiện bản ghi đã xóa";
}

export default function DataImporterGridToolbarControls({
  shouldUseServerSearch = false,
  serverSearchState = null,
  total = 0,
  safePage = 1,
  maxPage = 1,
  viewMode = "table",
  freezeColumnsEnabled = false,
  appliedCardColumns = 0,
  effectiveCardColumns = 2,
  cardGridColumnOptions = [],
  pageSize = 20,
  pageSizeMode = "preset",
  pageSizeCustomInput = "",
  pageSizeOptions = [],
  showDeletedRows = false,
  deletedRowCount = 0,
  canEdit = false,
  canSave = false,
  onChangeViewMode,
  onChangeFreezeColumnsEnabled,
  onChangeCardGridColumns,
  onChangePageSizeSelect,
  onChangePageSizeCustomInput,
  onToggleShowDeletedRows,
  onPreviousPage,
  onNextPage,
  onSaveAll,
}) {
  const serverSearchStatus = formatServerSearchStatus(serverSearchState);
  const deletedRowsLabel = formatDeletedRowsLabel(showDeletedRows, deletedRowCount);

  return (
    <>
      {shouldUseServerSearch && serverSearchStatus ? (
        <div className="text-xs text-blue-600">
          {serverSearchStatus}
          {serverSearchState?.error ? (
            <span className="ml-2 text-red-600">{serverSearchState.error}</span>
          ) : null}
        </div>
      ) : null}
      <div className="opacity-70 text-sm">
        {total} dòng — Trang {safePage}/{maxPage}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded border border-gray-200 bg-white p-0.5 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => onChangeViewMode?.("table")}
            className={`rounded px-2 py-1 font-medium transition ${
              viewMode === "table"
                ? "bg-blue-700 text-white shadow"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700"
            }`}
          >
            Bảng
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode?.("card")}
            className={`rounded px-2 py-1 font-medium transition ${
              viewMode === "card"
                ? "bg-blue-700 text-white shadow"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700"
            }`}
          >
            Thẻ
          </button>
        </div>

        {viewMode === "table" ? (
          <label
            className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
            htmlFor="data-importer-freeze-toggle"
          >
            <span>Giữ cột cố định</span>
            <Switch
              id="data-importer-freeze-toggle"
              checked={freezeColumnsEnabled}
              onCheckedChange={(value) => onChangeFreezeColumnsEnabled?.(Boolean(value))}
            />
          </label>
        ) : (
          <label
            className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
            title={
              appliedCardColumns < effectiveCardColumns
                ? `Đang hiển thị tối đa ${appliedCardColumns} cột do giới hạn độ rộng`
                : undefined
            }
          >
            <span>Bố cục thẻ</span>
            <select
              value={effectiveCardColumns}
              onChange={(event) =>
                onChangeCardGridColumns?.(Number.parseInt(event.target.value, 10) || effectiveCardColumns)
              }
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100"
            >
              {cardGridColumnOptions.map((option) => (
                <option key={option} value={option}>{`${option} cột`}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-2">
          <select
            aria-label="Số dòng mỗi trang"
            value={pageSizeMode === "custom" ? "custom" : String(pageSize)}
            onChange={(event) => onChangePageSizeSelect?.(event.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}/trang</option>
            ))}
            <option value="custom">Tùy chọn...</option>
          </select>
          {pageSizeMode === "custom" ? (
            <input
              type="number"
              min={1}
              value={pageSizeCustomInput}
              onChange={(event) => onChangePageSizeCustomInput?.(event.target.value)}
              className="w-20 border rounded px-2 py-1 text-sm"
              aria-label="Số dòng mỗi trang tùy chọn"
            />
          ) : null}
        </div>

        <button
          type="button"
          onClick={onToggleShowDeletedRows}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700"
        >
          {deletedRowsLabel}
        </button>
        <button type="button" onClick={onPreviousPage} className="px-2 py-1 border rounded">
          « Trước
        </button>
        <button type="button" onClick={onNextPage} className="px-2 py-1 border rounded">
          Sau »
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={onSaveAll}
            disabled={!canSave}
            className={`px-3 py-1 rounded border ${canSave ? "" : "opacity-50 cursor-not-allowed"}`}
          >
            Lưu chỉnh sửa
          </button>
        ) : null}
      </div>
    </>
  );
}
