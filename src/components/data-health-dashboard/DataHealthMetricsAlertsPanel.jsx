import React from 'react';

import clsx from 'clsx';

export default function DataHealthMetricsAlertsPanel({
  metrics = [],
  duplicateSummary = {},
  alertSummary = {},
}) {
  const duplicateGroups = Array.isArray(duplicateSummary.groups) ? duplicateSummary.groups : [];
  const alertEntries = Array.isArray(alertSummary.entries) ? alertSummary.entries : [];

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={clsx(
              'rounded p-4 text-sm shadow-sm backdrop-blur transition',
              metric.toneClass
            )}
          >
            <div className="text-xs uppercase tracking-wide opacity-75">{metric.label}</div>
            <div className="mt-2 text-2xl font-semibold">{metric.value ?? '—'}</div>
            <div className="mt-1 text-xs opacity-80">{metric.description}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nhóm trùng 11 số cần xử lý</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{duplicateSummary.countLabel}</span>
          </div>

          <div className="mt-3 space-y-3 text-sm">
            {duplicateGroups.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Không phát hiện nhóm trùng nào.</p>
            ) : (
              duplicateGroups.map((group) => (
                <div
                  key={group.key}
                  className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide">
                    <span>{group.prefix}</span>
                    <span>{group.totalLabel}</span>
                  </div>
                  <div className="mt-1 text-xs text-amber-700 dark:text-amber-200/80">
                    Tổ/chi nhánh: {group.branch || 'Chưa xác định'}
                  </div>
                  <div className="mt-2 text-xs text-amber-700/80 dark:text-amber-100/70">
                    Giữ lại: {group.keepLabel}
                  </div>
                  {group.duplicates.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      {group.duplicates.map((row) => (
                        <li key={row.key}>{row.label}</li>
                      ))}
                      {group.remainingLabel ? <li className="italic">{group.remainingLabel}</li> : null}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cảnh báo cần xử lý</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Đánh giá lần cuối: {alertSummary.lastEvaluatedAtLabel}
            </span>
          </div>

          <div className="mt-3 space-y-3 text-sm">
            {alertEntries.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Không có cảnh báo tồn đọng.</p>
            ) : (
              alertEntries.map((alert) => (
                <div
                  key={alert.key}
                  className="rounded border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide">
                    <span>{alert.soTkLabel}</span>
                    <span>{alert.dateLabel}</span>
                  </div>

                  <div className="mt-1 text-xs">MST: {alert.mstLabel} • Công ty: {alert.companyLabel}</div>
                  <div className="mt-1 text-xs">Thiếu: {alert.missingLabel}</div>
                  <div className="mt-1 text-xs">
                    Nhân viên: {alert.staffLabel} • Tổ đội: {alert.teamLabel}
                  </div>
                  <div className="mt-1 text-xs opacity-80">Cảnh báo lần cuối: {alert.lastAlertAtLabel}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
