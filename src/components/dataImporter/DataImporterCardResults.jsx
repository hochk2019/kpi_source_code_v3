import React from "react";

function DefaultButtonComponent({ children, ...props }) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

function DefaultDeclarationStatusDisplayComponent({ row }) {
  return <div>{row?.status || "—"}</div>;
}

export default function DataImporterCardResults({
  pageRows = [],
  hiddenColumns = new Set(),
  cardGridStyle = undefined,
  selectionEnabled = false,
  selectedKeys = [],
  updatedKeySet = new Set(),
  coMismatchKeySet = new Set(),
  duplicate11KeeperSet = new Set(),
  duplicate11DuplicatesSet = new Set(),
  rosterTeams = [],
  agencyOptions = [],
  historyEnabled = false,
  updateEnabled = false,
  deleteEnabled = false,
  buildRowState,
  onToggleSelect,
  onSelectStaff,
  onSelectTeam,
  onSelectAgency,
  onChangeLicenseCount,
  onToggleHistory,
  onSaveRowChanges,
  onDeleteSingle,
  getCoDisplay,
  getKpiDisplay,
  formatDisplayDate,
  formatHistoryTimestamp,
  humanizeDiffKey,
  declHistoryFieldLabels = {},
  ButtonComponent = DefaultButtonComponent,
  StaffComboboxComponent = null,
  TeamComboboxComponent = null,
  AgencyComboboxComponent = null,
  DeclarationStatusDisplayComponent = DefaultDeclarationStatusDisplayComponent,
}) {
  const renderButton = (buttonProps, children) => React.createElement(ButtonComponent, buttonProps, children);
  const renderStatusDisplay = (row) =>
    React.createElement(DeclarationStatusDisplayComponent, { row, withDetail: true, size: "sm" });

  return (
    <div className="grid gap-3" style={cardGridStyle}>
      {pageRows.length > 0 ? (
        pageRows.map((row, index) => {
          const state = buildRowState(row, index);
          const {
            rowKey,
            rowReadOnly,
            rowReadOnlyReason,
            rowReviewLocked,
            rowDeleted,
            rowEditable,
            canSaveRow,
            rowSaving,
            rowError,
            historyExpanded,
            historyList,
            historyCount,
          } = state;

          const hasPendingDiff = state.hasPendingDiff;
          const readOnlyLabel = rowDeleted
            ? rowReadOnlyReason || "Đã xóa mềm"
            : rowReviewLocked
              ? "Khóa rà soát"
              : rowReadOnlyReason || "Chỉ xem";
          const readOnlyStatus = rowDeleted ? "Không thể cập nhật" : "Chỉ xem";

          return (
            <div
              key={`${rowKey}_${index}`}
              className="flex flex-col gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  {!hiddenColumns.has("date") ? (
                    <div className="text-xs text-gray-500 dark:text-gray-300">
                      {formatDisplayDate(row.date || row.raw_date || "")}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <span>{row.so_tk_full || row.so_tk || ""}</span>
                    {row.so_tk_suffix ? (
                      <span className="text-[10px] uppercase text-gray-400">{row.so_tk_suffix}</span>
                    ) : null}
                    {hasPendingDiff && !rowReadOnly ? (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        Chưa lưu
                      </span>
                    ) : null}
                    {row.reviewed ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        Đã rà soát
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                    {updatedKeySet.has(rowKey) ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">Cập nhật</span>
                    ) : null}
                    {coMismatchKeySet.has(rowKey) ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">CO lệch</span>
                    ) : null}
                    {duplicate11KeeperSet.has(rowKey) ? (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-700">Giữ mới nhất</span>
                    ) : null}
                    {duplicate11DuplicatesSet.has(rowKey) ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">Trùng 11 số</span>
                    ) : null}
                    {row.duplicate_review_pending ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700">Cần xem lại</span>
                    ) : null}
                    {rowReadOnly ? (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 font-medium text-gray-600">{readOnlyLabel}</span>
                    ) : null}
                  </div>

                  {!hiddenColumns.has("mst") ? (
                    <div className="text-sm text-gray-600 dark:text-gray-200">{row.mst || "Chưa có MST"}</div>
                  ) : null}
                </div>

                {selectionEnabled ? (
                  <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(rowKey)}
                      onChange={() => onToggleSelect?.(row)}
                      disabled={rowReadOnly}
                    />
                    <span>Chọn</span>
                  </label>
                ) : null}
              </div>

              <div className="grid gap-2 text-sm text-gray-700 dark:text-gray-200 sm:grid-cols-2">
                {!hiddenColumns.has("company") ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      Công ty
                    </div>
                    <div>{row.cong_ty || "—"}</div>
                  </div>
                ) : null}

                {!hiddenColumns.has("type") ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      Loại hình
                    </div>
                    <div>{row.loai_hinh || "—"}</div>
                  </div>
                ) : null}

                {!hiddenColumns.has("items") ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      Mục hàng
                    </div>
                    <div>{row.muc_hang ?? "—"}</div>
                  </div>
                ) : null}

                {!hiddenColumns.has("co") ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      C/O
                    </div>
                    <div className="font-medium text-emerald-600">{getCoDisplay?.(row) ?? "—"}</div>
                  </div>
                ) : null}

                {!hiddenColumns.has("staff") ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      Nhân viên
                    </div>
                    {rowReadOnly || !StaffComboboxComponent ? (
                      <div>{row.nhan_vien || "—"}</div>
                    ) : (
                      <StaffComboboxComponent
                        value={row.nhan_vien || ""}
                        teamValue={row.team || ""}
                        teams={rosterTeams}
                        onSelect={(selection) => onSelectStaff?.(rowKey, selection)}
                      />
                    )}
                  </div>
                ) : null}

                {!hiddenColumns.has("team") ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      Tổ đội
                    </div>
                    {rowReadOnly || !TeamComboboxComponent ? (
                      <div>{row.team || "—"}</div>
                    ) : (
                      <TeamComboboxComponent
                        value={row.team || ""}
                        teams={rosterTeams}
                        onSelect={({ teamName }) => onSelectTeam?.(rowKey, teamName)}
                      />
                    )}
                  </div>
                ) : null}

                {!hiddenColumns.has("agency") ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      Đại lý
                    </div>
                    {rowReadOnly || !AgencyComboboxComponent ? (
                      <div>{row.agency || row.dai_ly || "—"}</div>
                    ) : (
                      <div className="mt-1">
                        <AgencyComboboxComponent
                          value={row.agency || row.dai_ly || ""}
                          options={agencyOptions}
                          onSelect={(nextValue) => onSelectAgency?.(rowKey, nextValue)}
                          disabled={rowSaving}
                          fullWidth
                        />
                      </div>
                    )}
                  </div>
                ) : null}

                {!hiddenColumns.has("licenses") ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      Số lượng GP
                    </div>
                    {rowReadOnly ? (
                      <div>{row.licenses ?? row.so_luong_gp ?? "—"}</div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="mt-1 w-full rounded border px-2 py-1"
                        value={row.licenses ?? row.so_luong_gp ?? ""}
                        onChange={(event) => onChangeLicenseCount?.(rowKey, event.target.value)}
                      />
                    )}
                  </div>
                ) : null}

                {!hiddenColumns.has("kpi") ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      KPI
                    </div>
                    <div>{getKpiDisplay?.(row) ?? "-"}</div>
                  </div>
                ) : null}

                {!hiddenColumns.has("status") ? (
                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                      Trạng thái
                    </div>
                    {renderStatusDisplay(row)}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                {historyEnabled ? (
                  renderButton(
                    {
                      type: "button",
                      size: "sm",
                      variant: historyExpanded ? "secondary" : "outline",
                      className: "text-xs",
                      onClick: () => onToggleHistory?.(rowKey),
                    },
                    <>
                      {historyExpanded ? "Thu gọn nhật ký" : "Xem nhật ký"}
                      {historyCount > 0 ? ` (${historyCount})` : ""}
                    </>,
                  )
                ) : null}

                {updateEnabled ? (
                  rowReadOnly ? (
                    <span className="text-[11px] text-gray-400" title={readOnlyLabel || undefined}>
                      {readOnlyStatus}
                    </span>
                  ) : canSaveRow ? (
                    renderButton(
                      {
                        type: "button",
                        size: "sm",
                        className: "text-xs",
                        onClick: () => onSaveRowChanges?.(rowKey),
                        disabled: rowSaving,
                      },
                      rowSaving ? "Đang lưu…" : "Cập nhật",
                    )
                  ) : (
                    <span className="text-[11px] text-gray-400">Đã đồng bộ</span>
                  )
                ) : null}

                {deleteEnabled && rowEditable ? (
                  renderButton(
                    {
                      type: "button",
                      size: "sm",
                      variant: "destructive",
                      className: "text-xs",
                      onClick: () => onDeleteSingle?.(row),
                    },
                    "Xóa",
                  )
                ) : null}

                {hasPendingDiff && !rowReadOnly ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    Có chỉnh sửa chờ lưu
                  </span>
                ) : null}

                {rowError ? <span className="text-[11px] text-red-600">{rowError}</span> : null}
              </div>

              {historyEnabled && historyExpanded ? (
                <div className="space-y-2 rounded border border-blue-100 bg-blue-50/60 p-3 text-xs text-gray-700 dark:border-blue-500/40 dark:bg-slate-900/60 dark:text-gray-200">
                  {historyList.length > 0 ? (
                    historyList.map((entry) => {
                      const timestampLabel = formatHistoryTimestamp?.(entry.ts);
                      const actorLabel = entry.actor || "system";

                      return (
                        <div
                          key={entry.id}
                          className="rounded border border-blue-200 bg-white p-2 shadow-sm dark:border-blue-500/30 dark:bg-slate-900/80"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-300">
                            <span className="font-medium text-gray-700 dark:text-gray-200">{timestampLabel}</span>
                            <span>{`Bởi: ${actorLabel}`}</span>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {entry.changes.map((change, idx) => {
                              const label = declHistoryFieldLabels[change.field] || humanizeDiffKey?.(change.field);
                              const beforeEmpty =
                                change.before === "" || change.before === null || change.before === undefined;
                              const afterEmpty =
                                change.after === "" || change.after === null || change.after === undefined;
                              const beforeLabel = beforeEmpty ? "Trống" : change.before;
                              const afterLabel = afterEmpty ? "Trống" : change.after;
                              const beforeClass = beforeEmpty
                                ? "text-gray-400 italic"
                                : "text-red-600 line-through decoration-red-400";
                              const afterClass = afterEmpty
                                ? "text-gray-500 italic"
                                : "text-emerald-700 font-medium";

                              return (
                                <li key={`${entry.id}-${idx}`} className="flex flex-wrap items-start gap-2">
                                  <span className="min-w-[8rem] shrink-0 text-gray-500 dark:text-gray-300">
                                    {label}
                                  </span>
                                  <span className="flex flex-wrap items-center gap-1">
                                    <span className={beforeClass}>{beforeLabel}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className={afterClass}>{afterLabel}</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded border border-dashed border-gray-300 bg-white p-3 text-center text-gray-500 dark:border-slate-700 dark:bg-slate-900/80">
                      Chưa có nhật ký chỉnh sửa.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })
      ) : (
        <div className="col-span-full rounded border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300">
          Không có dữ liệu
        </div>
      )}
    </div>
  );
}
