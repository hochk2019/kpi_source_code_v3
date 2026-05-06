import {
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "@/components/designSystem/shellPrimitives.tsx";

const HISTORY_TYPE_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "create", label: "Thêm mới" },
  { value: "update", label: "Chỉnh sửa" },
  { value: "delete", label: "Xóa" },
  { value: "status:assigned", label: "Chuyển sang Đã gán nhân viên" },
  { value: "status:pending", label: "Chuyển sang Chưa gán nhân viên" },
];

export default function MstAssignmentHistoryFilterPanel({
  filteredHistoryCount,
  totalHistoryCount,
  isHistoryFilterActive,
  historyFilter,
  quickFavorites,
  onResetHistoryFilter,
  onSaveActionFavorite,
  onHistoryFilterChange,
  onApplyActionFavorite,
  onRemoveQuickFavorite,
}) {
  const actionFavorites = quickFavorites?.action ?? [];

  return (
    <SectionSurface className="mb-4 border-sky-200 bg-sky-50">
      <SectionHeader
        title="Bộ lọc lịch sử thay đổi"
        description="Thu hẹp timeline theo khoảng ngày, loại thao tác hoặc mốc chuyển trạng thái trước khi rà soát chi tiết từng MST."
        meta={
          <div className="text-right text-xs text-sky-900">
            <div>
              Hiển thị {filteredHistoryCount} / {totalHistoryCount} bản ghi lịch sử.
            </div>
            <div>Áp dụng cho phần lịch sử của từng dòng bên dưới.</div>
            {isHistoryFilterActive ? (
              <div className="text-amber-700">
                * Danh sách MST cũng đang lọc theo điều kiện lịch sử này.
              </div>
            ) : null}
          </div>
        }
      />
      <SectionToolbar
        className="text-sm text-gray-700"
        mainClassName="items-end"
        actions={
          <>
            <button
              type="button"
              onClick={onResetHistoryFilter}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
              data-tooltip="Xóa bộ lọc lịch sử"
            >
              Xóa lọc
            </button>
            <button
              type="button"
              onClick={onSaveActionFavorite}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
              data-tooltip="Lưu nhanh bộ lọc thao tác hoặc trạng thái hiện tại"
            >
              Lưu thao tác/Trạng thái
            </button>
          </>
        }
      >
        <>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Từ ngày</span>
            <input
              type="date"
              value={historyFilter.from}
              onChange={(event) => onHistoryFilterChange({ from: event.target.value })}
              className="border rounded px-2 py-1"
              data-tooltip="Giới hạn lịch sử từ ngày này trở đi"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Đến ngày</span>
            <input
              type="date"
              value={historyFilter.to}
              onChange={(event) => onHistoryFilterChange({ to: event.target.value })}
              className="border rounded px-2 py-1"
              data-tooltip="Giới hạn lịch sử tới hết ngày này"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Thao tác / Chuyển trạng thái</span>
            <select
              value={historyFilter.type}
              onChange={(event) => onHistoryFilterChange({ type: event.target.value })}
              className="border rounded px-2 py-1"
              data-tooltip="Lọc theo thao tác thêm/sửa/xóa hoặc các mốc chuyển trạng thái của MST"
            >
              {HISTORY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </>
      </SectionToolbar>
      {actionFavorites.length ? (
        <div className="mt-1">
          <div className="text-xs font-semibold uppercase text-gray-500 mb-1">
            Bộ lọc thao tác/trạng thái đã lưu
          </div>
          <div className="flex flex-wrap gap-2">
            {actionFavorites.map((favorite) => (
              <div
                key={`action-${favorite.normalized}`}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700"
              >
                <button
                  type="button"
                  onClick={() => onApplyActionFavorite(favorite.value)}
                  className="font-medium hover:text-amber-900"
                >
                  {favorite.value}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveQuickFavorite("action", favorite.value)}
                  className="text-xs text-amber-600 hover:text-amber-800"
                  aria-label={`Xóa ${favorite.value}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </SectionSurface>
  );
}
