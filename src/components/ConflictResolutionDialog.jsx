// ConflictResolutionDialog.jsx
// SYNC-001: UI cho việc resolve conflicts giữa local và server data

import React from "react";

export default function ConflictResolutionDialog({
  isOpen = false,
  localData = null,
  serverData = null,
  dataType = "data", // 'declarations', 'rules', 'settings', etc.
  conflictFields = [],
  onResolve,
  onCancel,
  onClose,
}) {
  if (!isOpen) return null;

  const handleServerWins = () => {
    onResolve?.({ strategy: "server-wins", data: serverData });
    onClose?.();
  };

  const handleLocalWins = () => {
    onResolve?.({ strategy: "local-wins", data: localData });
    onClose?.();
  };

  const handleMerge = () => {
    onResolve?.({ strategy: "merge", data: { local: localData, server: serverData } });
    onClose?.();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
    >
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2
          id="conflict-title"
          className="mb-4 text-xl font-semibold text-gray-900"
        >
          Phát hiện xung đột dữ liệu
        </h2>

        <p className="mb-6 text-gray-600">
          Dữ liệu <strong>{dataType}</strong> trên máy chủ đã thay đổi kể từ lần
          đồng bộ cuối. Bạn muốn giữ phiên bản nào?
        </p>

        {conflictFields.length > 0 && (
          <div className="mb-6 rounded-lg bg-amber-50 p-4">
            <h3 className="mb-2 font-medium text-amber-800">
              Các trường bị xung đột:
            </h3>
            <ul className="list-inside list-disc text-sm text-amber-700">
              {conflictFields.map((field) => (
                <li key={field}>
                  {field}:{" "}
                  <span className="text-green-600">{String(localData?.[field] ?? "-")}</span>
                  {" vs "}
                  <span className="text-blue-600">{String(serverData?.[field] ?? "-")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {/* Local Data Card */}
          <div
            data-testid="local-card"
            className={`rounded-lg border-2 p-4 ${
              localData ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
            }`}
          >
            <h3 className="mb-2 font-semibold text-green-800">📁 Phiên bản Local</h3>
            <p className="mb-2 text-sm text-green-700">
              Cập nhật lúc: {localData?.updatedAt ? new Date(localData.updatedAt).toLocaleString("vi-VN") : "Không rõ"}
            </p>
            <p className="text-xs text-green-600">
              Version: {localData?.version ?? "N/A"}
            </p>
            <button
              type="button"
              data-testid="local-wins-button"
              onClick={handleLocalWins}
              className="mt-3 w-full rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Giữ phiên bản Local
            </button>
          </div>

          {/* Server Data Card */}
          <div
            data-testid="server-card"
            className={`rounded-lg border-2 p-4 ${
              serverData ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"
            }`}
          >
            <h3 className="mb-2 font-semibold text-blue-800">☁️ Phiên bản Server</h3>
            <p className="mb-2 text-sm text-blue-700">
              Cập nhật lúc: {serverData?.updatedAt ? new Date(serverData.updatedAt).toLocaleString("vi-VN") : "Không rõ"}
            </p>
            <p className="text-xs text-blue-600">
              Version: {serverData?.version ?? "N/A"}
            </p>
            <button
              type="button"
              data-testid="server-wins-button"
              onClick={handleServerWins}
              className="mt-3 w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Giữ phiên bản Server
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <button
            type="button"
            data-testid="cancel-button"
            onClick={handleCancel}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Hủy bỏ
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              data-testid="merge-button"
              onClick={handleMerge}
              disabled={!localData || !serverData}
              className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              Gộp cả hai (Merge)
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-4 rounded bg-gray-50 p-3 text-xs text-gray-500">
          <p className="font-medium">💡 Lưu ý:</p>
          <ul className="mt-1 list-inside list-disc">
            <li>"Giữ phiên bản Server" sẽ ghi đè dữ liệu local bằng dữ liệu từ máy chủ</li>
            <li>"Giữ phiên bản Local" sẽ đẩy dữ liệu local lên máy chủ</li>
            <li>"Gộp cả hai" sẽ cố gắng kết hợp dữ liệu từ cả hai nguồn (nếu có thể)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
