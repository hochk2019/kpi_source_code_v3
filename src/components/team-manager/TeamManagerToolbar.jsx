import React from "react";

function TeamManagerToolbar({
  dirty,
  isReadOnly,
  roster,
  totalMembers,
  onSave,
  onReloadRoster,
  onRefreshMST,
  historyOpen,
  onToggleHistory,
  onExportExcel,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onSave}
        disabled={!dirty || isReadOnly}
        className={`px-3 py-1 rounded text-white ${
          dirty && !isReadOnly ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400"
        }`}
        title={isReadOnly ? "Chỉ người được cấp quyền mới có thể lưu" : "Lưu thay đổi tổ đội"}
      >
        Lưu thay đổi
      </button>

      <button onClick={onReloadRoster} className="px-3 py-1 rounded border">
        Hoàn tác về dữ liệu đã lưu
      </button>

      <button onClick={onRefreshMST} className="px-3 py-1 rounded border">
        Tải lại dữ liệu MST
      </button>

      <button
        type="button"
        onClick={onToggleHistory}
        className={`px-3 py-1 rounded border transition-colors ${
          historyOpen ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"
        }`}
        title={
          historyOpen
            ? "Ẩn bảng lịch sử thay đổi tổ đội và gán MST"
            : "Xem lịch sử thay đổi tổ đội, team và trường MST liên quan"
        }
        data-tooltip="Xem/ẩn lịch sử thay đổi team và MST"
      >
        {historyOpen ? "Ẩn lịch sử" : "Lịch sử cập nhật"}
      </button>

      {dirty && !isReadOnly && <span className="text-sm text-amber-600">Có thay đổi chưa lưu</span>}

      {isReadOnly && (
        <span className="text-sm text-amber-600">Chế độ chỉ xem — không thể lưu thay đổi</span>
      )}

      <button
        type="button"
        onClick={onExportExcel}
        className="ml-auto px-3 py-1 rounded border bg-white hover:bg-gray-50"
      >
        Export Excel
      </button>

      <span className="text-sm text-gray-500 ml-2">
        Tổng cộng {roster.teams.length} tổ đội — {totalMembers} thành viên
      </span>
    </div>
  );
}

export default TeamManagerToolbar;
