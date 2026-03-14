import React from "react";

export default function DataImporterUpdatedRowsBanner({
  isAdminRole = false,
  showUpdatedBanner = false,
  lastSyncUpdated = 0,
  lastSyncRunAtLabel = "",
  updatedPreview = [],
  updatedDeclarations = [],
  formatDeclarationLabel,
  onSelectUpdated,
  onClearSelection,
}) {
  if (!isAdminRole || !showUpdatedBanner) {
    return null;
  }

  return (
    <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">
            Cap nhat {lastSyncUpdated.toLocaleString("vi-VN")} to khai trong lan dong bo gan nhat
          </div>
          {lastSyncRunAtLabel ? (
            <div className="text-xs text-emerald-800/80">Thoi diem: {lastSyncRunAtLabel}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectUpdated}
            className="rounded border border-emerald-500 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Chon tren bang
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Bo chon
          </button>
        </div>
      </div>
      {updatedPreview.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {updatedPreview.map((entry) => (
            <span
              key={`${entry.so_tk}_${entry.nhanh || entry.branch || "main"}`}
              className="rounded bg-[color:var(--ds-surface-card)] px-2 py-0.5 text-emerald-700 shadow-sm"
            >
              {formatDeclarationLabel(entry)}
            </span>
          ))}
          {updatedDeclarations.length > updatedPreview.length ? (
            <span className="text-emerald-700">
              +{updatedDeclarations.length - updatedPreview.length} khac
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
