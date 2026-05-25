import React from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isEmptyValue(value) {
  return value === "" || value === null || value === undefined;
}

export default function DataImporterTableBody({
  pageRows,
  totalColumns,
  hiddenColumns,
  selectionEnabled,
  selectedKeys,
  updatedKeySet,
  coMismatchKeySet,
  duplicate11KeeperSet,
  duplicate11DuplicatesSet,
  rosterTeams,
  agencyOptions,
  historyEnabled,
  updateEnabled,
  deleteEnabled,
  frozenOffsets,
  frozenCellClass,
  historyIndent,
  buildRowState,
  onToggleSelect,
  onSelectStaff,
  onSelectTeam,
  onSelectAgency,
  onChangeLicenseCount,
  onToggleHistory,
  onSaveRowChanges,
  onRestoreSingle,
  onHardDeleteSingle,
  onDeleteSingle,
  getCoDisplay,
  getKpiDisplay,
  getFrozenStyle,
  getColumnStyle,
  formatDisplayDate,
  formatHistoryTimestamp,
  humanizeDiffKey,
  declHistoryFieldLabels,
  StaffComboboxComponent,
  TeamComboboxComponent,
  AgencyComboboxComponent,
  DeclarationStatusDisplayComponent,
}) {
  const getCellStyle = (columnKey) => getFrozenStyle(columnKey) || getColumnStyle(columnKey);

  return (
    <tbody>
      {pageRows.map((row, index) => {
        const state = buildRowState(row, index);
        const {
          rowKey,
          rowReadOnly,
          rowReadOnlyReason,
          rowReviewLocked,
          rowDeleted,
          rowDeletedAt,
          rowDeletedBy,
          rowEditable,
          canSaveRow,
          rowSaving,
          rowError,
          historyExpanded,
          historyList,
          historyCount,
          hasPendingDiff,
        } = state;
        const readOnlyLabel = rowDeleted
          ? rowReadOnlyReason || "Đã xóa mềm"
          : rowReviewLocked
            ? "Khóa rà soát"
            : rowReadOnlyReason || "Chỉ xem";
        const readOnlyStatus = rowDeleted ? "Không thể cập nhật" : "Chỉ xem";
        const deletedTimestampLabel = rowDeletedAt ? formatHistoryTimestamp(rowDeletedAt) : "";

        return (
          <React.Fragment key={`${rowKey}_${index}`}>
            <tr
              className={cx(
                "relative odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]",
                rowDeleted ? "opacity-70" : "",
              )}
            >
              {selectionEnabled ? (
                <td
                  className={cx("px-2 py-1 align-top", frozenOffsets.selection ? frozenCellClass : "")}
                  style={getCellStyle("selection")}
                >
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(rowKey)}
                    onChange={() => onToggleSelect(row)}
                    disabled={rowReadOnly}
                  />
                </td>
              ) : null}

              {!hiddenColumns.has("date") ? (
                <td
                  className={cx(
                    "px-2 py-1 align-top whitespace-nowrap text-sm text-gray-700 dark:text-gray-200",
                    frozenOffsets.date ? frozenCellClass : "",
                  )}
                  style={getCellStyle("date")}
                >
                  <span title={row.raw_date || ""}>{formatDisplayDate(row.date || row.raw_date || "")}</span>
                </td>
              ) : null}

              {!hiddenColumns.has("declaration") ? (
                <td
                  className={cx("px-2 py-1 align-top", frozenOffsets.declaration ? frozenCellClass : "")}
                  style={getCellStyle("declaration")}
                >
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="whitespace-nowrap font-medium text-gray-800 dark:text-gray-100">
                      {row.so_tk_full || row.so_tk || ""}
                    </span>
                    {row.so_tk_suffix ? <span className="text-[10px] uppercase text-gray-400">{row.so_tk_suffix}</span> : null}
                    {updatedKeySet.has(rowKey) ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        Cập nhật
                      </span>
                    ) : null}
                    {coMismatchKeySet.has(rowKey) ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        CO lệch
                      </span>
                    ) : null}
                    {duplicate11KeeperSet.has(rowKey) ? (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        Giữ mới nhất
                      </span>
                    ) : null}
                    {duplicate11DuplicatesSet.has(rowKey) ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        Trùng 11 số
                      </span>
                    ) : null}
                    {row.duplicate_review_pending ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                        Cần xem lại
                      </span>
                    ) : null}
                    {rowDeleted ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                        Đã xóa mềm
                      </span>
                    ) : null}
                    {rowReadOnly ? (
                      <span className="basis-full text-xs leading-snug text-gray-500">
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          {readOnlyLabel}
                        </span>
                      </span>
                    ) : null}
                    {hasPendingDiff && !rowReadOnly ? (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        Chưa lưu
                      </span>
                    ) : null}
                  </div>
                </td>
              ) : null}

              {!hiddenColumns.has("mst") ? (
                <td
                  className={cx(
                    "px-2 py-1 align-top whitespace-nowrap text-gray-700 dark:text-gray-200",
                    frozenOffsets.mst ? frozenCellClass : "",
                  )}
                  style={getCellStyle("mst")}
                >
                  <span>{row.mst || ""}</span>
                </td>
              ) : null}

              {!hiddenColumns.has("company") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("company")}>
                  <span>{row.cong_ty || ""}</span>
                </td>
              ) : null}

              {!hiddenColumns.has("type") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("type")}>
                  <span>{row.loai_hinh || ""}</span>
                </td>
              ) : null}

              {!hiddenColumns.has("co") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("co")}>
                  <span className={getCoDisplay(row) ? "font-medium text-emerald-600" : "text-gray-400"}>
                    {getCoDisplay(row) || ""}
                  </span>
                </td>
              ) : null}

              {!hiddenColumns.has("items") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("items")}>
                  <span>{row.muc_hang ?? ""}</span>
                </td>
              ) : null}

              {!hiddenColumns.has("staff") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("staff")}>
                  {rowReadOnly ? (
                    <span>{row.nhan_vien || ""}</span>
                  ) : (
                    React.createElement(StaffComboboxComponent, {
                      value: row.nhan_vien || "",
                      teamValue: row.team || "",
                      teams: rosterTeams,
                      onSelect: (selection) => onSelectStaff(rowKey, selection),
                    })
                  )}
                </td>
              ) : null}

              {!hiddenColumns.has("team") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("team")}>
                  {rowReadOnly ? (
                    <span>{row.team || ""}</span>
                  ) : (
                    React.createElement(TeamComboboxComponent, {
                      value: row.team || "",
                      teams: rosterTeams,
                      onSelect: ({ teamName }) => onSelectTeam(rowKey, teamName),
                    })
                  )}
                </td>
              ) : null}

              {!hiddenColumns.has("agency") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("agency")}>
                  {rowReadOnly ? (
                    <span>{row.agency || row.dai_ly || ""}</span>
                  ) : (
                    React.createElement(AgencyComboboxComponent, {
                      value: row.agency || row.dai_ly || "",
                      options: agencyOptions,
                      onSelect: (nextValue) => onSelectAgency(rowKey, nextValue),
                      disabled: rowSaving,
                    })
                  )}
                </td>
              ) : null}

              {!hiddenColumns.has("status") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("status")}>
                  {React.createElement(DeclarationStatusDisplayComponent, {
                    row,
                    withDetail: true,
                    size: "sm",
                  })}
                </td>
              ) : null}

              {!hiddenColumns.has("licenses") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("licenses")}>
                  {rowReadOnly ? (
                    <span>{row.licenses ?? row.so_luong_gp ?? ""}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-24 rounded border px-1 py-0.5"
                      value={row.licenses ?? row.so_luong_gp ?? ""}
                      onChange={(event) => onChangeLicenseCount(rowKey, event.target.value)}
                    />
                  )}
                </td>
              ) : null}

              {!hiddenColumns.has("kpi") ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("kpi")}>
                  {getKpiDisplay(row)}
                </td>
              ) : null}

              {historyEnabled ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("history")}>
                  <button
                    type="button"
                    onClick={() => onToggleHistory(rowKey)}
                    className={cx(
                      "rounded px-2 py-0.5 text-xs",
                      historyExpanded
                        ? "border border-blue-500 bg-blue-50 text-blue-700"
                        : "border border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-700",
                    )}
                  >
                    {historyExpanded ? "Thu gọn" : "Nhật ký"}
                    {historyCount > 0 ? ` (${historyCount})` : ""}
                  </button>
                </td>
              ) : null}

              {updateEnabled ? (
                <td className="px-2 py-1 align-top" style={getColumnStyle("update")}>
                  {rowReadOnly ? (
                    <span className="text-[11px] text-gray-400" title={readOnlyLabel || undefined}>
                      {readOnlyStatus}
                    </span>
                  ) : canSaveRow ? (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => onSaveRowChanges(rowKey)}
                        disabled={rowSaving}
                        className={cx(
                          "rounded px-2 py-0.5 text-xs font-medium text-white transition",
                          rowSaving ? "cursor-not-allowed bg-blue-300" : "bg-blue-600 hover:bg-blue-700",
                        )}
                      >
                        {rowSaving ? "Đang lưu…" : "Cập nhật"}
                      </button>
                      {rowError ? <span className="text-[11px] text-red-600">{rowError}</span> : null}
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-400">Đã đồng bộ</span>
                  )}
                </td>
              ) : null}

              {deleteEnabled && (rowEditable || rowDeleted) ? (
                <td className="px-2 py-1 align-top">
                  {rowDeleted ? (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => onRestoreSingle(row)}
                        className="rounded bg-emerald-500 px-2 py-0.5 text-xs text-white hover:bg-emerald-600"
                      >
                        Khôi phục
                      </button>
                      <button
                        type="button"
                        onClick={() => onHardDeleteSingle(row)}
                        className="rounded bg-red-500 px-2 py-0.5 text-xs text-white hover:bg-red-600"
                      >
                        Xóa vĩnh viễn
                      </button>
                      <span className="text-[11px] text-gray-500">
                        {`Đã xóa${rowDeletedBy ? ` bởi ${rowDeletedBy}` : ""}${deletedTimestampLabel ? ` lúc ${deletedTimestampLabel}` : ""}`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => onDeleteSingle(row)}
                        className="rounded bg-red-500 px-2 py-0.5 text-xs text-white hover:bg-red-600"
                      >
                        Đánh dấu xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => onHardDeleteSingle(row)}
                        className="rounded bg-red-700 px-2 py-0.5 text-xs text-white hover:bg-red-800"
                      >
                        Xóa vĩnh viễn
                      </button>
                    </div>
                  )}
                </td>
              ) : null}
            </tr>

            {historyEnabled && historyExpanded ? (
              <tr className="bg-blue-50/40">
                {selectionEnabled ? (
                  <td
                    className={cx("px-2 py-1", frozenOffsets.selection ? frozenCellClass : "")}
                    style={getCellStyle("selection")}
                  />
                ) : null}
                <td
                  className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200"
                  colSpan={totalColumns - (selectionEnabled ? 1 : 0)}
                  style={historyIndent ? { paddingLeft: `${historyIndent}px` } : undefined}
                >
                  <div className="flex flex-col gap-3">
                    {historyList.length > 0 ? (
                      historyList.map((entry) => {
                        const timestampLabel = formatHistoryTimestamp(entry.ts);
                        const actorLabel = entry.actor || "system";
                        return (
                          <div key={entry.id} className="rounded border border-blue-100 bg-white p-2 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                              <span className="font-medium text-gray-700">{timestampLabel}</span>
                              <span className="text-gray-500">{`Bởi: ${actorLabel}`}</span>
                            </div>
                            <ul className="mt-2 space-y-1">
                              {entry.changes.map((change, changeIndex) => {
                                const label =
                                  declHistoryFieldLabels?.[change.field] || humanizeDiffKey(change.field);
                                const beforeLabel = isEmptyValue(change.before) ? "Trống" : change.before;
                                const afterLabel = isEmptyValue(change.after) ? "Trống" : change.after;
                                const beforeClass = isEmptyValue(change.before)
                                  ? "italic text-gray-400"
                                  : "text-red-600 line-through decoration-red-400";
                                const afterClass = isEmptyValue(change.after)
                                  ? "italic text-gray-500"
                                  : "font-medium text-emerald-700";
                                return (
                                  <li key={`${entry.id}-${changeIndex}`} className="flex flex-wrap items-start gap-2">
                                    <span className="min-w-[8rem] shrink-0 text-gray-500">{label}</span>
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
                      <div className="rounded border border-dashed border-gray-200 bg-white p-4 text-center text-gray-500">
                        Chưa có nhật ký chỉnh sửa cho tờ khai này.
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : null}
          </React.Fragment>
        );
      })}

      {pageRows.length === 0 ? (
        <tr>
          <td className="px-2 py-4 text-center text-gray-500" colSpan={totalColumns}>
            Không có dữ liệu
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}
