import React from "react";

import {
  MST_HISTORY_FIELD_LABELS,
  formatTeamManagerHistoryTimestamp,
} from "@/components/team-manager/teamManagerHistoryModel.js";

function TeamManagerHistoryPanel({
  historyOpen,
  historyTab,
  teamHistory,
  mstHistory,
  onHistoryTabChange,
  onRefresh,
}) {
  if (!historyOpen) return null;

  return (
    <div className="border rounded-lg bg-white shadow-sm p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-gray-700">Lịch sử thay đổi</span>
        <button
          type="button"
          onClick={() => onHistoryTabChange("team")}
          className={`px-3 py-1 rounded border text-xs ${
            historyTab === "team"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white hover:bg-gray-50"
          }`}
          title="Các lần lưu chỉnh sửa tổ đội"
          data-tooltip="Hiển thị lịch sử lưu tổ đội"
        >
          Tổ đội
        </button>
        <button
          type="button"
          onClick={() => onHistoryTabChange("mst")}
          className={`px-3 py-1 rounded border text-xs ${
            historyTab === "mst"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white hover:bg-gray-50"
          }`}
          title="Các lần chỉnh sửa trường MST (người phụ trách, hiệu lực)"
          data-tooltip="Hiển thị lịch sử chỉnh sửa MST"
        >
          MST
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-auto px-3 py-1 rounded border text-xs bg-white hover:bg-gray-50"
          title="Làm mới lịch sử từ bộ nhớ"
          data-tooltip="Tải lại lịch sử"
        >
          Làm mới
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto text-sm text-gray-700 pr-1">
        {historyTab === "team" ? (
          teamHistory.length ? (
            <ul className="space-y-2">
              {teamHistory.map((entry, idx) => (
                <li
                  key={`${entry.ts || "team"}-${idx}`}
                  className="border rounded px-3 py-2 bg-gray-50"
                >
                  <div className="font-medium text-gray-800">
                    {formatTeamManagerHistoryTimestamp(entry.ts)} — {entry.actor || "Hệ thống"}
                  </div>
                  <div className="text-xs text-gray-600">{entry.detail || "Cập nhật tổ đội"}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="italic text-gray-500">Chưa ghi nhận lịch sử lưu tổ đội.</p>
          )
        ) : mstHistory.length ? (
          <ul className="space-y-2">
            {mstHistory.map((entry) => (
              <li key={entry.id} className="border rounded px-3 py-2 bg-gray-50">
                <div className="font-medium text-gray-800">
                  {formatTeamManagerHistoryTimestamp(entry.timestamp)} — {entry.actor || "Hệ thống"}
                </div>
                <div className="text-xs text-gray-600">
                  MST: <span className="font-semibold">{entry.mst}</span> ·{" Trường: "}
                  {MST_HISTORY_FIELD_LABELS[entry.field] || entry.field}
                </div>
                <div className="text-xs text-gray-600">
                  <span className="text-gray-500">Từ:</span>{" "}
                  {entry.from ? (
                    <span>{entry.from}</span>
                  ) : (
                    <span className="italic text-gray-400">(trống)</span>
                  )}
                </div>
                <div className="text-xs text-gray-600">
                  <span className="text-gray-500">Đến:</span>{" "}
                  {entry.to ? (
                    <span>{entry.to}</span>
                  ) : (
                    <span className="italic text-gray-400">(trống)</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="italic text-gray-500">Chưa ghi nhận lịch sử thay đổi trường MST.</p>
        )}
      </div>
    </div>
  );
}

export default TeamManagerHistoryPanel;
