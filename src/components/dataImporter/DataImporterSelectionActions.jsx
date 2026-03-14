import React from "react";

export default function DataImporterSelectionActions({
  selectedCount = 0,
  filteredKeysLength = 0,
  filteredSelected = false,
  shouldUseServerSearch = false,
  canReview = false,
  canUnreview = false,
  canEdit = false,
  canDelete = false,
  onSelectFiltered,
  onMarkReviewed,
  onUnmarkReviewed,
  onDeleteSelected,
  onHardDeleteSelected,
  onApplyLicenseExclusion,
  onExportSelected,
  onClearSelection,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-gray-600">Đã chọn {selectedCount} tờ khai</span>
      <button
        type="button"
        onClick={onSelectFiltered}
        disabled={!filteredKeysLength || filteredSelected}
        data-tooltip={
          shouldUseServerSearch
            ? "Chỉ chọn các tờ khai trên trang hiện tại khi đang lọc trên máy chủ"
            : "Chọn toàn bộ tờ khai phù hợp với bộ lọc hiện tại"
        }
        className={`px-3 py-1 rounded border ${
          filteredKeysLength && !filteredSelected
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "opacity-50 cursor-not-allowed"
        }`}
      >
        Chọn tất cả kết quả lọc
      </button>
      <button
        type="button"
        onClick={onMarkReviewed}
        disabled={!canReview}
        className={`px-3 py-1 rounded border ${
          canReview ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "opacity-50 cursor-not-allowed"
        }`}
      >
        Đánh dấu đã rà soát
      </button>
      <button
        type="button"
        onClick={onUnmarkReviewed}
        disabled={!canUnreview}
        className={`px-3 py-1 rounded border ${
          canUnreview ? "bg-orange-50 text-orange-700 border-orange-300" : "opacity-50 cursor-not-allowed"
        }`}
      >
        Bỏ đánh dấu đã rà soát
      </button>
      {canEdit ? (
        <>
          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!canDelete}
            className={`px-3 py-1 rounded border ${
              canDelete ? "bg-red-50 text-red-600 border-red-300" : "opacity-50 cursor-not-allowed"
            }`}
          >
            Đánh dấu xóa các tờ khai đã chọn
          </button>
          <button
            type="button"
            onClick={onHardDeleteSelected}
            disabled={!canDelete}
            className={`px-3 py-1 rounded border ${
              canDelete
                ? "bg-red-200 text-red-700 border-red-400 hover:bg-red-300"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            Xóa vĩnh viễn các tờ khai đã chọn
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={onApplyLicenseExclusion}
        disabled={selectedCount === 0}
        data-tooltip="Đối chiếu lại giấy phép theo bộ quy tắc và loại bỏ mã bị loại trừ"
        className={`px-3 py-1 rounded border ${
          selectedCount
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "opacity-50 cursor-not-allowed"
        }`}
      >
        Đối chiếu giấy phép
      </button>
      <button
        type="button"
        onClick={onExportSelected}
        disabled={selectedCount === 0}
        data-tooltip="Xuất Excel danh sách tờ khai đã chọn"
        className={`px-3 py-1 rounded border ${
          selectedCount
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "opacity-50 cursor-not-allowed"
        }`}
      >
        Export Excel
      </button>
      {selectedCount > 0 ? (
        <button
          type="button"
          onClick={onClearSelection}
          className="px-3 py-1 rounded border"
        >
          Bỏ chọn
        </button>
      ) : null}
    </div>
  );
}
