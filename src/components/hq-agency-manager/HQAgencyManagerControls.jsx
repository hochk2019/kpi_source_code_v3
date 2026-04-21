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
    <div className="hq-agency-controls mb-6 group/hq-header relative">
      <div className="relative overflow-hidden rounded-2xl border border-teal-700/10 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-teal-700/20 hover:bg-white/80 dark:border-teal-400/20 dark:bg-slate-900/60 dark:hover:bg-slate-900/80">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-50/40 via-transparent to-primary/5 dark:from-teal-900/20 dark:to-transparent" />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Danh sách Đại lý Hải quan
              {dirty && <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Có thay đổi chưa lưu" />}
            </h2>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Gán Đại lý tự động cho các tờ khai import. Hỗ trợ nhập liệu nhiều đại lý bằng dấu phẩy (,).
            </p>

            {/* Quick Stats / History Snippet */}
            {historyOverview.total > 0 && (
              <div className="mt-2 flex items-center gap-3 text-[0.8rem] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 rounded-full bg-slate-100/50 px-2.5 py-0.5 border border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-700/50">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{historyOverview.total}</span> bản ghi
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-slate-100/50 px-2.5 py-0.5 border border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-700/50">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">+{historyOverview.last24h}</span> / 24h
                </span>
                {historyOverview.lastTimestamp && (
                  <span className="hidden sm:inline-block">
                    Update: <span className="font-medium text-slate-700 dark:text-slate-300">{formatHistoryTimestamp(historyOverview.lastTimestamp)}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={onRefreshHistory}
                  className="hover:text-primary hover:underline transition-colors ml-1"
                >
                  Làm mới
                </button>
              </div>
            )}
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
              <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title={selectedFile ? `Đã chọn: ${selectedFile}` : 'Upload file Excel (MST, Công ty, Đại lý HQ)'}
                >
                  {selectedFile ? 'Đổi File' : 'Chọn File XLS'}
                </button>
                <button
                  type="button"
                  onClick={onImport}
                  className="px-3 py-1.5 text-sm font-semibold bg-slate-800 text-white hover:bg-slate-900 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
                  disabled={isReadOnly || !selectedFile}
                >
                  Import
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={onAddRow}
                  className="rounded-xl border border-slate-200/60 px-4 py-1.5 text-sm font-medium text-slate-700 bg-white/50 hover:bg-slate-50 transition-all shadow-sm dark:border-slate-700/60 dark:text-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                  + Thêm dòng
                </button>
              )}

              <button
                type="button"
                onClick={onReload}
                className="rounded-xl border border-slate-200/60 px-4 py-1.5 text-sm font-medium text-slate-700 bg-white/50 hover:bg-slate-50 transition-all shadow-sm dark:border-slate-700/60 dark:text-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800"
              >
                Tải lại
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={onSave}
                  className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-1.5 text-sm font-semibold text-white shadow-sm hover:from-teal-700 hover:to-teal-600 focus:ring-2 focus:ring-teal-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!hasRows}
                >
                  Lưu cấu hình
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Warning / Error Banners */}
        {(isReadOnly || loadError) && (
          <div className="relative z-10 mt-4 rounded-xl border border-amber-200/50 bg-amber-50/50 p-3 text-sm text-amber-800 backdrop-blur-sm dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-200">
            {isReadOnly ? "Chế độ chỉ xem. Cần quyền quản trị để chỉnh sửa." : loadError}
          </div>
        )}

        {/* Filter Bar */}
        <div className="relative z-10 mt-5 pt-5 border-t border-slate-200/40 dark:border-slate-700/40 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                className="w-full rounded-xl border border-slate-200/60 bg-white/40 px-3 py-1.5 pl-9 text-sm text-slate-800 placeholder-slate-400 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800 transition-all"
                placeholder="Tìm MST, Công ty..."
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <FilterSelect
            value={agencyFilter}
            onChange={onAgencyFilterChange}
            options={agencySelectOptions}
            emptyLabel="Tất cả đại lý"
            placeholder="Lọc đại lý"
            triggerClassName="min-w-[160px] rounded-xl border-slate-200/60 bg-white/40 hover:bg-white/60 dark:border-slate-700/60 dark:bg-slate-800/40"
          />

          <FilterSelect
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Trạng thái"
            triggerClassName="min-w-[160px] rounded-xl border-slate-200/60 bg-white/40 hover:bg-white/60 dark:border-slate-700/60 dark:bg-slate-800/40"
          />

          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 transition-colors dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50"
          >
            Xóa lọc
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 bg-slate-100/50 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
              {filteredCount} mục • {safePage}/{totalPages}
            </span>
            <div className="flex rounded-xl border border-slate-200/60 bg-white/40 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/40 overflow-hidden">
              <button
                type="button"
                onClick={onPrevPage}
                disabled={safePage <= 1}
                className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors dark:text-slate-300 dark:hover:bg-slate-700 border-r border-slate-200/60 dark:border-slate-700/60"
              >
                «
              </button>
              <button
                type="button"
                onClick={onNextPage}
                disabled={safePage >= totalPages}
                className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors dark:text-slate-300 dark:hover:bg-slate-700"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
