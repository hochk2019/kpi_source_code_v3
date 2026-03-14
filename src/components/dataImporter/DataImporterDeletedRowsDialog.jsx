import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";
import { ScrollArea } from "@/components/ui/scroll-area.jsx";
import { StatusBadge } from "@/components/designSystem/primitives.jsx";

export default function DataImporterDeletedRowsDialog({
  open = false,
  onOpenChange,
  rangeLabel = "",
  totalCount = 0,
  softDeletedCount = 0,
  hardDeletedCount = 0,
  hardDeletedLoading = false,
  hardDeletedError = "",
  onRetry,
  entries = [],
  tableClassName = "",
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:w-[min(96vw,1200px)] max-w-none sm:max-w-[min(96vw,1200px)] max-h-[85vh] overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <div className="px-6 pt-6">
            <DialogHeader>
              <DialogTitle>Danh sách tờ khai đã xóa</DialogTitle>
              <DialogDescription>
                Danh sách hiển thị các tờ khai đã bị xóa tạm thời và xóa vĩnh viễn dựa trên bộ lọc hiện tại.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 text-sm text-gray-600">
              Khoảng thời gian: {rangeLabel}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">
                Tổng số: {totalCount.toLocaleString("vi-VN")}
              </span>
              <StatusBadge tone="warning">
                Xóa tạm thời: {softDeletedCount.toLocaleString("vi-VN")}
              </StatusBadge>
              <StatusBadge tone="danger">
                Xóa vĩnh viễn: {hardDeletedCount.toLocaleString("vi-VN")}
              </StatusBadge>
              {hardDeletedLoading ? (
                <span className="text-xs text-gray-500">Đang tải danh sách xóa vĩnh viễn...</span>
              ) : null}
            </div>

            {hardDeletedError ? (
              <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p>{hardDeletedError}</p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center rounded border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  onClick={onRetry}
                  disabled={hardDeletedLoading}
                >
                  Thử tải lại
                </button>
              </div>
            ) : null}
          </div>

          {entries.length > 0 ? (
            <ScrollArea
              className="flex-1 min-h-0 px-6 pb-6"
              data-testid="deleted-list-table"
              type="always"
            >
              <div className="mt-4 rounded border">
                <table className={`min-w-full text-sm ${tableClassName}`.trim()}>
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Số tờ khai</th>
                      <th className="px-3 py-2">Nhánh</th>
                      <th className="px-3 py-2">MST</th>
                      <th className="px-3 py-2">Công ty</th>
                      <th className="px-3 py-2">Loại xóa</th>
                      <th className="px-3 py-2">Ngày tờ khai</th>
                      <th className="px-3 py-2">Thời điểm xóa</th>
                      <th className="px-3 py-2">Người xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.key} className="border-b border-gray-100 last:border-b-0">
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                          {entry.soTk || "Không rõ"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">{entry.branch || "-"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">{entry.mst || "-"}</td>
                        <td className="px-3 py-2 text-gray-700">{entry.company || "-"}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <StatusBadge tone={entry.tone}>{entry.typeLabel}</StatusBadge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">{entry.dateLabel || "-"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">{entry.deletedAtLabel || "-"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">{entry.deletedByLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          ) : (
            <p className="mt-4 px-6 pb-6 text-sm text-gray-500">
              {hardDeletedLoading
                ? "Đang tải dữ liệu tờ khai đã xóa..."
                : "Không có tờ khai nào phù hợp với điều kiện lọc hiện tại."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
