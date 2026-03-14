import React from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const DATA_COLUMNS = [
  { key: "date", frozen: true, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  {
    key: "declaration",
    frozen: true,
    className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap",
  },
  {
    key: "mst",
    frozen: true,
    className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap",
  },
  { key: "company", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  { key: "type", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  { key: "co", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  { key: "items", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  { key: "staff", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  { key: "team", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  { key: "agency", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  { key: "status", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  { key: "licenses", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
  { key: "kpi", frozen: false, className: "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300" },
];

export default function DataImporterTableHeader({
  hiddenColumns,
  selectionEnabled,
  historyEnabled,
  updateEnabled,
  deleteEnabled,
  frozenOffsets,
  frozenHeaderClass,
  renderResizeHandle,
  registerHeaderRef,
  getFrozenStyle,
  getColumnStyle,
  columnLabels,
}) {
  const getHeaderStyle = (column) =>
    column.frozen ? getFrozenStyle(column.key) || getColumnStyle(column.key) : getColumnStyle(column.key);

  return (
    <thead className="bg-gray-50 text-left dark:bg-slate-900">
      <tr>
        {selectionEnabled ? (
          <th
            className={cx(
              "relative px-2 py-1 font-semibold text-gray-600 dark:text-gray-300",
              frozenOffsets.selection ? frozenHeaderClass : "",
            )}
            style={getFrozenStyle("selection") || getColumnStyle("selection")}
          >
            <div className="flex items-center justify-between gap-2 pr-2">Chọn</div>
          </th>
        ) : null}

        {DATA_COLUMNS.filter((column) => !hiddenColumns.has(column.key)).map((column) => (
          <th
            key={column.key}
            ref={(node) => registerHeaderRef(column.key, node)}
            className={cx(column.className, column.frozen && frozenOffsets[column.key] ? frozenHeaderClass : "")}
            style={getHeaderStyle(column)}
          >
            <div className="flex items-center justify-between gap-2 pr-3">
              <span>{columnLabels[column.key]}</span>
            </div>
            {renderResizeHandle(column.key)}
          </th>
        ))}

        {historyEnabled ? (
          <th
            ref={(node) => registerHeaderRef("history", node)}
            className="relative px-2 py-1 text-left font-semibold text-gray-600 dark:text-gray-300"
            style={getColumnStyle("history")}
          >
            <div className="flex items-center justify-between gap-2 pr-3">
              <span>Nhật ký</span>
            </div>
            {renderResizeHandle("history")}
          </th>
        ) : null}

        {updateEnabled ? (
          <th
            ref={(node) => registerHeaderRef("update", node)}
            className="relative px-2 py-1 text-left font-semibold text-gray-600 dark:text-gray-300"
            style={getColumnStyle("update")}
          >
            <div className="flex items-center justify-between gap-2 pr-3">
              <span>Cập nhật</span>
            </div>
            {renderResizeHandle("update")}
          </th>
        ) : null}

        {deleteEnabled ? (
          <th className="px-2 py-1 text-left font-semibold text-gray-600 dark:text-gray-300">Xóa / Khôi phục</th>
        ) : null}
      </tr>
    </thead>
  );
}
