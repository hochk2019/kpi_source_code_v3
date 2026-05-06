import SharedStaffCombobox from "@/components/shared/StaffCombobox.tsx";
import {
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "@/components/designSystem/shellPrimitives.tsx";
import { LEAD_VIEW_STATUSES } from "@/components/mst-assignment/hooks/useMSTAssignmentLeadViewWorkspace.js";

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
  leadViewEnabled = false,
  leadViewStatus = LEAD_VIEW_STATUSES.ALL,
  leadViewTeam = "",
  staffFilter,
  rosterTeams,
  onLeadViewEnabledChange,
  onLeadViewStatusChange,
  onLeadViewTeamChange,
  onResetLeadView,
  onClearStaffFilter,
  onSaveStaffFavorite,
  onStaffFilterSelect,
  onApplyStaffFavorite,
  onRemoveQuickFavorite,
}) {
  const staffFavorites = quickFavorites?.staff ?? [];
  const trimmedStaffFilter = typeof staffFilter === "string" ? staffFilter.trim() : "";
  const teamOptions = Array.isArray(rosterTeams)
    ? rosterTeams
        .map((team) => team?.name || "")
        .filter(Boolean)
    : [];
  const isLeadViewFiltered =
    leadViewEnabled &&
    (leadViewStatus !== LEAD_VIEW_STATUSES.ALL || Boolean(leadViewTeam.trim()));

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
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Lead-view rút gọn</div>
            <p className="text-xs text-slate-600">
              Tự động gom theo MST hiện hành để trưởng nhóm rà soát nhanh các ca đã gán đủ, chờ gán,
              hoặc theo team phụ trách.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={leadViewEnabled}
              onChange={(event) => onLeadViewEnabledChange?.(event.target.checked)}
            />
            Bật lead-view rút gọn
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc nhanh trạng thái lead-view">
            <button
              type="button"
              onClick={() => onLeadViewStatusChange?.(LEAD_VIEW_STATUSES.ALL)}
              disabled={!leadViewEnabled}
              className={
                leadViewStatus === LEAD_VIEW_STATUSES.ALL
                  ? "rounded border border-slate-900 bg-slate-900 px-3 py-1 text-sm text-white"
                  : "rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => onLeadViewStatusChange?.(LEAD_VIEW_STATUSES.ASSIGNED)}
              disabled={!leadViewEnabled}
              className={
                leadViewStatus === LEAD_VIEW_STATUSES.ASSIGNED
                  ? "rounded border border-emerald-700 bg-emerald-700 px-3 py-1 text-sm text-white"
                  : "rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              Đã gán đủ
            </button>
            <button
              type="button"
              onClick={() => onLeadViewStatusChange?.(LEAD_VIEW_STATUSES.PENDING)}
              disabled={!leadViewEnabled}
              className={
                leadViewStatus === LEAD_VIEW_STATUSES.PENDING
                  ? "rounded border border-amber-700 bg-amber-700 px-3 py-1 text-sm text-white"
                  : "rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              Chờ gán
            </button>
          </div>
          <label className="flex min-w-[12rem] flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium">Theo team</span>
            <select
              value={leadViewTeam}
              disabled={!leadViewEnabled}
              onChange={(event) => onLeadViewTeamChange?.(event.target.value)}
              className="rounded border bg-white px-2 py-1 disabled:cursor-not-allowed disabled:bg-slate-100"
              aria-label="Lọc lead-view theo team"
            >
              <option value="">Tất cả team</option>
              {teamOptions.map((teamName) => (
                <option key={teamName} value={teamName}>
                  {teamName}
                </option>
              ))}
            </select>
          </label>
          {leadViewEnabled ? (
            <button
              type="button"
              onClick={onResetLeadView}
              className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-50"
            >
              {isLeadViewFiltered ? "Xóa bộ lọc lead-view" : "Tắt lead-view"}
            </button>
          ) : null}
        </div>
      </div>
    </SectionSurface>
  );
}
