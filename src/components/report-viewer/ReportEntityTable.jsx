import React from "react";

const ALIGN_CLASSNAMES = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const CELL_BASE_CLASS = "px-3 py-1.5 text-sm text-[color:var(--ds-text-primary)]";
const HEADER_BASE_CLASS = "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]";

function getAlignClass(align = "left") {
  return ALIGN_CLASSNAMES[align] || ALIGN_CLASSNAMES.left;
}

function renderHeaderLabel(column, onSort, sortState) {
  if (!column.sortable || !onSort) {
    return <span className="inline-flex items-center gap-1">{column.label}</span>;
  }

  const sortKey = column.sortKey || column.key;
  const isActive = sortState && sortState.key === sortKey;
  const direction = isActive ? sortState.direction : undefined;
  const nextDirection = isActive ? (direction === "desc" ? "asc" : "desc") : "desc";
  const indicator = direction === "desc" ? "▼" : "▲";

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey, nextDirection)}
      className={`inline-flex items-center gap-1 font-semibold transition hover:text-[color:var(--ds-text-primary)] ${
        isActive ? "text-[color:var(--ds-text-primary)]" : "text-[color:var(--ds-text-secondary)]"
      }`}
    >
      {column.label}
      <span className="text-[10px] leading-none">
        {isActive ? indicator : ""}
      </span>
    </button>
  );
}

export default function ReportEntityTable({
  columns,
  rows,
  emptyMessage,
  pagination,
  onSort,
  sortState,
}) {
  const visibleColumns = columns.filter((column) => column?.visible !== false);

  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded border border-[color:var(--ds-border-subtle)]">
        <table className="min-w-full border-collapse bg-white">
          <thead className="bg-[color:var(--ds-surface-muted)]">
            <tr>
              {visibleColumns.map((column) => {
                const alignClass = getAlignClass(column.align);
                const sortKey = column.sortKey || column.key;
                const isActiveSort =
                  column.sortable && sortState && sortState.key === sortKey;
                const ariaSort = column.sortable
                  ? isActiveSort
                    ? sortState.direction === "desc"
                      ? "descending"
                      : "ascending"
                    : "none"
                  : undefined;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`${HEADER_BASE_CLASS} ${alignClass} ${column.headerClassName || ""}`.trim()}
                  >
                    {renderHeaderLabel(column, onSort, sortState)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr
                  key={row.key || row.id || index}
                  className={index % 2 === 0 ? "bg-white" : "bg-[color:var(--ds-surface-subtle)]"}
                >
                  {visibleColumns.map((column) => {
                    const alignClass = getAlignClass(column.align);
                    const content = column.renderCell ? column.renderCell(row) : row[column.key];
                    return (
                      <td
                        key={column.key}
                        className={`${CELL_BASE_CLASS} ${alignClass} ${column.className || ""}`.trim()}
                      >
                        {content ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumns.length} className="px-3 py-4 text-center text-sm text-[color:var(--ds-text-muted)]">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalRows ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[color:var(--ds-text-secondary)]">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={pagination.pageSizeMode === "custom" ? "custom" : String(pagination.pageSize)}
              onChange={pagination.onPageSizeChange}
              className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-2 py-1 text-xs text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"
            >
              {pagination.pageSizeOptions?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value="custom">Tùy chỉnh...</option>
            </select>
            {pagination.pageSizeMode === "custom" ? (
              <input
                type="number"
                min="1"
                value={pagination.customPageSizeValue}
                onChange={pagination.onCustomPageSizeChange}
                className="w-16 rounded border border-[color:var(--ds-border-subtle)] bg-white px-2 py-1 text-xs text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"
              />
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span>{pagination.rangeLabel}</span>
            <div className="inline-flex overflow-hidden rounded-full border border-[color:var(--ds-border-subtle)]">
              <button
                type="button"
                onClick={pagination.onPrevPage}
                disabled={pagination.isFirstPage}
                className="border-r border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={pagination.onNextPage}
                disabled={pagination.isLastPage}
                className="px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
