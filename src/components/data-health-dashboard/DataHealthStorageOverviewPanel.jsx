import React from 'react';

import clsx from 'clsx';

export default function DataHealthStorageOverviewPanel({
  backup = {},
  database = {},
  sql = {},
}) {
  const recentEntries = Array.isArray(backup.recentEntries) ? backup.recentEntries : [];
  const scheduleReasons = Array.isArray(backup.scheduleReasons) ? backup.scheduleReasons : [];

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Trạng thái sao lưu CSDL</h3>
          <span className={clsx('rounded px-2 py-0.5 text-xs font-semibold', backup.badgeClass)}>
            {backup.severityLabel}
          </span>
        </div>

        <dl className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium">Lần thành công gần nhất</dt>
            <dd className="text-right text-gray-700 dark:text-gray-100">{backup.lastSuccessAtLabel}</dd>
          </div>

          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium">Thời gian tương đối</dt>
            <dd className="text-right text-gray-700 dark:text-gray-100">{backup.relativeLabel}</dd>
          </div>

          <div>
            <dt className="font-medium">Đường dẫn lưu</dt>
            <dd className="mt-1 truncate text-[11px] text-gray-700 dark:text-gray-200">
              {backup.directory || '—'}
            </dd>
          </div>

          <div>
            <dt className="font-medium">Tệp gần nhất</dt>
            <dd className="mt-1 truncate text-[11px] text-gray-700 dark:text-gray-200">{backup.fileLabel}</dd>
          </div>

          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium">Lần chạy kế tiếp</dt>
            <dd className="text-right text-gray-700 dark:text-gray-100">{backup.nextRunLabel}</dd>
          </div>

          {backup.lastFailureAtLabel ? (
            <div>
              <dt className="font-medium text-red-600 dark:text-red-300">Lỗi gần nhất</dt>
              <dd className="mt-1 text-[11px] text-red-600 dark:text-red-300">
                {backup.lastFailureAtLabel}
                {backup.lastFailureReason ? ` • ${backup.lastFailureReason}` : ''}
              </dd>
            </div>
          ) : null}

          {scheduleReasons.length > 0 ? (
            <div>
              <dt className="font-medium">Ghi chú lịch</dt>
              <dd className="mt-1 space-y-1 text-[11px]">
                {scheduleReasons.map((reason) => (
                  <div key={reason}>• {reason}</div>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-3 rounded border border-gray-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Nhật ký gần đây
          </div>
          <div className="mt-2 space-y-2">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className={clsx('rounded border px-2 py-1 text-[11px] leading-relaxed', entry.toneClass)}
              >
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <span>{entry.statusLabel}</span>
                  <span>{entry.timestampLabel}</span>
                </div>
                <div className="mt-1 text-[11px] opacity-80">{entry.detail}</div>
                {entry.reasonLabel ? <div className="mt-1 text-[11px] opacity-70">{entry.reasonLabel}</div> : null}
              </div>
            ))}

            {recentEntries.length === 0 ? (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Chưa có nhật ký sao lưu.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Dung lượng hệ thống</h3>
          <span className={clsx('rounded px-2 py-0.5 text-xs font-semibold', database.badgeClass)}>
            {database.severityLabel}
          </span>
        </div>

        <dl className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300">
          <div>
            <dt className="font-medium">Tệp CSDL</dt>
            <dd className="mt-1 truncate text-[11px] text-gray-700 dark:text-gray-200">{database.file || '—'}</dd>
          </div>

          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium">Dung lượng</dt>
            <dd className="text-right text-gray-700 dark:text-gray-100">{database.sizeLabel}</dd>
          </div>

          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium">Cập nhật file</dt>
            <dd className="text-right text-gray-700 dark:text-gray-100">{database.updatedAtLabel}</dd>
          </div>

          {database.sqliteStatsAvailable ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium">Trang sử dụng</dt>
                <dd className="text-right text-gray-700 dark:text-gray-100">
                  {database.sqliteUsedPages ?? '—'} / {database.sqliteTotalPages ?? '—'}
                  {database.sqliteUsedPercentLabel ? ` • ${database.sqliteUsedPercentLabel}` : ''}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium">Trang trống</dt>
                <dd className="text-right text-gray-700 dark:text-gray-100">
                  {database.sqliteFreePages ?? 0}
                  {database.sqliteFreePercentLabel ? ` • ${database.sqliteFreePercentLabel}` : ''}
                  {database.sqliteHasFreeBytes ? ` (${database.sqliteFreeLabel})` : ''}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium">Kích thước trang</dt>
                <dd className="text-right text-gray-700 dark:text-gray-100">{database.sqlitePageSizeLabel}</dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium">Dung lượng thực dùng</dt>
                <dd className="text-right text-gray-700 dark:text-gray-100">{database.sqliteUsedLabel}</dd>
              </div>
            </>
          ) : null}

          {database.isMemoryDb ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              Hệ thống đang chạy CSDL ở chế độ bộ nhớ. Hãy cấu hình file thực tế để sao lưu được dữ liệu.
            </div>
          ) : null}

          {database.sqliteStatsError ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              Không thể thống kê trang dữ liệu SQLite: {database.sqliteStatsError}
            </div>
          ) : null}
        </dl>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span>Đã dùng: {database.diskUsedLabel}</span>
            <span>{database.diskUsedPercentLabel}</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-slate-700">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all dark:bg-emerald-400"
              style={{ width: `${database.diskUsedPercentWidth ?? 0}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span>Còn trống: {database.diskFreeLabel}</span>
            <span>Tổng: {database.diskTotalLabel}</span>
          </div>
          {database.methodLabel ? (
            <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Nguồn số liệu: {database.methodLabel}</div>
          ) : null}
          {database.warningMessage ? (
            <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-200">{database.warningMessage}</div>
          ) : null}
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Trạng thái SQL Server</h3>
          <span className={clsx('rounded px-2 py-0.5 text-xs font-semibold', sql.badgeClass)}>
            {sql.severityLabel}
          </span>
        </div>

        <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{sql.title}</div>
          <p className="text-xs leading-relaxed">{sql.message}</p>

          {sql.checkedAtLabel ? (
            <div className="text-[11px] text-gray-500 dark:text-gray-400">Kiểm tra gần nhất: {sql.checkedAtLabel}</div>
          ) : null}

          {sql.code ? <div className="text-[11px] text-gray-500 dark:text-gray-400">Mã lỗi: {sql.code}</div> : null}
          {sql.number ? <div className="text-[11px] text-gray-500 dark:text-gray-400">SQL Number: {sql.number}</div> : null}
        </div>
      </div>
    </section>
  );
}
