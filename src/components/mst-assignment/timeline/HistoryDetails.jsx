import React from "react";

export default function HistoryDetails({
  entries = [],
  label,
  formatTimestamp,
}) {
  if (!entries.length) return null;

  const renderValue = (value) =>
    value ? (
      <span>{value}</span>
    ) : (
      <span className="italic text-gray-500">(trống)</span>
    );

  const renderTimestamp = (value) =>
    typeof formatTimestamp === "function" ? formatTimestamp(value) : value;

  return (
    <details className="mt-1 text-xs text-gray-600">
      <summary
        className="cursor-pointer text-blue-600 hover:text-blue-800"
        data-tooltip="Xem nhanh các lần chỉnh sửa trường này"
      >
        Lịch sử {label || ""}
      </summary>
      <ul className="mt-1 space-y-2 max-h-40 overflow-auto pr-1">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="border-t pt-1 first:border-t-0 first:pt-0"
          >
            <div className="font-medium text-gray-700">
              {renderTimestamp(entry.timestamp)} — {entry.actor || "Hệ thống"}
              {entry.type === "create" && (
                <span className="ml-2 text-emerald-600">(Thêm mới)</span>
              )}
              {entry.type === "update" && (
                <span className="ml-2 text-blue-600">(Chỉnh sửa)</span>
              )}
              {entry.type === "delete" && (
                <span className="ml-2 text-red-600">(Đã xoá)</span>
              )}
            </div>
            <div className="text-gray-600">
              <span className="text-gray-500">Từ:</span> {renderValue(entry.from)}
            </div>
            <div className="text-gray-600">
              <span className="text-gray-500">Đến:</span> {renderValue(entry.to)}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
