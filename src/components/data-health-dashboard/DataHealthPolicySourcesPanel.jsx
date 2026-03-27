import React from 'react';

import clsx from 'clsx';

export default function DataHealthPolicySourcesPanel({
  statusSummary = {},
  sources = [],
  lockedSources = [],
  actionsDisabled = false,
  onLockSource,
  onUnlockSource,
}) {
  const sourceEntries = Array.isArray(sources) ? sources : [];
  const lockedEntries = Array.isArray(lockedSources) ? lockedSources : [];

  return (
    <div className="space-y-3">
      <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-gray-300">
        <div>• Nhóm chờ xử lý: {statusSummary.awaitingActionLabel}</div>
        <div>• Nhóm chờ rà soát: {statusSummary.pendingReviewLabel}</div>
        <div>• Nhóm thuộc nguồn khóa: {statusSummary.lockedLabel}</div>
        <div>• Lần đánh giá gần nhất: {statusSummary.lastEvaluatedAtLabel}</div>
      </div>

      <div className="rounded border border-gray-200 p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-200">
          <span>Nguồn dữ liệu</span>
          <span>Tác vụ</span>
        </div>

        <div className="max-h-64 overflow-auto">
          {sourceEntries.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Chưa có thống kê nguồn dữ liệu.</p>
          ) : (
            <ul className="space-y-2">
              {sourceEntries.map((item) => (
                <li
                  key={item.key}
                  className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-700 dark:text-gray-200">{item.source}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {item.awaitingActionLabel} nhóm chờ xử lý • {item.pendingReviewLabel} nhóm chờ rà soát
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => (item.locked ? onUnlockSource?.(item.source) : onLockSource?.(item.source))}
                        className={clsx(
                          'rounded border px-2 py-1 text-[11px]',
                          item.actionToneClass
                        )}
                        disabled={actionsDisabled}
                      >
                        {item.actionLabel}
                      </button>
                    </div>
                  </div>

                  {item.lockedAtLabel ? (
                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      Khóa lúc: {item.lockedAtLabel}
                      {item.lockedReasonLabel ? ` • ${item.lockedReasonLabel}` : ''}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded border border-gray-200 p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Nguồn đang khóa</div>
        <div className="mt-2 space-y-2">
          {lockedEntries.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Không có nguồn nào bị khóa.</p>
          ) : (
            lockedEntries.map((item) => (
              <div
                key={item.key}
                className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{item.source}</span>
                  <button
                    type="button"
                    className="rounded border border-amber-600 px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-200 dark:hover:bg-amber-400/20"
                    onClick={() => onUnlockSource?.(item.source)}
                    disabled={actionsDisabled}
                  >
                    Mở khóa
                  </button>
                </div>

                <div className="mt-1 text-[11px]">
                  Khóa bởi: {item.lockedByLabel} • {item.lockedAtLabel}
                </div>
                {item.reasonLabel ? <div className="mt-1 text-[11px] opacity-80">Lý do: {item.reasonLabel}</div> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
