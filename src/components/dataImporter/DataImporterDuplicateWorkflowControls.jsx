import React from "react";

export default function DataImporterDuplicateWorkflowControls({
  filterDuplicate11 = false,
  hasDuplicate11Rows = false,
  canResolveDuplicates11 = false,
  duplicate11GroupCount = 0,
  duplicate11PlannedRemovalCount = 0,
  duplicate11PlannedReviewGroups = 0,
  duplicate11TotalRows = 0,
  canEdit = false,
  mode = "preview",
  filteredKeyCount = 0,
  canAutoReconcile = false,
  onToggleDuplicateFilter,
  onDeleteDuplicates11,
  onAutoApplyLicenseExclusion,
}) {
  const showAutoReconcile = canEdit && mode === "saved";
  const autoReconcileEnabled = filteredKeyCount > 0 && canAutoReconcile;
  const autoReconcileTooltip = canAutoReconcile
    ? "Đối chiếu tự động loại trừ giấy phép cho toàn bộ tờ khai đang lọc"
    : "Chỉ Quản lý hoặc Quản trị viên mới được phép đối chiếu KPI tự động";

  return (
    <>
      <button
        type="button"
        onClick={onToggleDuplicateFilter}
        className={`rounded border px-3 py-1 text-xs ${
          filterDuplicate11
            ? "border-amber-400 bg-amber-50 text-amber-700"
            : hasDuplicate11Rows
              ? "text-gray-600 hover:bg-gray-50"
              : "text-gray-400 cursor-not-allowed"
        }`}
        disabled={!hasDuplicate11Rows}
      >
        {filterDuplicate11 ? "Đang lọc tờ khai trùng 11 số đầu" : "Lọc tờ khai trùng 11 số đầu"}
      </button>

      {canResolveDuplicates11 ? (
        <button
          type="button"
          onClick={onDeleteDuplicates11}
          className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
        >
          Xử lý tờ khai trùng 11 số đầu
        </button>
      ) : null}

      {hasDuplicate11Rows ? (
        <span className="text-xs text-amber-700">
          {duplicate11GroupCount.toLocaleString("vi-VN")} nhóm trùng •
          {` dự kiến xóa ${duplicate11PlannedRemovalCount.toLocaleString("vi-VN")} bản`}
          {duplicate11PlannedReviewGroups > 0
            ? ` • ${duplicate11PlannedReviewGroups.toLocaleString("vi-VN")} nhóm sẽ được đánh dấu rà soát`
            : ""}
          {duplicate11TotalRows > duplicate11PlannedRemovalCount
            ? ` • tổng ${duplicate11TotalRows.toLocaleString("vi-VN")} dòng`
            : ""}
        </span>
      ) : null}

      {showAutoReconcile ? (
        <button
          type="button"
          onClick={onAutoApplyLicenseExclusion}
          disabled={!autoReconcileEnabled}
          data-tooltip={autoReconcileTooltip}
          className={`rounded border px-3 py-1 text-xs ${
            autoReconcileEnabled
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "opacity-50 cursor-not-allowed"
          }`}
        >
          Đối chiếu KPI tự động
        </button>
      ) : null}
    </>
  );
}
