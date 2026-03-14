import React, { useMemo } from "react";

const METRIC_SORT_KEYS = ["kpi", "decls", "licenses"];

function getCompanyRowLabel(row = {}) {
  if (row.staff && row.team) {
    return `${row.staff} — ${row.team}`;
  }
  if (row.staff) {
    return row.staff;
  }
  if (row.team) {
    return row.team;
  }
  if (row.cong_ty) {
    return row.cong_ty;
  }
  if (row.mst) {
    return row.mst;
  }
  return "";
}

function sortCompanyRows(rows = [], sortKey = "kpi") {
  const key = METRIC_SORT_KEYS.includes(sortKey) ? sortKey : "kpi";
  const fallbackKeys = METRIC_SORT_KEYS.filter((item) => item !== key);
  return [...rows].sort((a = {}, b = {}) => {
    const primaryDiff = Number(b[key] || 0) - Number(a[key] || 0);
    if (primaryDiff !== 0) return primaryDiff;

    for (const fallback of fallbackKeys) {
      const diff = Number(b[fallback] || 0) - Number(a[fallback] || 0);
      if (diff !== 0) return diff;
    }

    const labelA = getCompanyRowLabel(a) || "";
    const labelB = getCompanyRowLabel(b) || "";
    return labelA.localeCompare(labelB, "vi", { sensitivity: "base" });
  });
}

export function CompanySummaryTable({
  rows,
  includeStaff = false,
  includeTeam = false,
  visibleColumns = {},
  sortKey = "kpi",
  formatInt,
  formatDecimal,
}) {
  const columns = [
    { key: "idx", label: "STT", align: "center" },
    { key: "cong_ty", label: "Công ty", align: "left" },
    { key: "mst", label: "MST", align: "left" },
  ];

  if (includeTeam) {
    columns.push({ key: "team", label: "Tổ đội", align: "left" });
  }
  if (includeStaff) {
    columns.push({ key: "staff", label: "Nhân viên", align: "left" });
  }

  columns.push(
    { key: "loai_hinh", label: "Loại hình", align: "left" },
    { key: "modes", label: "Nhập/Xuất", align: "left" },
    { key: "decls", label: "Tờ khai", align: "right", format: formatInt },
    { key: "kpi", label: "Điểm KPI", align: "right", format: formatDecimal },
    { key: "items", label: "Mục hàng", align: "right", format: formatInt, visibleKey: "items" },
    { key: "licenses", label: "Số GP", align: "right", format: formatInt, visibleKey: "licenses" },
    { key: "co", label: "Tờ khai C/O", align: "right", format: formatInt, visibleKey: "co" },
    { key: "coLines", label: "Dòng C/O", align: "right", format: formatInt, visibleKey: "coLines" },
    {
      key: "licenseSummary",
      label: "Mã giấy phép",
      align: "left",
      visibleKey: "licenseCodes",
      isLicense: true,
    }
  );

  const activeColumns = columns.filter((column) => (column.visibleKey ? visibleColumns[column.visibleKey] !== false : true));
  const sortedRows = useMemo(() => sortCompanyRows(rows, sortKey), [rows, sortKey]);

  return (
    <div className="overflow-auto rounded border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            {activeColumns.map((column) => {
              const alignClass =
                column.align === "right"
                  ? "text-right"
                  : column.align === "center"
                    ? "text-center"
                    : "text-left";
              return (
                <th key={column.key} className={`px-3 py-2 ${alignClass}`}>
                  {column.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length ? (
            sortedRows.map((row, index) => (
              <tr key={`${row.mst}-${row.cong_ty}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {activeColumns.map((column) => {
                  const alignClass =
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left";
                  const value = column.key === "idx" ? index + 1 : row[column.key] ?? "";
                  const display = column.format ? column.format(value) : value;
                  const tooltip = column.isLicense ? row.licenseTooltip : undefined;
                  return (
                    <td key={column.key} className={`px-3 py-1.5 ${alignClass}`} title={tooltip}>
                      {display || (column.align === "right" ? 0 : "—")}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-6 text-center text-gray-500" colSpan={activeColumns.length}>
                Không có dữ liệu trong giai đoạn đã chọn.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
