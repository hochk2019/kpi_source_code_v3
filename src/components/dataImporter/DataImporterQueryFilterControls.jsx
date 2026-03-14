import React from "react";

import { SearchField } from "@/components/designSystem/shellPrimitives.jsx";

export default function DataImporterQueryFilterControls({
  query = "",
  mainSearchHelpTextId,
  datePreset = "none",
  dateRangePresets = [],
  searchRange = { from: "", to: "" },
  filterNoStaff = false,
  filterNoTeam = false,
  coFilterMode = "all",
  coFilterMin = 0,
  coFilterActive = false,
  coFilterMatches = 0,
  coFilterOptions = [],
  onQueryChange,
  onClearQuery,
  onDatePresetChange,
  onSearchRangeFromChange,
  onSearchRangeToChange,
  onClearSearchRange,
  onFilterNoStaffChange,
  onFilterNoTeamChange,
  onCoFilterModeChange,
  onCoFilterMinChange,
}) {
  return (
    <>
      <div className="flex min-w-[260px] flex-1 flex-col gap-2">
        <SearchField
          label="Tìm nhanh danh sách tờ khai"
          hideLabel
          value={query}
          onChange={(event) => onQueryChange?.(event.target.value)}
          onClear={onClearQuery}
          placeholder="Tìm nhanh (Số TK / MST / Công ty / Nhân viên / Tổ đội)"
          aria-describedby={mainSearchHelpTextId}
        />

        <span id={mainSearchHelpTextId} className="text-xs text-gray-500">
          Nhập từ khóa để tìm nhanh theo Số tờ khai, mã số thuế, tên doanh nghiệp, nhân viên hoặc tổ đội phụ trách.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1 text-sm" data-tooltip="Chọn nhanh khoảng thời gian theo preset">
          <span>Khoảng</span>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={datePreset}
            onChange={(event) => onDatePresetChange?.(event.target.value)}
          >
            {dateRangePresets.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Tự chọn</option>
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-sm" data-tooltip="Lọc từ ngày (theo ngày đăng ký tờ khai)">
            <span>Từ ngày</span>
            <input
              type="date"
              value={searchRange.from || ""}
              onChange={(event) => onSearchRangeFromChange?.(event.target.value)}
              className="rounded border px-2 py-1 text-sm"
            />
          </label>

          <label className="flex items-center gap-1 text-sm" data-tooltip="Lọc đến ngày (theo ngày đăng ký tờ khai)">
            <span>Đến ngày</span>
            <input
              type="date"
              value={searchRange.to || ""}
              onChange={(event) => onSearchRangeToChange?.(event.target.value)}
              className="rounded border px-2 py-1 text-sm"
            />
          </label>

          {searchRange.from || searchRange.to ? (
            <button
              type="button"
              onClick={onClearSearchRange}
              data-tooltip="Xóa điều kiện lọc theo ngày"
              className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              Xóa lọc ngày
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={filterNoStaff}
              onChange={(event) => onFilterNoStaffChange?.(event.target.checked)}
            />
            <span>Chưa gán Nhân viên</span>
          </label>

          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={filterNoTeam}
              onChange={(event) => onFilterNoTeamChange?.(event.target.checked)}
            />
            <span>Chưa gán Tổ đội</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            <span>Lọc C/O</span>
            <select
              value={coFilterMode}
              onChange={(event) => onCoFilterModeChange?.(event.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              {coFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {coFilterMode === "min" ? (
            <label className="flex items-center gap-1 text-sm">
              <span>Tối thiểu dòng C/O</span>
              <input
                type="number"
                min={0}
                className="w-20 rounded border px-2 py-1 text-sm"
                value={coFilterMin}
                onChange={(event) => onCoFilterMinChange?.(event.target.value)}
              />
            </label>
          ) : null}

          {coFilterActive ? (
            <span className="rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-700">
              Đáp ứng C/O: {coFilterMatches} tờ khai
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}
