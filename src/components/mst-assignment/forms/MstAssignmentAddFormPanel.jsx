export default function MstAssignmentAddFormPanel({
  StaffComboboxComponent,
  draft,
  addError,
  rosterTeams,
  onSubmit,
  onMstChange,
  onCompanyChange,
  onImportSelect,
  onExportSelect,
  onTeamChange,
  onEffectiveFromChange,
  onEffectiveToChange,
  onCancel,
}) {
  const StaffCombobox = StaffComboboxComponent;

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Mã số thuế
          <input
            type="text"
            value={draft.mst}
            onChange={onMstChange}
            className="border rounded px-2 py-1"
            placeholder="Nhập mã số thuế"
            required
            data-tooltip="Nhập mã số thuế (chỉ chứa số)"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Tên công ty
          <input
            type="text"
            value={draft.company}
            onChange={onCompanyChange}
            className="border rounded px-2 py-1"
            placeholder="Tên công ty"
            data-tooltip="Tên doanh nghiệp tương ứng với MST"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Người phụ trách Nhập
          <StaffCombobox
            value={draft.person_import}
            teamValue={draft.team}
            teams={rosterTeams}
            placeholder="Chọn nhân viên nhập"
            ariaLabel="Người phụ trách Nhập"
            searchAriaLabel="Tìm người phụ trách Nhập"
            onSelect={onImportSelect}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Người phụ trách Xuất
          <StaffCombobox
            value={draft.person_export}
            teamValue={draft.team}
            teams={rosterTeams}
            placeholder="Chọn nhân viên xuất"
            ariaLabel="Người phụ trách Xuất"
            searchAriaLabel="Tìm người phụ trách Xuất"
            onSelect={onExportSelect}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Tổ đội (tuỳ chọn)
          <input
            type="text"
            value={draft.team}
            onChange={onTeamChange}
            className="border rounded px-2 py-1"
            placeholder="Tên tổ đội"
            data-tooltip="Ghi chú tổ đội/nhóm phụ trách nếu cần"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Áp dụng từ ngày
          <input
            type="date"
            value={draft.effective_from}
            onChange={onEffectiveFromChange}
            className="border rounded px-2 py-1"
            data-tooltip="Ngày bắt đầu áp dụng cấu hình"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Đến hết ngày (tuỳ chọn)
          <input
            type="date"
            value={draft.effective_to}
            onChange={onEffectiveToChange}
            className="border rounded px-2 py-1"
            data-tooltip="Ngày kết thúc hiệu lực. Để trống nếu áp dụng vô thời hạn."
          />
        </label>
      </div>
      {addError ? <p className="mt-2 text-sm text-red-600">{addError}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-emerald-600 text-white"
          data-tooltip="Thêm dòng này vào danh sách tạm"
        >
          Thêm vào danh sách
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
          data-tooltip="Đóng biểu mẫu thêm mới"
        >
          Hủy
        </button>
        <span className="text-xs text-gray-500">
          * Sau khi thêm, bấm Lưu để ghi dữ liệu vào hệ thống chính thức.
        </span>
      </div>
    </form>
  );
}
