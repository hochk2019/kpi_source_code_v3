import React from "react";

import DataImporterDuplicateWorkflowControls from "@/components/dataImporter/DataImporterDuplicateWorkflowControls.jsx";
import DataImporterFilterPresetControls from "@/components/dataImporter/DataImporterFilterPresetControls.jsx";
import DataImporterGridToolbarControls from "@/components/dataImporter/DataImporterGridToolbarControls.jsx";
import DataImporterQueryFilterControls from "@/components/dataImporter/DataImporterQueryFilterControls.jsx";
import DataImporterSelectionActions from "@/components/dataImporter/DataImporterSelectionActions.jsx";
import {
  SectionHeader,
  SectionSurface,
} from "@/components/designSystem/shellPrimitives.jsx";

export default function DataImporterListControlsPanel({
  mode = "saved",
  previewSource = null,
  total = 0,
  canEdit = false,
  canOverwriteData = false,
  autoAssignStaff = false,
  upsert11 = false,
  overwrite = false,
  pageSize = 20,
  query = "",
  visibleColumnCount = 0,
  totalBaseColumns = 0,
  selectionEnabled = false,
  queryFilterControlsProps = {},
  filterPresetControlsProps = {},
  duplicateWorkflowControlsProps = {},
  gridToolbarControlsProps = {},
  selectionActionsProps = {},
  onAutoAssignStaffChange,
  onUpsert11Change,
  onOverwriteToggle,
  onOpenColumnConfig,
}) {
  const isSyncPreview = mode === "preview" && previewSource === "sync";

  return (
    <SectionSurface
      aria-label="Điều khiển danh sách tờ khai"
      className="space-y-3 p-4"
    >
      <SectionHeader
        title="Điều khiển danh sách tờ khai"
        description="Tìm kiếm, lọc và điều chỉnh cách hiển thị dữ liệu import trước khi rà soát hoặc lưu."
        meta={
          <>
            <span className="rounded-full border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ds-text-secondary)]">
              {mode === "saved" ? "Dữ liệu đã lưu" : isSyncPreview ? "Xem trước đồng bộ" : "Xem trước import"}
            </span>
            <span className="rounded-full border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2.5 py-1 text-xs font-medium text-[color:var(--ds-text-secondary)]">
              {total.toLocaleString("vi-VN")} dòng
            </span>
          </>
        }
      />

      {canEdit && !isSyncPreview ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={autoAssignStaff}
              onChange={(event) => onAutoAssignStaffChange?.(event.target.checked)}
            />
            <span>Tự gán nhân viên theo MST nếu trống (ON)</span>
          </label>

          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={upsert11}
              onChange={(event) => onUpsert11Change?.(event.target.checked)}
            />
            <span>Upsert theo 11 số đầu của Số tờ khai</span>
          </label>

          {canOverwriteData ? (
            <label className="flex items-center gap-1 text-amber-700">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(event) => onOverwriteToggle?.(event.target.checked)}
              />
              <span>Ghi đè toàn bộ dữ liệu hiện có</span>
            </label>
          ) : null}
        </div>
      ) : null}

      <form
        aria-label="Bộ lọc tờ khai import"
        className="space-y-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="flex w-full flex-wrap gap-4">
          <DataImporterQueryFilterControls {...queryFilterControlsProps} />
          <DataImporterFilterPresetControls {...filterPresetControlsProps} />
          <DataImporterDuplicateWorkflowControls {...duplicateWorkflowControlsProps} />
          <DataImporterGridToolbarControls {...gridToolbarControlsProps} />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <span>
            Đang hiển thị {visibleColumnCount}/{totalBaseColumns} cột dữ liệu.
          </span>

          <button
            type="button"
            onClick={onOpenColumnConfig}
            className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50"
          >
            Cấu hình cột hiển thị
          </button>
        </div>

        {!query && mode === "saved" ? (
          <div className="text-xs text-gray-500">
            Hiển thị tối đa {pageSize} dòng trên một trang. Nhập từ khóa hoặc dùng bộ lọc để tìm thêm tờ khai.
          </div>
        ) : null}
      </form>

      {selectionEnabled ? <DataImporterSelectionActions {...selectionActionsProps} /> : null}
    </SectionSurface>
  );
}
