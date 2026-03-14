import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";

export default function DataImporterColumnConfigDialog({
  open = false,
  onOpenChange,
  columnOptions = [],
  hiddenColumnIds = new Set(),
  visibleCount = 0,
  totalCount = 0,
  isAdminRole = false,
  sensitiveColumnIds = new Set(),
  errorMessage = "",
  onToggleColumn,
  onReset,
  onApply,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cấu hình cột Import Data</DialogTitle>
          <DialogDescription>
            Chọn các cột dữ liệu cần hiển thị. Thiết lập áp dụng cho toàn bộ hệ thống.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            Đang giữ {visibleCount}/{totalCount} mục hiển thị (bao gồm cột dữ liệu và thao tác).
          </p>

          <div className="grid gap-2">
            {columnOptions.map((column) => {
              const checked = !hiddenColumnIds.has(column.id);
              const isSensitive = sensitiveColumnIds.has(column.id);
              const disabled = isSensitive && !isAdminRole;

              return (
                <label
                  key={column.id}
                  className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
                    disabled ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <span className="flex flex-col">
                    <span>{column.label}</span>
                    {isSensitive ? (
                      <span className="text-[11px] text-gray-500">Chỉ admin có thể bật/tắt.</span>
                    ) : null}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleColumn?.(column.id)}
                    disabled={disabled}
                  />
                </label>
              );
            })}
          </div>

          {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onReset}
            className="mr-auto rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            Đặt lại mặc định
          </button>
          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
          >
            Lưu cấu hình
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
