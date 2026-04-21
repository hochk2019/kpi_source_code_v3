import React from "react";

import { StatusBadge } from "@/components/designSystem/primitives.jsx";
import {
  PAGE_SIZE,
  computeRowState,
  formatHistoryTimestamp,
} from "@/components/hq-agency-manager/hqAgencyManagerModel.js";

const CARD_SURFACE_CLASS =
  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm";
const AGENCY_SUGGESTION_DATALIST = "hq-agency-suggestions";

export default function HQAgencyTable({
  agencyOptions,
  baselineMap,
  canEdit,
  getColumnStyle,
  historyMap,
  isReadOnly,
  onChangeField,
  onDeleteRow,
  onQuickAddAgent,
  onSaveRow,
  onToggleHistory,
  openHistory,
  pageRows,
  rows,
  safePage,
  renderResizeHandle,
}) {
  return (
    <>
      <div className="overflow-auto rounded-xl border border-slate-200/60 bg-white/40 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/40">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200/60 bg-slate-50/50 text-slate-500 dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th
                className="group relative px-4 py-3 text-left font-medium tracking-wide"
                style={getColumnStyle("index")}
              >
                STT
                {renderResizeHandle("index")}
              </th>

              <th className="group relative px-4 py-3 text-left font-medium tracking-wide" style={getColumnStyle("mst")}>
                Mã số thuế
                {renderResizeHandle("mst")}
              </th>

              <th
                className="group relative px-4 py-3 text-left font-medium tracking-wide"
                style={getColumnStyle("company")}
              >
                Công ty
                {renderResizeHandle("company")}
              </th>

              <th
                className="group relative px-4 py-3 text-left font-medium tracking-wide"
                style={getColumnStyle("agency")}
              >
                Đại lý hải quan
                <span
                  className="ml-1 text-xs text-slate-400"
                  title="Nhập nhiều đại lý và ngăn cách bằng dấu phẩy (,) hoặc xuống dòng khi cần."
                >
                  ⓘ
                </span>
                {renderResizeHandle("agency")}
              </th>

              {canEdit && (
                <th
                  className="group relative px-4 py-3 text-left font-medium tracking-wide"
                  style={getColumnStyle("actions")}
                >
                  Xóa
                  {renderResizeHandle("actions")}
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
            {pageRows.map((row, idx) => {
              const rowIndex = rows.indexOf(row);
              const globalIndex = (safePage - 1) * PAGE_SIZE + idx + 1;
              const state = computeRowState(row, baselineMap, historyMap);
              const historyKey = state.draft.mst || row._originalMst || "";
              const historyForRow = historyKey ? (historyMap.get(historyKey) ?? []) : [];
              const isHistoryOpen = historyKey ? openHistory.includes(historyKey) : false;
              const historyEntriesToShow = historyForRow.slice(0, 10);
              const historyButtonDisabled = !historyKey || historyForRow.length === 0;
              const historyButtonTitle = historyButtonDisabled
                ? "Chưa có lịch sử cho MST này"
                : "Xem lịch sử chỉnh sửa đại lý HQ cho MST này";
              const latestTimestamp = historyForRow[0]?.timestamp ?? null;
              const canCommitRow = !isReadOnly && state.draft.mst && state.hasChanges;
              const rowKey = `${historyKey || "row"}_${idx}`;
              const statusBadges = [];

              if (state.isNew && state.hasChanges) {
                statusBadges.push({ label: "Mới", tone: "info" });
              }
              if (state.hasChanges) {
                statusBadges.push({ label: "Chưa lưu", tone: "warning" });
              }
              if (!state.hasChanges && !state.hasAgents) {
                statusBadges.push({ label: "Chưa gán đại lý", tone: "neutral" });
              }
              if (!state.hasChanges && state.isRecent) {
                statusBadges.push({
                  label: "Cập nhật gần đây",
                  tone: "success",
                  title: latestTimestamp
                    ? `Cập nhật lúc ${formatHistoryTimestamp(latestTimestamp)}`
                    : undefined,
                });
              }
              if (!state.hasChanges && !state.isRecent && state.hasHistory) {
                statusBadges.push({ label: "Đã có lịch sử", tone: "info" });
              }
              if (!state.draft.mst) {
                statusBadges.push({ label: "Chưa nhập MST", tone: "danger" });
              }

              return (
                <React.Fragment key={rowKey}>
                  <tr className="hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 align-top" style={getColumnStyle("index")}>
                      <div className="min-h-[24px] text-slate-500 font-medium">{globalIndex}</div>
                    </td>

                    <td className="px-4 py-3 align-top text-slate-700 dark:text-slate-300" style={getColumnStyle("mst")}>
                      {isReadOnly ? (
                        <span className="block whitespace-nowrap font-medium">{row.mst}</span>
                      ) : (
                        <input
                          className="w-full min-w-0 rounded-xl border border-slate-200/60 bg-white/40 px-3 py-1.5 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700/60 dark:bg-slate-800/40 dark:focus:bg-slate-800 transition-all"
                          value={row.mst}
                          onChange={(event) => onChangeField(rowIndex, "mst", event.target.value)}
                        />
                      )}
                    </td>

                    <td className="px-4 py-3 align-top text-slate-700 dark:text-slate-300" style={getColumnStyle("company")}>
                      {isReadOnly ? (
                        <span
                          className={
                            row.company && row.company.length >= 25
                              ? "block whitespace-pre-wrap break-words leading-relaxed"
                              : "block whitespace-normal"
                          }
                        >
                          {row.company}
                        </span>
                      ) : (
                        <input
                          className="w-full min-w-0 rounded-xl border border-slate-200/60 bg-white/40 px-3 py-1.5 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700/60 dark:bg-slate-800/40 dark:focus:bg-slate-800 transition-all"
                          value={row.company}
                          onChange={(event) =>
                            onChangeField(rowIndex, "company", event.target.value)
                          }
                        />
                      )}
                    </td>

                    <td className="px-4 py-3 align-top" style={getColumnStyle("agency")}>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-start gap-2">
                          {isReadOnly ? (
                            <span className="block whitespace-pre-wrap break-words leading-relaxed">
                              {row.agent}
                            </span>
                          ) : (
                            <input
                              className="w-full min-w-0 rounded-xl border border-slate-200/60 bg-white/40 px-3 py-1.5 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700/60 dark:bg-slate-800/40 dark:focus:bg-slate-800 transition-all text-sm"
                              value={row.agent}
                              onChange={(event) =>
                                onChangeField(rowIndex, "agent", event.target.value)
                              }
                              placeholder="Ví dụ: Đại lý A, Đại lý B"
                              list={AGENCY_SUGGESTION_DATALIST}
                            />
                          )}

                          {canEdit && agencyOptions.length > 0 && (
                            <select
                              className="rounded-xl border border-slate-200/60 bg-slate-50/50 px-2 py-1 text-xs text-slate-600 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-400"
                              value=""
                              onChange={(event) => {
                                onQuickAddAgent(rowIndex, event.target.value);
                                event.target.value = "";
                              }}
                            >
                              <option value="">Chọn nhanh đại lý</option>
                              {agencyOptions.map((option) => (
                                <option key={`${rowKey}-opt-${option}`} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          )}

                          <span
                            className="pt-1 text-xs text-gray-400"
                            title="Nhập nhiều đại lý và ngăn cách bằng dấu phẩy (,) hoặc xuống dòng khi cần."
                          >
                            ⓘ
                          </span>

                          <button
                            type="button"
                            onClick={() => historyKey && onToggleHistory(historyKey)}
                            className="rounded-xl border border-slate-200/60 bg-white/40 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-400 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={historyButtonDisabled}
                            title={historyButtonTitle}
                          >
                            Lịch sử{historyForRow.length > 0 ? ` (${historyForRow.length})` : ""}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          {statusBadges.map((badge) => (
                            <StatusBadge
                              key={`${rowKey}-badge-${badge.label}`}
                              tone={badge.tone}
                              title={badge.title}
                            >
                              {badge.label}
                            </StatusBadge>
                          ))}

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onSaveRow(rowIndex)}
                              className="rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:from-teal-600 hover:to-teal-500 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-700"
                              disabled={!canCommitRow}
                              title={
                                !state.draft.mst
                                  ? "Nhập MST trước khi lưu"
                                  : state.hasChanges
                                    ? "Lưu các thay đổi của dòng này"
                                    : "Không có thay đổi để lưu"
                              }
                            >
                              Cập nhật
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {canEdit && (
                      <td className="px-4 py-3 align-top" style={getColumnStyle("actions")}>
                        <button
                          type="button"
                          onClick={() => onDeleteRow(rowIndex)}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-red-50/50 px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                        >
                          Xóa
                        </button>
                      </td>
                    )}
                  </tr>

                  {isHistoryOpen && historyEntriesToShow.length > 0 && (
                    <tr className="bg-slate-50">
                      <td colSpan={canEdit ? 5 : 4} className="px-4 pb-4 pt-2">
                        <div className="space-y-2 text-xs text-slate-600">
                          {historyEntriesToShow.map((entry) => {
                            const fieldLabel = entry.field === "company" ? "Công ty" : "Đại lý HQ";
                            const typeLabel =
                              entry.type === "create"
                                ? "Thêm"
                                : entry.type === "delete"
                                  ? "Xóa"
                                  : "Sửa";

                            return (
                              <div key={entry.id} className={`${CARD_SURFACE_CLASS} p-2`}>
                                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
                                  <span className="font-medium text-slate-700">{fieldLabel}</span>
                                  <span>
                                    {typeLabel} • {formatHistoryTimestamp(entry.timestamp)}
                                  </span>
                                </div>

                                <div className="mt-1 grid gap-1 text-slate-600 sm:grid-cols-2">
                                  <div>
                                    <span className="font-medium text-slate-700">Từ:</span>{" "}
                                    {entry.from || "—"}
                                  </div>
                                  <div>
                                    <span className="font-medium text-slate-700">Đến:</span>{" "}
                                    {entry.to || "—"}
                                  </div>
                                </div>

                                <div className="mt-1 text-slate-500">
                                  Bởi: {entry.actor || "system"}
                                </div>
                              </div>
                            );
                          })}

                          {historyForRow.length > historyEntriesToShow.length && (
                            <p className="text-[11px] text-slate-500">
                              Chỉ hiển thị 10 dòng gần nhất.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {pageRows.length === 0 && (
              <tr>
                <td className="px-2 py-6 text-center text-gray-500" colSpan={canEdit ? 5 : 4}>
                  Không có dữ liệu phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <datalist id={AGENCY_SUGGESTION_DATALIST}>
        {agencyOptions.map((agent) => (
          <option key={`suggest-${agent}`} value={agent} />
        ))}
      </datalist>
    </>
  );
}
