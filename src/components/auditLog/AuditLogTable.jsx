// AuditLogTable.jsx
// Audit log entry list table

import React from 'react';

export default function AuditLogTable({
  logs,
  filteredLogs,
  isLoading,
  formatTime,
  inferCategoryFromAction,
  normalizeNote,
  onRowClick,
}) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2" />
        <div>Đang tải...</div>
      </div>
    );
  }

  if (!filteredLogs?.length) {
    return (
      <div className="p-8 text-center text-gray-500">
        Không tìm thấy bản ghi nào
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50/50">
            <th className="px-3 py-2 text-left font-medium">Thời gian</th>
            <th className="px-3 py-2 text-left font-medium">Phân loại</th>
            <th className="px-3 py-2 text-left font-medium">Hành động</th>
            <th className="px-3 py-2 text-left font-medium">Người thực hiện</th>
            <th className="px-3 py-2 text-left font-medium">Kết quả</th>
            <th className="px-3 py-2 text-left font-medium">Chi tiết</th>
            <th className="px-3 py-2 text-left font-medium">Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.map((entry, index) => (
            <tr
              key={`${entry.ts}-${index}`}
              onClick={() => onRowClick?.(entry)}
              className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer ${
                index % 2 === 0
                  ? 'bg-white/40 dark:bg-slate-900/40'
                  : 'bg-transparent'
              }`}
            >
              <td className="px-3 py-2 whitespace-nowrap align-top">
                {formatTime?.(entry.ts) || entry.ts}
              </td>
              <td className="px-3 py-2 whitespace-nowrap align-top">
                {(entry.category || inferCategoryFromAction?.(entry.action) || 'other').toUpperCase()}
              </td>
              <td className="px-3 py-2 align-top font-medium text-[color:var(--ds-text-primary)]">
                {entry.action}
              </td>
              <td className="px-3 py-2 align-top">{entry.actor || 'system'}</td>
              <td className="px-3 py-2 align-top">
                {entry.result ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      entry.result === 'success'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : entry.result === 'failure'
                          ? 'bg-red-500/15 text-red-300'
                          : 'bg-slate-500/20 text-slate-200'
                    }`}
                  >
                    {entry.result}
                  </span>
                ) : (
                  <span className="text-[color:var(--ds-text-muted)]">—</span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-pre-wrap align-top text-[color:var(--ds-text-secondary)]">
                <div className="space-y-1">
                  <div>{entry.detail || '—'}</div>
                  {entry.meta && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[color:var(--ds-text-muted)]">
                        Metadata
                      </summary>
                      <pre className="max-h-40 overflow-auto rounded bg-[color:var(--ds-surface-muted)] p-2 text-[color:var(--ds-text-muted)]">
                        {JSON.stringify(entry.meta, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 align-top text-[color:var(--ds-text-secondary)]">
                {normalizeNote?.(entry.note) || entry.note || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
