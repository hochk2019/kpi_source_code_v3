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

export default function DataImporterDuplicateDiffDialog({
  open = false,
  onOpenChange,
  duplicateDiffGroup = null,
  duplicateDiffGroupLabel = "",
  duplicateDiffBaseLabel = "",
  duplicateDiffCompareLabel = "",
  duplicateDiffBaseItem = null,
  duplicateDiffCompareItem = null,
  duplicateDiffChangedCount = 0,
  duplicateDiffGroups = [],
  onChangeBase,
  onChangeCompare,
  onSwap,
  onClose,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>So sánh bản ghi trùng</DialogTitle>
          <DialogDescription>
            So sánh sự khác biệt giữa <strong>{duplicateDiffBaseLabel || "bản giữ"}</strong> và{" "}
            <strong>{duplicateDiffCompareLabel || "bản so sánh"}</strong>
            {duplicateDiffGroupLabel ? ` trong nhóm ${duplicateDiffGroupLabel}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {duplicateDiffGroup ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-3 text-xs md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
              <label className="flex flex-col gap-1">
                <span className="font-medium text-gray-600 dark:text-gray-300">Bản tham chiếu</span>
                <select
                  className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                  value={duplicateDiffBaseItem?.key || ""}
                  onChange={(event) => onChangeBase?.(event.target.value)}
                >
                  {duplicateDiffGroup.items.map((item) => (
                    <option key={`diff-base-${item.key}`} value={item.key}>
                      {item.label} — {item.sourceLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-medium text-gray-600 dark:text-gray-300">Bản so sánh</span>
                <select
                  className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                  value={duplicateDiffCompareItem?.key || ""}
                  onChange={(event) => onChangeCompare?.(event.target.value)}
                >
                  {duplicateDiffGroup.items
                    .filter((item) => item.key !== duplicateDiffBaseItem?.key)
                    .map((item) => (
                      <option key={`diff-compare-${item.key}`} value={item.key}>
                        {item.label} — {item.sourceLabel}
                      </option>
                    ))}
                </select>
              </label>

              <button
                type="button"
                onClick={onSwap}
                disabled={!duplicateDiffBaseItem || !duplicateDiffCompareItem}
                className="h-9 self-end rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-[color:var(--ds-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Đổi vị trí
              </button>
            </div>

            <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--ds-border-subtle)] px-3 py-2 text-xs text-[color:var(--ds-text-secondary)]">
                <span>
                  Nhóm: <strong className="text-[color:var(--ds-text-primary)]">{duplicateDiffGroupLabel}</strong> • Tổng{" "}
                  {duplicateDiffGroup?.total?.toLocaleString?.("vi-VN") || duplicateDiffGroup?.items?.length || 0} bản ghi
                </span>
                <span className="font-medium text-emerald-600 dark:text-emerald-300">
                  {duplicateDiffChangedCount.toLocaleString("vi-VN") || 0} trường khác nhau
                </span>
              </div>

              <ScrollArea className="max-h-[60vh] min-h-0 pr-2">
                <div className="space-y-4 px-3 py-3">
                  {duplicateDiffGroups.length > 0 ? (
                    duplicateDiffGroups.map((group) => (
                      <div key={`diff-group-${group.title}`} className="space-y-1">
                        <h4 className="text-xs uppercase tracking-wide text-[color:var(--ds-text-muted)]">{group.title}</h4>
                        <table className="min-w-full overflow-hidden rounded border border-[color:var(--ds-border-subtle)] text-xs">
                          <thead className="bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-secondary)]">
                            <tr>
                              <th className="px-2 py-1 text-left">Trường</th>
                              <th className="px-2 py-1 text-left">Bản giữ</th>
                              <th className="px-2 py-1 text-left">Bản so sánh</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => (
                              <tr
                                key={`diff-row-${group.title}-${row.key}`}
                                className={`border-b border-[color:var(--ds-border-subtle)] last:border-b-0 ${
                                  row.changed ? "bg-amber-50 dark:bg-amber-500/10" : "bg-[color:var(--ds-surface-card)]"
                                }`}
                              >
                                <td className="whitespace-nowrap px-2 py-1 font-medium text-[color:var(--ds-text-secondary)]">
                                  {row.label}
                                </td>
                                <td className="max-w-[240px] whitespace-pre-wrap px-2 py-1 text-[color:var(--ds-text-primary)]">
                                  {row.baseValue || <span className="text-[color:var(--ds-text-muted)]">(trống)</span>}
                                </td>
                                <td className="max-w-[240px] whitespace-pre-wrap px-2 py-1 text-[color:var(--ds-text-primary)]">
                                  {row.compareValue || <span className="text-[color:var(--ds-text-muted)]">(trống)</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  ) : (
                    <p className="py-6 text-center text-xs text-[color:var(--ds-text-muted)]">
                      Không có dữ liệu khác biệt giữa hai bản ghi.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[color:var(--ds-text-muted)]">Không tìm thấy nhóm trùng để so sánh.</p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-sm text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
          >
            Đóng
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
