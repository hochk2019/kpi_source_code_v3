import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString("vi-VN") : "0";
}

function buildUsageMap(duplicateMergeFields, merges, keeperKey) {
  const usageMap = new Map();

  for (const field of duplicateMergeFields) {
    const selected = merges[field.key] || keeperKey;
    if (!selected) {
      continue;
    }
    if (!usageMap.has(selected)) {
      usageMap.set(selected, []);
    }
    usageMap.get(selected)?.push(field.label);
  }

  return usageMap;
}

function getDiffTargets(items, keeperKey, itemKey) {
  const fallbackBaseKey = keeperKey || items[0]?.key || null;
  const baseForDiff = fallbackBaseKey || itemKey;
  let compareForDiff = itemKey;

  if (compareForDiff === baseForDiff) {
    compareForDiff = items.find((candidate) => candidate.key !== baseForDiff)?.key || null;
  }

  return {
    baseForDiff,
    compareForDiff,
    canOpenDiff: Boolean(compareForDiff),
  };
}

export default function DataImporterDuplicateReviewDialog({
  open = false,
  onOpenChange,
  duplicate11Details = [],
  duplicate11Plan = {},
  duplicate11PlanHasActions = false,
  duplicate11PlannedRemovalCount = 0,
  duplicate11PlannedDeleteGroups = 0,
  duplicate11PlannedReviewGroups = 0,
  duplicateReviewConfirmed = false,
  onConfirmedChange,
  duplicateMergeFields = [],
  onChangeKeeper,
  onOpenDuplicateDiff,
  onChangeMerge,
  onChangeResolution,
  onChangeNote,
  onClose,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Rà soát tờ khai trùng 11 số đầu</DialogTitle>
          <DialogDescription>
            Kiểm tra các nhóm trùng giữa nguồn Excel và ECUS5VNACCS. Hệ thống ưu tiên giữ bản có thời gian cập nhật mới nhất,
            sau đó mới xét điểm trọng số.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sky-800 dark:border-sky-700/60 dark:bg-sky-900/20 dark:text-sky-100">
            {duplicate11PlanHasActions ? (
              <p>
                Dự kiến xóa <strong>{formatCount(duplicate11PlannedRemovalCount)}</strong> bản ghi trong{" "}
                <strong>{formatCount(duplicate11PlannedDeleteGroups)}</strong> nhóm.
                {duplicate11PlannedReviewGroups > 0 && (
                  <>
                    {" "}
                    • <strong>{formatCount(duplicate11PlannedReviewGroups)}</strong> nhóm sẽ được đánh dấu cần rà soát thay vì xóa.
                  </>
                )}
              </p>
            ) : (
              <p>Hãy chọn bản giữ lại hoặc chuyển nhóm sang trạng thái “Cần rà soát” trước khi xác nhận.</p>
            )}
            <p className="mt-1 text-xs text-sky-700 dark:text-sky-200/80">
              Bạn có thể hợp nhất từng trường dữ liệu (nhân viên, KPI, giấy phép…) từ các bản khác nhau rồi mới xóa bản dư.
            </p>
          </div>

          {duplicate11Details.length > 0 ? (
            <ScrollArea className="max-h-[60vh] min-h-0 pr-2">
              <div className="space-y-4">
                {duplicate11Details.map((group) => {
                  const planEntry = duplicate11Plan[group.rawPrefix] || {};
                  const keeperKey = planEntry.keeperKey || group.items?.[0]?.key || "";
                  const merges = planEntry.merges || {};
                  const resolution = planEntry.resolution || "delete";
                  const note = planEntry.note || "";
                  const usageMap = buildUsageMap(duplicateMergeFields, merges, keeperKey);

                  return (
                    <div
                      key={`${group.rawPrefix || group.prefix}-${group.total}`}
                      className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-3 shadow-sm"
                    >
                      <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.prefix}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Tham chiếu:{" "}
                            <span className="font-medium text-emerald-600 dark:text-emerald-300">
                              {group.keeperLabel || "Không xác định"}
                            </span>
                            {group.referenceTimestamp ? (
                              <>
                                {" "}
                                • {group.referenceTimestampLabel}: {group.referenceTimestamp}
                              </>
                            ) : null}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatCount(group.total)} bản ghi</span>
                          {resolution === "review" && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                              Đánh dấu cần rà soát
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead className="bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-secondary)]">
                            <tr>
                              <th className="px-2 py-1 text-left">Giữ</th>
                              <th className="px-2 py-1 text-left">Số tờ khai</th>
                              <th className="px-2 py-1 text-left">Nguồn</th>
                              <th className="px-2 py-1 text-left">Thời gian</th>
                              <th className="px-2 py-1 text-left">So sánh</th>
                              <th className="px-2 py-1 text-left">Nhân viên</th>
                              <th className="px-2 py-1 text-left">Tổ đội</th>
                              <th className="px-2 py-1 text-left">Trạng thái</th>
                              <th className="px-2 py-1 text-right">KPI</th>
                              <th className="px-2 py-1 text-left">Trường sẽ lấy dữ liệu</th>
                              <th className="px-2 py-1 text-right">Điểm</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item, index) => {
                              const isKeeper = keeperKey === item.key;
                              const selectedFields = usageMap.get(item.key) || [];
                              const rowClass = isKeeper
                                ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100"
                                : index % 2 === 0
                                  ? "bg-[color:var(--ds-surface-card)]"
                                  : "bg-[color:var(--ds-surface-muted)]";
                              const { baseForDiff, compareForDiff, canOpenDiff } = getDiffTargets(group.items, keeperKey, item.key);

                              return (
                                <tr
                                  key={item.key}
                                  className={`${rowClass} border-b border-[color:var(--ds-border-subtle)] last:border-b-0`}
                                >
                                  <td className="px-2 py-1">
                                    <label className="flex items-center gap-1">
                                      <input
                                        type="radio"
                                        name={`duplicate-keeper-${group.rawPrefix}`}
                                        checked={isKeeper}
                                        onChange={() => onChangeKeeper?.(group.rawPrefix, item.key)}
                                      />
                                      <span className="font-medium">Giữ</span>
                                    </label>
                                  </td>
                                  <td className="px-2 py-1">
                                    <div className="font-medium text-[color:var(--ds-text-primary)]">{item.label}</div>
                                    <div className="text-[10px] uppercase text-[color:var(--ds-text-muted)]">{item.key}</div>
                                  </td>
                                  <td className="px-2 py-1">{item.sourceLabel}</td>
                                  <td className="px-2 py-1">
                                    <div>{item.timestampDisplay || "Không xác định"}</div>
                                    <div className="text-[10px] text-[color:var(--ds-text-muted)]">{item.timestampLabel}</div>
                                  </td>
                                  <td className="px-2 py-1">
                                    <button
                                      type="button"
                                      onClick={() => onOpenDuplicateDiff?.(group.rawPrefix, baseForDiff, compareForDiff)}
                                      disabled={!canOpenDiff}
                                      className="rounded border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-blue-100 disabled:text-blue-300 disabled:opacity-60 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-blue-500/10"
                                    >
                                      So sánh
                                    </button>
                                  </td>
                                  <td className="px-2 py-1">{item.staff || <span className="text-gray-400">(trống)</span>}</td>
                                  <td className="px-2 py-1">{item.team || <span className="text-gray-400">(trống)</span>}</td>
                                  <td className="px-2 py-1">{item.status}</td>
                                  <td className="px-2 py-1 text-right">
                                    {Number.isFinite(item.kpi) ? item.kpi.toLocaleString("vi-VN") : "-"}
                                  </td>
                                  <td className="px-2 py-1">
                                    {selectedFields.length > 0 ? (
                                      <div className="space-y-0.5">
                                        {selectedFields.map((fieldLabel) => (
                                          <span
                                            key={`${item.key}-${fieldLabel}`}
                                            className="block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                                          >
                                            {fieldLabel}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-[color:var(--ds-text-muted)]">(không)</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-right">{item.score.toLocaleString("vi-VN")}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold text-gray-600 dark:text-gray-300">Hợp nhất trường dữ liệu</p>
                          {duplicateMergeFields.map((field) => (
                            <label key={`${group.rawPrefix}-${field.key}`} className="flex flex-col gap-1">
                              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{field.label}</span>
                              <select
                                className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                                value={merges[field.key] || keeperKey}
                                onChange={(event) => onChangeMerge?.(group.rawPrefix, field.key, event.target.value)}
                                disabled={resolution === "review"}
                              >
                                {group.items.map((item) => (
                                  <option key={`${field.key}-${item.key}`} value={item.key}>
                                    {item.label} — {item.sourceLabel}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>

                        <div className="space-y-2 text-xs">
                          <label className="flex flex-col gap-1">
                            <span className="font-semibold text-gray-600 dark:text-gray-300">Hành động cho nhóm</span>
                            <select
                              className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                              value={resolution}
                              onChange={(event) => onChangeResolution?.(group.rawPrefix, event.target.value)}
                            >
                              <option value="delete">Xóa bản dư (giữ 1 bản)</option>
                              <option value="review">Đánh dấu cần rà soát</option>
                            </select>
                          </label>

                          {resolution === "review" ? (
                            <label className="flex flex-col gap-1">
                              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Ghi chú (tùy chọn)</span>
                              <textarea
                                className="min-h-[60px] rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                                value={note}
                                onChange={(event) => onChangeNote?.(group.rawPrefix, event.target.value)}
                                placeholder="Ví dụ: Cần đối chiếu KPI với phòng chứng từ"
                              />
                            </label>
                          ) : (
                            <p className="text-gray-500 dark:text-gray-400">Các bản khác sẽ bị xóa sau khi bạn xác nhận.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 text-center text-sm text-[color:var(--ds-text-muted)]">
              <p className="text-sm text-[color:var(--ds-text-muted)]">Không tìm thấy nhóm trùng để rà soát.</p>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              className="mt-1"
              checked={duplicateReviewConfirmed}
              onChange={(event) => onConfirmedChange?.(event.target.checked)}
            />
            <span>Tôi đã rà soát chi tiết từng nhóm và xác nhận thao tác xử lý (xóa hoặc đánh dấu cần rà soát).</span>
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-sm text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!duplicateReviewConfirmed || !duplicate11PlanHasActions}
            className={`rounded px-3 py-1 text-sm font-semibold text-white ${
              duplicateReviewConfirmed && duplicate11PlanHasActions ? "bg-red-600 hover:bg-red-700" : "bg-red-400 opacity-50"
            }`}
          >
            Thực hiện xử lý
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
