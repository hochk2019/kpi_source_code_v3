// BackupSection.jsx
// Backup management UI section

import React from 'react';

export default function BackupSection({
  backupConfig,
  onConfigChange,
  lastBackup,
  nextBackup,
  backupHistory,
  onManualBackup,
  onRestore,
  isBackingUp,
}) {
  const formatDate = (date) => {
    if (!date) return 'Chưa có';
    return new Date(date).toLocaleString('vi-VN');
  };

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Sao lưu dữ liệu</h2>

      {/* Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Sao lưu gần nhất</div>
          <div className="font-medium">{formatDate(lastBackup)}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Sao lưu tiếp theo</div>
          <div className="font-medium">{formatDate(nextBackup)}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Tổng số bản sao</div>
          <div className="font-medium">{backupHistory?.length || 0}</div>
        </div>
      </div>

      {/* Configuration */}
      <div className="space-y-4 rounded border p-4">
        <h3 className="font-medium">Cấu hình sao lưu</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Lịch sao lưu (Cron)</label>
            <input
              type="text"
              value={backupConfig?.schedule || '0 2 * * *'}
              onChange={(e) => onConfigChange?.({ ...backupConfig, schedule: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="0 2 * * *"
            />
            <div className="text-xs text-gray-500 mt-1">
              Mặc định: 2:00 AM mỗi ngày
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Thư mục sao lưu</label>
            <input
              type="text"
              value={backupConfig?.directory || './backups'}
              onChange={(e) => onConfigChange?.({ ...backupConfig, directory: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="./backups"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Giữ lại (ngày)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={backupConfig?.retentionDays || 30}
              onChange={(e) => onConfigChange?.({ ...backupConfig, retentionDays: parseInt(e.target.value) })}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={onManualBackup}
              disabled={isBackingUp}
              className="w-full rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isBackingUp ? 'Đang sao lưu...' : 'Sao lưu ngay'}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      {backupHistory?.length > 0 && (
        <div className="rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-2 text-left">Thời gian</th>
                <th className="px-4 py-2 text-left">Kích thước</th>
                <th className="px-4 py-2 text-left">Trạng thái</th>
                <th className="px-4 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {backupHistory.slice(0, 10).map((backup) => (
                <tr key={backup.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{formatDate(backup.timestamp)}</td>
                  <td className="px-4 py-2">{backup.size || '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                        backup.status === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : backup.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {backup.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {backup.status === 'success' && (
                      <button
                        onClick={() => onRestore?.(backup)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Khôi phục
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
