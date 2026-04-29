// AuditLogDetail.jsx
// Detail view for a single audit log entry

import React from 'react';

export default function AuditLogDetail({ entry, onClose, formatTime, inferCategoryFromAction }) {
  if (!entry) return null;

  const formatJSON = (data) => JSON.stringify(data, null, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Chi tiết bản ghi</h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Thời gian</div>
              <div className="font-medium">{formatTime?.(entry.ts) || entry.ts}</div>
            </div>
            <div>
              <div className="text-gray-500">Phân loại</div>
              <div className="font-medium">
                {(entry.category || inferCategoryFromAction?.(entry.action) || 'other').toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Hành động</div>
              <div className="font-medium">{entry.action}</div>
            </div>
            <div>
              <div className="text-gray-500">Người thực hiện</div>
              <div className="font-medium">{entry.actor || 'system'}</div>
            </div>
            <div>
              <div className="text-gray-500">Kết quả</div>
              <div className="font-medium">
                {entry.result ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      entry.result === 'success'
                        ? 'bg-emerald-100 text-emerald-700'
                        : entry.result === 'failure'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {entry.result}
                  </span>
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>

          {entry.detail && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Chi tiết</div>
              <div className="rounded bg-gray-50 p-3 text-sm">{entry.detail}</div>
            </div>
          )}

          {entry.note && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Ghi chú</div>
              <div className="rounded bg-gray-50 p-3 text-sm">{entry.note}</div>
            </div>
          )}

          {entry.meta && Object.keys(entry.meta).length > 0 && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Metadata</div>
              <pre className="max-h-60 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                {formatJSON(entry.meta)}
              </pre>
            </div>
          )}

          {entry.stack && (
            <div>
              <div className="text-sm text-red-500 mb-1">Stack Trace</div>
              <pre className="max-h-60 overflow-auto rounded bg-red-50 p-3 text-xs text-red-900">
                {entry.stack}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
