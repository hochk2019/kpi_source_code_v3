import SharedStaffCombobox from "@/components/shared/StaffCombobox.jsx";
import {
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "@/components/designSystem/shellPrimitives.jsx";

const StaffCombobox = (props) => (
  <SharedStaffCombobox
    {...props}
    allowCustom
    preserveTeamOnCustom
    preserveTeamOnClear
  />
);

export default function MstAssignmentStaffFilterPanel({
  quickFavorites,
  staffFilter,
  rosterTeams,
  onClearStaffFilter,
  onSaveStaffFavorite,
  onStaffFilterSelect,
  onApplyStaffFavorite,
  onRemoveQuickFavorite,
}) {
  const staffFavorites = quickFavorites?.staff ?? [];
  const trimmedStaffFilter = typeof staffFilter === "string" ? staffFilter.trim() : "";

  return (
    <SectionSurface className="mb-4">
      <SectionHeader
        title="Bộ lọc nhân viên phụ trách"
        description="Cô lập working set theo nhân viên và lưu lại các bộ lọc thường dùng cho thao tác quản trị hằng ngày."
        meta={
          staffFavorites.length ? (
            <span className="ds-pill">{staffFavorites.length} bộ lọc nhanh</span>
          ) : null
        }
      />
      <SectionToolbar
        mainClassName="items-center"
        actions={
          <>
            {staffFilter ? (
              <button
                type="button"
                onClick={onClearStaffFilter}
                className="px-2 py-1 rounded border bg-white hover:bg-gray-50"
              >
                Xóa lọc
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSaveStaffFavorite}
              className="px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-900"
              disabled={!trimmedStaffFilter}
            >
              Lưu bộ lọc nhân viên
            </button>
          </>
        }
      >
        <div className="w-full sm:w-72">
          <StaffCombobox
            value={staffFilter}
            teamValue=""
            onSelect={onStaffFilterSelect}
            teams={rosterTeams}
            placeholder="Chọn nhân viên"
            ariaLabel="Lọc theo nhân viên phụ trách"
            searchAriaLabel="Tìm nhân viên phụ trách"
          />
        </div>
      </SectionToolbar>
      {staffFavorites.length ? (
        <div className="mt-1">
          <div className="text-xs font-semibold uppercase text-gray-500 mb-1">Bộ lọc nhanh</div>
          <div className="flex flex-wrap gap-2">
            {staffFavorites.map((favorite) => (
              <div
                key={`staff-${favorite.normalized}`}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
              >
                <button
                  type="button"
                  onClick={() => onApplyStaffFavorite(favorite.value)}
                  className="font-medium hover:text-slate-900"
                >
                  {favorite.value}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveQuickFavorite("staff", favorite.value)}
                  className="text-xs text-slate-500 hover:text-slate-700"
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
