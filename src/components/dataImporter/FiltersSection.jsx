import React from "react";

export default function FiltersSection({ context }) {
  if (!context) {
    return null;
  }

  const {
    query,
    setQuery,
    setPage,
    datePreset,
    setDatePreset,
    applyDatePreset,
    searchRange,
    setSearchRange,
    handleClearSearchRange,
    filterNoStaff,
    setFilterNoStaff,
    filterNoTeam,
    setFilterNoTeam,
    coFilterMode,
    setCoFilterMode,
    coFilterMin,
    setCoFilterMin,
    coFilterActive,
    coFilterMatches,
    dateRangePresets,
    coFilterOptions,
  } = context;

  return (
    <>
      <div className="flex min-w-[260px] flex-1 flex-col gap-2">
        <input
          className="w-full rounded border px-2 py-1"
          placeholder="Tìm nhanh (Số TK / MST / Công ty / Nhân viên / Tổ đội)"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <span className="text-xs text-gray-500">
          Nhập từ khóa để tìm nhanh theo Số tờ khai, mã số thuế, tên doanh nghiệp, nhân viên hoặc tổ đội phụ trách.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1 text-sm" data-tooltip="Chọn nhanh khoảng thời gian theo preset">
          <span>Khoảng</span>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={datePreset}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "custom") {
                setDatePreset("custom");
                return;
              }
              applyDatePreset(value);
            }}
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
              value={searchRange.from}
              onChange={(event) => {
                const value = event.target.value;
                setDatePreset("custom");
                setSearchRange((prev) => ({ ...prev, from: value }));
              }}
              className="rounded border px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-1 text-sm" data-tooltip="Lọc đến ngày (theo ngày đăng ký tờ khai)">
            <span>Đến ngày</span>
            <input
              type="date"
              value={searchRange.to}
              onChange={(event) => {
                const value = event.target.value;
                setDatePreset("custom");
                setSearchRange((prev) => ({ ...prev, to: value }));
              }}
              className="rounded border px-2 py-1 text-sm"
            />
          </label>
          {(searchRange.from || searchRange.to) ? (
            <button
              type="button"
              onClick={handleClearSearchRange}
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
              onChange={(event) => setFilterNoStaff(event.target.checked)}
            />
            <span>Chưa gán Nhân viên</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={filterNoTeam}
              onChange={(event) => setFilterNoTeam(event.target.checked)}
            />
            <span>Chưa gán Tổ đội</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            <span>Lọc C/O</span>
            <select
              value={coFilterMode}
              onChange={(event) => setCoFilterMode(event.target.value)}
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
                onChange={(event) => {
                  const rawValue = Number(event.target.value);
                  if (!Number.isFinite(rawValue) || rawValue <= 0) {
                    setCoFilterMin(0);
                    return;
                  }
                  setCoFilterMin(Math.round(rawValue));
                }}
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
