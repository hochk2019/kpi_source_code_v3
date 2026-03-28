import React from "react";

import { FilterSelect } from "@/components/designSystem/primitives.jsx";
import { STATUS_FILTER_OPTIONS, formatHistoryTimestamp } from "@/components/hq-agency-manager/hqAgencyManagerModel.js";

export default function HQAgencyManagerControls({
  agencyFilter,
  agencySelectOptions,
  canEdit,
  dirty,
  fileRef,
  filteredCount,
  hasRows,
  historyOverview,
  isReadOnly,
  loadError,
  onAddRow,
  onAgencyFilterChange,
  onFilePick,
  onImport,
  onNextPage,
  onPrevPage,
  onRefreshHistory,
  onReload,
  onResetFilters,
  onSave,
  onSearchChange,
  onStatusFilterChange,
  safePage,
  search,
  selectedFile,
  statusFilter,
  totalPages,
}) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Danh sách Đại lý Hải quan hợp tác</h2>

          <p className="text-sm text-gray-500">
            Gán tên Đại lý theo từng MST để tự động chú thích khi import tờ khai.
          </p>

          <p className="text-xs text-gray-500">
            Một MST có thể gắn nhiều đại lý; hãy nhập và ngăn cách bằng dấu phẩy (,).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {dirty && <span className="text-amber-600">Có thay đổi chưa lưu</span>}

          <button type="button" onClick={onReload} className="rounded border px-3 py-1">
            Tải lại
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={onSave}
              className="rounded bg-amber-500 px-3 py-1 text-white hover:bg-amber-600"
              disabled={!hasRows}
            >
              Lưu cấu hình
            </button>
          )}
        </div>
      </header>

      {isReadOnly && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị để thêm hoặc chỉnh sửa danh
          sách Đại lý HQ.
        </div>
      )}

      {loadError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-secondary)]">
        {historyOverview.total === 0 ? (
          <span>Chưa ghi nhận lịch sử đồng bộ Đại lý HQ.</span>
        ) : (
          <>
            <span>
              <strong className="font-semibold text-[color:var(--ds-text-primary)]">
                {historyOverview.total}
              </strong>{" "}
              bản ghi lịch sử được lưu.
            </span>

            <span>
              24 giờ qua:{" "}
              <strong className="font-semibold text-[color:var(--ds-text-primary)]">
                {historyOverview.last24h}
              </strong>
            </span>

            {historyOverview.lastTimestamp && (
              <span>
                Cập nhật gần nhất:{" "}
                <strong className="font-semibold text-[color:var(--ds-text-primary)]">
                  {formatHistoryTimestamp(historyOverview.lastTimestamp)}
                </strong>
                {historyOverview.lastActor ? ` • ${historyOverview.lastActor}` : ""}
                {historyOverview.lastMst ? ` • MST ${historyOverview.lastMst}` : ""}
              </span>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onRefreshHistory}
          className="ml-auto rounded border border-[color:var(--ds-border-strong)] px-3 py-1 text-xs font-medium text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]"
        >
          Làm mới lịch sử
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          className="hidden"
          data-testid="hq-file-input"
          ref={fileRef}
          accept=".xls,.xlsx"
          onChange={onFilePick}
          disabled={isReadOnly}
        />

        {canEdit && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded border px-3 py-1.5"
          >
            Chọn file Excel
          </button>
        )}

        {selectedFile && <span className="text-sm text-gray-600">Đã chọn: {selectedFile}</span>}

        {canEdit && (
          <button
            type="button"
            onClick={onImport}
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
            disabled={isReadOnly}
          >
            Import Excel
          </button>
        )}

        {canEdit && (
          <button type="button" onClick={onAddRow} className="rounded border px-3 py-1.5">
            Thêm dòng mới
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FilterSelect
            value={agencyFilter}
            onChange={onAgencyFilterChange}
            options={agencySelectOptions}
            emptyLabel="Tất cả đại lý"
            placeholder="Lọc theo đại lý"
            triggerClassName="min-w-[180px]"
          />

          <FilterSelect
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Trạng thái"
            triggerClassName="min-w-[180px]"
          />

          <input
            className="w-64 rounded border px-2 py-1"
            placeholder="Tìm theo MST, Công ty hoặc Đại lý"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />

          <button
            type="button"
            onClick={onResetFilters}
            className="rounded border px-2 py-1 text-sm text-gray-600"
          >
            Xóa lọc
          </button>

          <span className="text-sm text-gray-500">
            {filteredCount} dòng • Trang {safePage}/{totalPages}
          </span>

          <button type="button" onClick={onPrevPage} className="rounded border px-2 py-1">
            « Trước
          </button>

          <button type="button" onClick={onNextPage} className="rounded border px-2 py-1">
            Sau »
          </button>
        </div>
      </div>
    </>
  );
}
