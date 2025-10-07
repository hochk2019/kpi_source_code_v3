import React, { useEffect, useMemo, useState } from "react";
import {
  getDeclRows,
  getTeamRoster,
  sortDeclRows,
  getMSTMap,
  normalizeName,
  normalizeStr,
  mapMemberNamesToTeams,
} from "@/lib/store.js";
import { loadRules } from "@/lib/rules.js";
import { formatDisplayDate } from "@/shared/format.js";
import {
  QUICK_RANGE_OPTIONS,
  computeQuickRange,
  buildReportData,
  aggregateByCompany,
} from "@/lib/reports.js";
import { seedSampleDeclarations } from "@/shared/sampleDeclarations.js";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

let reportExporterPromise;
function loadReportExporterModule() {
  if (!reportExporterPromise) {
    reportExporterPromise = import("@/lib/reportExport.js");
  }
  return reportExporterPromise;
}

function formatInt(value) {
  const num = Number(value || 0);
  return num.toLocaleString("vi-VN");
}

function formatDecimal(value) {
  const num = Number(value || 0);
  return num.toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const chartColors = ["#2563eb", "#22c55e", "#f97316", "#a855f7", "#14b8a6"];

const COLUMN_VISIBILITY_OPTIONS = [
  { key: "items", label: "Mục hàng" },
  { key: "licenses", label: "Số giấy phép" },
  { key: "co", label: "Tờ khai C/O" },
  { key: "coLines", label: "Dòng C/O" },
  { key: "licenseCodes", label: "Mã giấy phép" },
];

function CompanySummaryTable({ rows, includeStaff = false, includeTeam = false, visibleColumns = {} }) {
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
    },
  );

  const activeColumns = columns.filter((col) => (col.visibleKey ? visibleColumns[col.visibleKey] !== false : true));

  return (
    <div className="overflow-auto rounded border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            {activeColumns.map((col) => {
              const alignClass =
                col.align === "right"
                  ? "text-right"
                  : col.align === "center"
                  ? "text-center"
                  : "text-left";
              return (
                <th key={col.key} className={`px-3 py-2 ${alignClass}`}>
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, idx) => (
              <tr key={`${row.mst}-${row.cong_ty}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {activeColumns.map((col) => {
                  const alignClass =
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left";
                  const value = col.key === "idx" ? idx + 1 : row[col.key] ?? "";
                  const display = col.format ? col.format(value) : value;
                  const tooltip = col.isLicense ? row.licenseTooltip : undefined;
                  return (
                    <td key={col.key} className={`px-3 py-1.5 ${alignClass}`} title={tooltip}>
                      {display || (col.align === "right" ? 0 : "—")}
                    </td>
                  );
                })
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

function TopStaffWidget({ data }) {
  if (!data.length) {
    return (
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">Top 5 nhân viên theo điểm KPI</h3>
        <p className="mt-3 text-sm text-gray-500">Chưa có dữ liệu hợp lệ trong giai đoạn này.</p>
      </section>
    );
  }

  const maxKPI = Math.max(...data.map((item) => item.stats.kpi || 0), 1);

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">Top 5 nhân viên theo điểm KPI</h3>
      <div className="mt-4 space-y-4">
        {data.map((item, idx) => {
          const ratio = Math.max(0, Math.min(100, (item.stats.kpi / maxKPI) * 100));
          const color = chartColors[idx % chartColors.length];
          return (
            <div key={item.key || idx}>
              <div className="flex items-baseline justify-between text-sm">
                <div className="font-medium text-gray-900">
                  {idx + 1}. {item.name}
                </div>
                <div className="text-gray-600">{formatDecimal(item.stats.kpi)}</div>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${ratio}%`, backgroundColor: color }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {`Tờ khai: ${formatInt(item.stats.decls)} • Mục hàng: ${formatInt(item.stats.items)} • GP: ${formatInt(
                  item.stats.licenses
                )} • C/O: ${formatInt(item.stats.co ?? 0)} • Dòng C/O: ${formatInt(item.stats.coLines ?? 0)}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamPieWidget({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const segments = [];
  let cursor = 0;

  data.forEach((item, idx) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    const start = cursor;
    const end = cursor + percent;
    const color = chartColors[idx % chartColors.length];
    segments.push(`${color} ${start}% ${end}%`);
    cursor = end;
  });

  const gradient = segments.length ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#e5e7eb 0 100%)";

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">Phân bổ KPI theo tổ đội</h3>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div
          className="h-40 w-40 rounded-full border"
          style={{ backgroundImage: gradient }}
        >
          {total === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
              Không có dữ liệu
            </div>
          ) : null}
        </div>
        <ul className="space-y-2 text-sm">
          {data.length ? (
            data.map((item, idx) => {
              const color = chartColors[idx % chartColors.length];
              const percent = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0;
              return (
                <li key={item.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-medium text-gray-900">{item.name}</span>
                  <span className="text-gray-500">{formatDecimal(item.value)}</span>
                  <span className="text-gray-500">({percent}% KPI)</span>
                </li>
              );
            })
          ) : (
            <li className="text-gray-500">Chưa có dữ liệu KPI cho các tổ đội.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

function TrendLineChart({ data, comparison }) {
  if (!data || data.length === 0) {
    return (
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">Xu hướng KPI 6 kỳ gần nhất</h3>
        <p className="mt-3 text-sm text-gray-500">Chưa có dữ liệu để hiển thị biểu đồ xu hướng.</p>
      </section>
    );
  }

  const deltaKPI = comparison?.delta?.kpi ?? 0;
  const deltaDecls = comparison?.delta?.decls ?? 0;
  const deltaPercent = comparison?.delta?.kpiPercent ?? null;
  const deltaClass = deltaKPI > 0 ? "text-emerald-600" : deltaKPI < 0 ? "text-red-600" : "text-gray-600";

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">Xu hướng KPI 6 kỳ gần nhất</h3>
        {comparison && (
          <div className="text-xs text-gray-500">
            So với kỳ liền trước:
            <span className={`ml-1 font-medium ${deltaClass}`}>
              {deltaKPI > 0 ? "+" : ""}{deltaKPI.toFixed(1)} điểm KPI
            </span>
            {deltaPercent !== null && (
              <span className={`ml-1 ${deltaClass}`}>
                ({deltaPercent > 0 ? "+" : ""}{deltaPercent.toFixed(1)}%)
              </span>
            )}
            <span className="ml-2 text-gray-400">• {deltaDecls > 0 ? "+" : ""}{deltaDecls} tờ khai</span>
          </div>
        )}
      </div>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis yAxisId="left" stroke="#2563eb" />
            <YAxis yAxisId="right" orientation="right" stroke="#22c55e" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="kpi" name="Điểm KPI" stroke="#2563eb" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="decls" name="Tờ khai" stroke="#22c55e" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function TeamTrendChart({ data, teams }) {
  const baseTeams = Array.isArray(teams) ? teams.filter(Boolean) : [];
  const plottedTeams = baseTeams.includes("Tổng") ? baseTeams : [...baseTeams, "Tổng"];

  if (!data || data.length === 0) {
    return (
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">So sánh KPI theo tổ đội</h3>
        <p className="mt-3 text-sm text-gray-500">Chưa có dữ liệu để hiển thị biểu đồ tổ đội.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">So sánh KPI theo tổ đội (6 kỳ gần nhất)</h3>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            {plottedTeams.map((team, idx) => (
              <Bar
                key={team}
                dataKey={team}
                name={team}
                fill={chartColors[idx % chartColors.length]}
                stackId={team === "Tổng" ? "total" : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-gray-500">{subtitle}</div> : null}
    </div>
  );
}

function StaffDetailCard({ staff, canExport, onExport, onPrint, exporting, visibleColumns = {} }) {
  const { stats, rows } = staff;
  const [mode, setMode] = useState("detail");
  const aggregated = useMemo(
    () => aggregateByCompany(rows, { includeStaff: false, includeTeam: false }),
    [rows]
  );
  const showItems = visibleColumns.items !== false;
  const showLicenses = visibleColumns.licenses !== false;
  const showCo = visibleColumns.co !== false;
  const showCoLines = visibleColumns.coLines !== false;
  const showLicenseCodes = visibleColumns.licenseCodes !== false;
  const licenseSummary = (stats.licenseCodes || []).join(", ");
  const infoLineParts = [
    `${formatInt(stats.decls)} tờ khai`,
    `Nhập: ${formatInt(stats.import)} • Xuất: ${formatInt(stats.export)}`,
  ];
  if (showCo) {
    infoLineParts.push(`Có C/O: ${formatInt(stats.co ?? 0)}`);
  }
  if (showCoLines) {
    infoLineParts.push(`Dòng C/O: ${formatInt(stats.coLines ?? 0)}`);
  }
  const infoLine = infoLineParts.join(" — ");
  const detailColumnCount =
    7 +
    (showItems ? 1 : 0) +
    (showLicenses ? 1 : 0) +
    (showCo ? 1 : 0) +
    (showCoLines ? 1 : 0) +
    (showLicenseCodes ? 1 : 0);

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm print:avoid-break">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Nhân viên: {staff.name}</h3>
          <p className="text-sm text-gray-600">Tổ đội: {staff.teamLabel}</p>
          <p className="text-xs text-gray-500">{infoLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">Điểm KPI: {formatDecimal(stats.kpi)}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("summary")}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                mode === "summary"
                  ? "bg-black text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Báo cáo tổng hợp
            </button>
            <button
              type="button"
              onClick={() => setMode("detail")}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                mode === "detail"
                  ? "bg-black text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Báo cáo chi tiết
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={!canExport || exporting}
              className={`rounded px-3 py-1.5 text-xs font-semibold shadow-sm ${
                canExport && !exporting
                  ? "bg-black text-white hover:bg-gray-900"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {exporting ? "Đang xuất..." : "Xuất Excel"}
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="rounded border px-3 py-1.5 text-xs shadow-sm hover:bg-gray-50"
            >
              In / Xuất PDF
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-2 text-sm sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Mục hàng</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.items)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Số giấy phép</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.licenses)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Tờ khai nhập</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.import)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Tờ khai xuất</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.export)}</div>
        </div>
        {showCo ? (
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Tờ khai có C/O</div>
            <div className="text-base font-semibold text-gray-900">{formatInt(stats.co ?? 0)}</div>
          </div>
        ) : null}
        {showCoLines ? (
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Dòng C/O</div>
            <div className="text-base font-semibold text-gray-900">{formatInt(stats.coLines ?? 0)}</div>
          </div>
        ) : null}
        {showLicenseCodes ? (
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Mã giấy phép</div>
            <div className="text-base font-semibold text-gray-900">{formatInt(stats.licenseCount ?? 0)}</div>
            <div className="mt-1 text-[11px] text-gray-500" title={licenseSummary || "—"}>
              {licenseSummary || "—"}
            </div>
          </div>
        ) : null}
      </div>

      {mode === "summary" ? (
        <CompanySummaryTable rows={aggregated} visibleColumns={visibleColumns} />
      ) : (
        <div className="overflow-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Ngày</th>
                <th className="px-3 py-2 text-left">Số tờ khai</th>
                <th className="px-3 py-2 text-left">Loại hình</th>
                <th className="px-3 py-2 text-left">Nhập/Xuất</th>
                {showItems ? <th className="px-3 py-2 text-right">Mục hàng</th> : null}
                {showLicenses ? <th className="px-3 py-2 text-right">Số GP</th> : null}
                {showCo ? <th className="px-3 py-2 text-center">C/O</th> : null}
                {showCoLines ? <th className="px-3 py-2 text-right">Dòng C/O</th> : null}
                {showLicenseCodes ? <th className="px-3 py-2 text-left">Mã giấy phép</th> : null}
                <th className="px-3 py-2 text-right">Điểm KPI</th>
                <th className="px-3 py-2 text-left">MST</th>
                <th className="px-3 py-2 text-left">Công ty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const licenseCodes = Array.isArray(row.licenseCodes) ? row.licenseCodes : [];
                const excludedCodes = Array.isArray(row.licenseExcludedCodes)
                  ? row.licenseExcludedCodes
                  : [];
                const licenseLabel = licenseCodes.join(", ") || "—";
                const licenseTooltipParts = [];
                if (licenseLabel && licenseLabel !== "—") {
                  licenseTooltipParts.push(`Áp dụng: ${licenseLabel}`);
                }
                if (excludedCodes.length) {
                  licenseTooltipParts.push(`Loại trừ: ${excludedCodes.join(", ")}`);
                }
                const licenseTooltip = licenseTooltipParts.join("\n") || "—";
                return (
                  <tr key={`${row.so_tk}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-1.5">{row.displayDate || formatDisplayDate(row.date)}</td>
                    <td className="px-3 py-1.5">{row.so_tk}</td>
                    <td className="px-3 py-1.5">{row.loai_hinh || ""}</td>
                    <td className="px-3 py-1.5">{row.isExport ? "Xuất" : "Nhập"}</td>
                    {showItems ? (
                      <td className="px-3 py-1.5 text-right">{formatInt(row.num_items)}</td>
                    ) : null}
                    {showLicenses ? (
                      <td className="px-3 py-1.5 text-right">{formatInt(row.licenses)}</td>
                    ) : null}
                    {showCo ? (
                      <td className="px-3 py-1.5 text-center">{row.coLabel || "Không"}</td>
                    ) : null}
                    {showCoLines ? (
                      <td className="px-3 py-1.5 text-right">{formatInt(row.coLineCount || 0)}</td>
                    ) : null}
                    {showLicenseCodes ? (
                      <td className="px-3 py-1.5" title={licenseTooltip}>
                        {licenseLabel}
                      </td>
                    ) : null}
                    <td className="px-3 py-1.5 text-right">{formatDecimal(row.kpi)}</td>
                    <td className="px-3 py-1.5">{row.mst || ""}</td>
                    <td className="px-3 py-1.5">{row.cong_ty || ""}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={detailColumnCount}>
                    Chưa có tờ khai nào trong giai đoạn được chọn.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TeamDetailCard({ team, canExport, onExport, onPrint, exporting, visibleColumns = {} }) {
  const { stats, members, rows } = team;
  const [mode, setMode] = useState("detail");
  const aggregated = useMemo(
    () => aggregateByCompany(rows, { includeStaff: true, includeTeam: false }),
    [rows]
  );
  const showItems = visibleColumns.items !== false;
  const showLicenses = visibleColumns.licenses !== false;
  const showCo = visibleColumns.co !== false;
  const showCoLines = visibleColumns.coLines !== false;
  const showLicenseCodes = visibleColumns.licenseCodes !== false;
  const licenseSummary = (stats.licenseCodes || []).join(", ");
  const infoLineParts = [
    `${formatInt(stats.decls)} tờ khai`,
    `Nhập: ${formatInt(stats.import)} • Xuất: ${formatInt(stats.export)}`,
  ];
  if (showCo) {
    infoLineParts.push(`Có C/O: ${formatInt(stats.co ?? 0)}`);
  }
  if (showCoLines) {
    infoLineParts.push(`Dòng C/O: ${formatInt(stats.coLines ?? 0)}`);
  }
  const infoLine = infoLineParts.join(" — ");
  const memberColumnCount =
    5 +
    (showItems ? 1 : 0) +
    (showLicenses ? 1 : 0) +
    (showCo ? 1 : 0) +
    (showCoLines ? 1 : 0) +
    (showLicenseCodes ? 1 : 0);
  const detailColumnCount =
    8 +
    (showItems ? 1 : 0) +
    (showLicenses ? 1 : 0) +
    (showCo ? 1 : 0) +
    (showCoLines ? 1 : 0) +
    (showLicenseCodes ? 1 : 0);
  const memberNames = members.map((m) => m.name).filter(Boolean);

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm print:avoid-break">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tổ đội: {team.name}</h3>
          <p className="text-sm text-gray-600">
            Thành viên: {memberNames.length ? memberNames.join(", ") : "Chưa có thành viên trong roster"}
          </p>
          <p className="text-xs text-gray-500">{infoLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">Điểm KPI: {formatDecimal(stats.kpi)}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("summary")}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                mode === "summary"
                  ? "bg-black text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Báo cáo tổng hợp
            </button>
            <button
              type="button"
              onClick={() => setMode("detail")}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                mode === "detail"
                  ? "bg-black text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Báo cáo chi tiết
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={!canExport || exporting}
              className={`rounded px-3 py-1.5 text-xs font-semibold shadow-sm ${
                canExport && !exporting
                  ? "bg-black text-white hover:bg-gray-900"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {exporting ? "Đang xuất..." : "Xuất Excel"}
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="rounded border px-3 py-1.5 text-xs shadow-sm hover:bg-gray-50"
            >
              In / Xuất PDF
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-2 text-sm sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Mục hàng</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.items)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Số giấy phép</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.licenses)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Tờ khai nhập</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.import)}</div>
        </div>
        <div className="rounded border bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase text-gray-500">Tờ khai xuất</div>
          <div className="text-base font-semibold text-gray-900">{formatInt(stats.export)}</div>
        </div>
        {showCo ? (
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Tờ khai có C/O</div>
            <div className="text-base font-semibold text-gray-900">{formatInt(stats.co ?? 0)}</div>
          </div>
        ) : null}
        {showCoLines ? (
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Dòng C/O</div>
            <div className="text-base font-semibold text-gray-900">{formatInt(stats.coLines ?? 0)}</div>
          </div>
        ) : null}
        {showLicenseCodes ? (
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Mã giấy phép</div>
            <div className="text-base font-semibold text-gray-900">{formatInt(stats.licenseCount ?? 0)}</div>
            <div className="mt-1 text-[11px] text-gray-500" title={licenseSummary || "—"}>
              {licenseSummary || "—"}
            </div>
          </div>
        ) : null}
      </div>

      {mode === "summary" ? (
        <CompanySummaryTable rows={aggregated} includeStaff visibleColumns={visibleColumns} />
      ) : (
        <>
          <div className="overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Nhân viên</th>
                  <th className="px-3 py-2 text-right">Tờ khai</th>
                  <th className="px-3 py-2 text-right">Điểm KPI</th>
                  <th className="px-3 py-2 text-right">Nhập</th>
                  <th className="px-3 py-2 text-right">Xuất</th>
                  {showItems ? <th className="px-3 py-2 text-right">Mục hàng</th> : null}
                  {showLicenses ? <th className="px-3 py-2 text-right">Số GP</th> : null}
                  {showCo ? <th className="px-3 py-2 text-right">Tờ khai C/O</th> : null}
                  {showCoLines ? <th className="px-3 py-2 text-right">Dòng C/O</th> : null}
                  {showLicenseCodes ? <th className="px-3 py-2 text-left">Mã giấy phép</th> : null}
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => (
                  <tr key={member.key || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-1.5">{member.name}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(member.stats.decls)}</td>
                    <td className="px-3 py-1.5 text-right">{formatDecimal(member.stats.kpi)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(member.stats.import)}</td>
                    <td className="px-3 py-1.5 text-right">{formatInt(member.stats.export)}</td>
                    {showItems ? (
                      <td className="px-3 py-1.5 text-right">{formatInt(member.stats.items)}</td>
                    ) : null}
                    {showLicenses ? (
                      <td className="px-3 py-1.5 text-right">{formatInt(member.stats.licenses)}</td>
                    ) : null}
                    {showCo ? (
                      <td className="px-3 py-1.5 text-right">{formatInt(member.stats.co ?? 0)}</td>
                    ) : null}
                    {showCoLines ? (
                      <td className="px-3 py-1.5 text-right">{formatInt(member.stats.coLines ?? 0)}</td>
                    ) : null}
                    {showLicenseCodes ? (
                      <td
                        className="px-3 py-1.5"
                        title={(member.stats.licenseCodes || []).join(", ") || "—"}
                      >
                        {(member.stats.licenseCodes || []).join(", ") || "—"}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {members.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={memberColumnCount}>
                      Chưa có thành viên nào trong tổ đội này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Ngày</th>
                  <th className="px-3 py-2 text-left">Số tờ khai</th>
                  <th className="px-3 py-2 text-left">Nhân viên</th>
                  <th className="px-3 py-2 text-left">Loại hình</th>
                  <th className="px-3 py-2 text-left">Nhập/Xuất</th>
                  {showItems ? <th className="px-3 py-2 text-right">Mục hàng</th> : null}
                  {showLicenses ? <th className="px-3 py-2 text-right">Số GP</th> : null}
                  {showCo ? <th className="px-3 py-2 text-center">C/O</th> : null}
                  {showCoLines ? <th className="px-3 py-2 text-right">Dòng C/O</th> : null}
                  {showLicenseCodes ? <th className="px-3 py-2 text-left">Mã giấy phép</th> : null}
                  <th className="px-3 py-2 text-right">Điểm KPI</th>
                  <th className="px-3 py-2 text-left">MST</th>
                  <th className="px-3 py-2 text-left">Công ty</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const licenseCodes = Array.isArray(row.licenseCodes) ? row.licenseCodes : [];
                  const excludedCodes = Array.isArray(row.licenseExcludedCodes)
                    ? row.licenseExcludedCodes
                    : [];
                  const licenseLabel = licenseCodes.join(", ") || "—";
                  const licenseTooltipParts = [];
                  if (licenseLabel && licenseLabel !== "—") {
                    licenseTooltipParts.push(`Áp dụng: ${licenseLabel}`);
                  }
                  if (excludedCodes.length) {
                    licenseTooltipParts.push(`Loại trừ: ${excludedCodes.join(", ")}`);
                  }
                  const licenseTooltip = licenseTooltipParts.join("\n") || "—";
                  return (
                    <tr key={`${row.so_tk}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-1.5">{row.displayDate || formatDisplayDate(row.date)}</td>
                      <td className="px-3 py-1.5">{row.so_tk}</td>
                      <td className="px-3 py-1.5">{row.nhan_vien || ""}</td>
                      <td className="px-3 py-1.5">{row.loai_hinh || ""}</td>
                      <td className="px-3 py-1.5">{row.isExport ? "Xuất" : "Nhập"}</td>
                      {showItems ? (
                        <td className="px-3 py-1.5 text-right">{formatInt(row.num_items)}</td>
                      ) : null}
                      {showLicenses ? (
                        <td className="px-3 py-1.5 text-right">{formatInt(row.licenses)}</td>
                      ) : null}
                      {showCo ? (
                        <td className="px-3 py-1.5 text-center">{row.coLabel || "Không"}</td>
                      ) : null}
                      {showCoLines ? (
                        <td className="px-3 py-1.5 text-right">{formatInt(row.coLineCount || 0)}</td>
                      ) : null}
                      {showLicenseCodes ? (
                        <td className="px-3 py-1.5" title={licenseTooltip}>
                          {licenseLabel}
                        </td>
                      ) : null}
                      <td className="px-3 py-1.5 text-right">{formatDecimal(row.kpi)}</td>
                      <td className="px-3 py-1.5">{row.mst || ""}</td>
                      <td className="px-3 py-1.5">{row.cong_ty || ""}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={detailColumnCount}>
                      Chưa có tờ khai nào trong giai đoạn được chọn.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default function ReportViewer({ canExport = true }) {
  const initialRange = useMemo(() => computeQuickRange("this_month"), []);
  const [quickRange, setQuickRange] = useState("this_month");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [scope, setScope] = useState("staff"); // staff | team
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [staffViewMode, setStaffViewMode] = useState("detail");
  const [teamViewMode, setTeamViewMode] = useState("detail");
  const [version, setVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState(() => ({
    items: true,
    licenses: true,
    co: true,
    coLines: true,
    licenseCodes: true,
  }));

  const handleToggleColumnVisibility = (key) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [key]: prev[key] === false,
    }));
  };

  const handleSeedSamples = () => {
    const confirmed = window.confirm(
      "Tạo dữ liệu mẫu sẽ ghi đè các tờ khai hiện có bằng 100 dòng thử nghiệm tháng 8-9. Bạn có chắc chắn muốn tiếp tục?"
    );
    if (!confirmed) return;
    const generated = seedSampleDeclarations({ actor: "ui-sample", count: 100 });
    setVersion((value) => value + 1);
    alert(`Đã sinh ${generated.length} tờ khai mẫu.`);
  };

  const [rules, setRulesState] = useState(() => loadRules());
  const [roster, setRoster] = useState(() => getTeamRoster());
  const [mstRows, setMstRows] = useState(() => getMSTMap());
  const [declarations, setDeclarations] = useState(() => sortDeclRows(getDeclRows()));

  useEffect(() => {
    setRulesState(loadRules());
    setRoster(getTeamRoster());
    setMstRows(getMSTMap());
    setDeclarations(sortDeclRows(getDeclRows()));
  }, [version]);

  const report = useMemo(
    () => buildReportData(declarations, { roster, rules, from, to }),
    [declarations, roster, rules, from, to]
  );

  const managedCompanyCount = useMemo(() => {
    const teams = Array.isArray(roster?.teams) ? roster.teams : [];
    if (!teams.length || !Array.isArray(mstRows) || !mstRows.length) {
      return 0;
    }

    const teamKeys = new Set();
    for (const team of teams) {
      const teamName = normalizeStr(team?.name);
      const key = normalizeName(teamName);
      if (key) {
        teamKeys.add(key);
      }
    }

    if (!teamKeys.size) {
      return 0;
    }

    const memberMap = mapMemberNamesToTeams(roster);
    const seen = new Set();

    for (const row of mstRows) {
      if (!row) continue;

      let teamKey = normalizeName(normalizeStr(row.team));
      if (!teamKey) {
        const importKey = normalizeName(row.person_import);
        if (memberMap.has(importKey)) {
          teamKey = normalizeName(memberMap.get(importKey)?.team ?? "");
        }
      }
      if (!teamKey) {
        const exportKey = normalizeName(row.person_export);
        if (memberMap.has(exportKey)) {
          teamKey = normalizeName(memberMap.get(exportKey)?.team ?? "");
        }
      }

      if (!teamKey || !teamKeys.has(teamKey)) {
        continue;
      }

      const mst = normalizeStr(row.mst);
      if (mst) {
        seen.add(mst);
        continue;
      }

      const company = normalizeStr(row.company);
      if (company) {
        seen.add(`${teamKey}|${company}`);
      }
    }

    return seen.size;
  }, [mstRows, roster]);

  useEffect(() => {
    if (scope === "staff" && selectedStaff !== "all") {
      const exists = report.staff.list.some((item) => item.key === selectedStaff);
      if (!exists) {
        setSelectedStaff("all");
      }
    }
  }, [scope, selectedStaff, report.staff.list]);

  useEffect(() => {
    if (scope === "team" && selectedTeam !== "all") {
      const exists = report.teams.list.some((item) => item.key === selectedTeam);
      if (!exists) {
        setSelectedTeam("all");
      }
    }
  }, [scope, selectedTeam, report.teams.list]);

  useEffect(() => {
    setStaffViewMode("detail");
  }, [selectedStaff, scope]);

  useEffect(() => {
    setTeamViewMode("detail");
  }, [selectedTeam, scope]);

  const summary = report.summary;
  const summaryCompanyCardValue = managedCompanyCount || summary.companyCount;
  const teamCountForSubtitle = Array.isArray(roster?.teams)
    ? roster.teams.length
    : 0;
  const companyCardSubtitle = teamCountForSubtitle
    ? `Doanh nghiệp do ${teamCountForSubtitle} tổ đội quản lý`
    : "Doanh nghiệp duy nhất trong giai đoạn";
  const ruleTitle = report.rules?.name || "Chưa đặt tên";
  const ruleApply = report.rules?.applyFrom
    ? `Áp dụng từ ${report.rules.applyFrom}`
    : "Áp dụng ngay";

  const topStaffData = useMemo(() => {
    return [...report.staff.list]
      .sort((a, b) => {
        if (b.stats.kpi !== a.stats.kpi) return b.stats.kpi - a.stats.kpi;
        if (b.stats.decls !== a.stats.decls) return b.stats.decls - a.stats.decls;
        return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
      })
      .slice(0, 5);
  }, [report.staff.list]);

  const teamPieData = useMemo(() => {
    return report.teams.list.map((item) => ({
      name: item.name,
      value: Math.round((item.stats.kpi || 0) * 10) / 10,
    }));
  }, [report.teams.list]);

  const trend = report.trend || {};
  const trendSeries = trend.series || [];
  const teamTrendSeries = trend.teamSeries || [];
  const trendComparison = trend.comparison || null;
  const trendTeams = trend.topTeams || [];

  const companySummaryAllStaff = useMemo(
    () => aggregateByCompany(report.rows, { includeStaff: true, includeTeam: false }),
    [report.rows]
  );
  const companySummaryAllTeams = useMemo(
    () => aggregateByCompany(report.rows, { includeStaff: true, includeTeam: true }),
    [report.rows]
  );

  const staffOptions = useMemo(() => {
    const base = [
      { value: "all", label: `Tất cả nhân viên (${report.staff.list.length})` },
    ];
    return base.concat(
      report.staff.list.map((item) => ({
        value: item.key,
        label: item.teamLabel && item.teamLabel !== "Chưa gán tổ đội"
          ? `${item.name} — ${item.teamLabel}`
          : item.name,
      }))
    );
  }, [report.staff.list]);

  const teamOptions = useMemo(() => {
    const base = [
      { value: "all", label: `Tất cả tổ đội (${report.teams.list.length})` },
    ];
    return base.concat(
      report.teams.list.map((item) => ({ value: item.key, label: item.name }))
    );
  }, [report.teams.list]);

  const activeStaff = selectedStaff !== "all"
    ? report.staff.byKey.get(selectedStaff)
    : null;
  const activeTeam = selectedTeam !== "all"
    ? report.teams.byKey.get(selectedTeam)
    : null;

  const handleQuickRangeChange = (value) => {
    setQuickRange(value);
    if (value === "custom") return;
    const range = computeQuickRange(value);
    setFrom(range.from);
    setTo(range.to);
  };

  const ensureExportPermission = () => {
    if (!canExport) {
      alert("Tài khoản hiện tại không được phép xuất báo cáo.");
      return false;
    }
    if (!summary.decls) {
      alert("Không có dữ liệu để xuất");
      return false;
    }
    return true;
  };

  const withExporter = async (runner) => {
    setExporting(true);
    try {
      const exporter = await loadReportExporterModule();
      await runner(exporter);
    } catch (err) {
      console.error("Không thể xuất báo cáo", err);
      alert(`Không thể xuất báo cáo: ${err?.message || "Lỗi không xác định"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportStaffAll = async () => {
    if (!ensureExportPermission()) return;
    await withExporter((module) =>
      module.exportAllStaffReport({
        staffList: report.staff.list,
        summary,
        range: report.range,
        rules: report.rules,
      })
    );
  };

  const handleExportStaffDetail = async (staffEntry) => {
    if (!ensureExportPermission()) return;
    await withExporter((module) =>
      module.exportStaffReport({
        staff: staffEntry,
        range: report.range,
        rules: report.rules,
      })
    );
  };

  const handleExportTeamAll = async () => {
    if (!ensureExportPermission()) return;
    await withExporter((module) =>
      module.exportAllTeamReport({
        teamList: report.teams.list,
        summary,
        range: report.range,
        rules: report.rules,
      })
    );
  };

  const handleExportTeamDetail = async (teamEntry) => {
    if (!ensureExportPermission()) return;
    await withExporter((module) =>
      module.exportTeamReport({
        team: teamEntry,
        range: report.range,
        rules: report.rules,
      })
    );
  };

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  const renderStaffSection = () => {
    if (!summary.decls) {
      return (
        <div className="rounded border bg-white p-6 text-center text-sm text-gray-500">
          Chưa có dữ liệu tờ khai trong khoảng thời gian đã chọn. Vui lòng import dữ liệu hoặc thay đổi bộ lọc.
        </div>
      );
    }

    if (selectedStaff === "all") {
      return (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStaffViewMode("summary")}
                className={`rounded px-3 py-1.5 text-xs font-semibold ${
                  staffViewMode === "summary"
                    ? "bg-black text-white"
                    : "border bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Báo cáo tổng hợp
              </button>
              <button
                type="button"
                onClick={() => setStaffViewMode("detail")}
                className={`rounded px-3 py-1.5 text-xs font-semibold ${
                  staffViewMode === "detail"
                    ? "bg-black text-white"
                    : "border bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Báo cáo chi tiết
              </button>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={handleExportStaffAll}
                disabled={!canExport || exporting}
                className={`rounded px-3 py-1.5 text-xs font-semibold shadow-sm ${
                  canExport && !exporting
                    ? "bg-black text-white hover:bg-gray-900"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="rounded border px-3 py-1.5 text-xs shadow-sm hover:bg-gray-50"
              >
                In / Xuất PDF
              </button>
            </div>
          </div>

          {staffViewMode === "summary" ? (
            <CompanySummaryTable
              rows={companySummaryAllStaff}
              includeStaff
              visibleColumns={columnVisibility}
            />
          ) : (
            <>
              <div className="overflow-auto rounded border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Nhân viên</th>
                      <th className="px-3 py-2 text-left">Tổ đội</th>
                      <th className="px-3 py-2 text-right">Tờ khai</th>
                      <th className="px-3 py-2 text-right">Điểm KPI</th>
                      <th className="px-3 py-2 text-right">Nhập</th>
                      <th className="px-3 py-2 text-right">Xuất</th>
                      {columnVisibility.items !== false && (
                        <th className="px-3 py-2 text-right">Mục hàng</th>
                      )}
                      {columnVisibility.licenses !== false && (
                        <th className="px-3 py-2 text-right">Số GP</th>
                      )}
                      {columnVisibility.co !== false && (
                        <th className="px-3 py-2 text-right">Tờ khai C/O</th>
                      )}
                      {columnVisibility.coLines !== false && (
                        <th className="px-3 py-2 text-right">Dòng C/O</th>
                      )}
                      {columnVisibility.licenseCodes !== false && (
                        <th className="px-3 py-2 text-left">Mã giấy phép</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {report.staff.list.map((item, idx) => (
                      <tr key={item.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-1.5">{item.name}</td>
                        <td className="px-3 py-1.5">{item.teamLabel}</td>
                        <td className="px-3 py-1.5 text-right">{formatInt(item.stats.decls)}</td>
                        <td className="px-3 py-1.5 text-right">{formatDecimal(item.stats.kpi)}</td>
                        <td className="px-3 py-1.5 text-right">{formatInt(item.stats.import)}</td>
                        <td className="px-3 py-1.5 text-right">{formatInt(item.stats.export)}</td>
                        {columnVisibility.items !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.items)}</td>
                        )}
                        {columnVisibility.licenses !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.licenses)}</td>
                        )}
                        {columnVisibility.co !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.co)}</td>
                        )}
                        {columnVisibility.coLines !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.coLines)}</td>
                        )}
                        {columnVisibility.licenseCodes !== false && (
                          <td
                            className="px-3 py-1.5"
                            title={(item.stats.licenseCodes || []).join(", ") || "—"}
                          >
                            {(item.stats.licenseCodes || []).join(", ") || "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-6">
                {report.staff.list.map((item) => (
                  <StaffDetailCard
                    key={item.key}
                    staff={item}
                    canExport={canExport}
                    onExport={() => handleExportStaffDetail(item)}
                    onPrint={handlePrint}
                    exporting={exporting}
                    visibleColumns={columnVisibility}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    if (!activeStaff) {
      return null;
    }

    return (
      <StaffDetailCard
        staff={activeStaff}
        canExport={canExport}
        onExport={() => handleExportStaffDetail(activeStaff)}
        onPrint={handlePrint}
        exporting={exporting}
        visibleColumns={columnVisibility}
      />
    );
  };

  const renderTeamSection = () => {
    if (!summary.decls) {
      return (
        <div className="rounded border bg-white p-6 text-center text-sm text-gray-500">
          Chưa có dữ liệu tờ khai trong khoảng thời gian đã chọn. Vui lòng import dữ liệu hoặc thay đổi bộ lọc.
        </div>
      );
    }

    if (selectedTeam === "all") {
      return (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTeamViewMode("summary")}
                className={`rounded px-3 py-1.5 text-xs font-semibold ${
                  teamViewMode === "summary"
                    ? "bg-black text-white"
                    : "border bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Báo cáo tổng hợp
              </button>
              <button
                type="button"
                onClick={() => setTeamViewMode("detail")}
                className={`rounded px-3 py-1.5 text-xs font-semibold ${
                  teamViewMode === "detail"
                    ? "bg-black text-white"
                    : "border bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Báo cáo chi tiết
              </button>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={handleExportTeamAll}
                disabled={!canExport || exporting}
                className={`rounded px-3 py-1.5 text-xs font-semibold shadow-sm ${
                  canExport && !exporting
                    ? "bg-black text-white hover:bg-gray-900"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="rounded border px-3 py-1.5 text-xs shadow-sm hover:bg-gray-50"
              >
                In / Xuất PDF
              </button>
            </div>
          </div>

          {teamViewMode === "summary" ? (
            <CompanySummaryTable
              rows={companySummaryAllTeams}
              includeStaff
              includeTeam
              visibleColumns={columnVisibility}
            />
          ) : (
            <>
              <div className="overflow-auto rounded border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Tổ đội</th>
                      <th className="px-3 py-2 text-right">Tờ khai</th>
                      <th className="px-3 py-2 text-right">Điểm KPI</th>
                      <th className="px-3 py-2 text-right">Nhập</th>
                      <th className="px-3 py-2 text-right">Xuất</th>
                      {columnVisibility.items !== false && (
                        <th className="px-3 py-2 text-right">Mục hàng</th>
                      )}
                      {columnVisibility.licenses !== false && (
                        <th className="px-3 py-2 text-right">Số GP</th>
                      )}
                      {columnVisibility.co !== false && (
                        <th className="px-3 py-2 text-right">Tờ khai C/O</th>
                      )}
                      {columnVisibility.coLines !== false && (
                        <th className="px-3 py-2 text-right">Dòng C/O</th>
                      )}
                      {columnVisibility.licenseCodes !== false && (
                        <th className="px-3 py-2 text-left">Mã giấy phép</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {report.teams.list.map((item, idx) => (
                      <tr key={item.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-1.5">{item.name}</td>
                        <td className="px-3 py-1.5 text-right">{formatInt(item.stats.decls)}</td>
                        <td className="px-3 py-1.5 text-right">{formatDecimal(item.stats.kpi)}</td>
                        <td className="px-3 py-1.5 text-right">{formatInt(item.stats.import)}</td>
                        <td className="px-3 py-1.5 text-right">{formatInt(item.stats.export)}</td>
                        {columnVisibility.items !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.items)}</td>
                        )}
                        {columnVisibility.licenses !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.licenses)}</td>
                        )}
                        {columnVisibility.co !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.co)}</td>
                        )}
                        {columnVisibility.coLines !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.coLines)}</td>
                        )}
                        {columnVisibility.licenseCodes !== false && (
                          <td
                            className="px-3 py-1.5"
                            title={(item.stats.licenseCodes || []).join(", ") || "—"}
                          >
                            {(item.stats.licenseCodes || []).join(", ") || "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-6">
                {report.teams.list.map((item) => (
                  <TeamDetailCard
                    key={item.key}
                    team={item}
                    canExport={canExport}
                    onExport={() => handleExportTeamDetail(item)}
                    onPrint={handlePrint}
                    exporting={exporting}
                    visibleColumns={columnVisibility}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    if (!activeTeam) {
      return null;
    }

    return (
      <TeamDetailCard
        team={activeTeam}
        canExport={canExport}
        onExport={() => handleExportTeamDetail(activeTeam)}
        onPrint={handlePrint}
        exporting={exporting}
        visibleColumns={columnVisibility}
      />
    );
  };

  const excludeCodes = Array.isArray(report.rules?.license?.exclude?.codes)
    ? report.rules.license.exclude.codes.join(", ") || "Không có"
    : "Không có";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700">Khoảng thời gian</label>
            <select
              className="mt-1 rounded border px-3 py-2 text-sm"
              value={quickRange}
              onChange={(e) => handleQuickRangeChange(e.target.value)}
            >
              {QUICK_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700">Từ ngày</label>
            <input
              type="date"
              className="mt-1 rounded border px-3 py-2 text-sm"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setQuickRange("custom");
              }}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700">Đến ngày</label>
            <input
              type="date"
              className="mt-1 rounded border px-3 py-2 text-sm"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setQuickRange("custom");
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setVersion((v) => v + 1)}
            className="ml-auto rounded border bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
          >
            Tải lại dữ liệu
          </button>
          <button
            type="button"
            onClick={handleSeedSamples}
            className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 shadow-sm hover:bg-blue-100"
          >
            Sinh dữ liệu mẫu (100 dòng)
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border bg-gray-50 px-3 py-3 text-sm text-gray-600">
          <div>
            <div className="text-xs uppercase text-gray-500">Quy tắc KPI</div>
            <div className="text-base font-semibold text-gray-900">{ruleTitle}</div>
            <div className="text-xs text-gray-500">{ruleApply}</div>
          </div>
          <div className="text-right">
            {report.range.from || report.range.to ? (
              <div>
                Khoảng: {report.range.from || "…"} → {report.range.to || "…"}
              </div>
            ) : (
              <div>Khoảng: Tất cả dữ liệu</div>
            )}
            <div>{summary.decls} tờ khai hợp lệ</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Tổng tờ khai"
          value={formatInt(summary.decls)}
          subtitle={`Nhập: ${formatInt(summary.import)} • Xuất: ${formatInt(summary.export)}`}
        />
        <SummaryCard
          title="Tổng điểm KPI"
          value={formatDecimal(summary.kpi)}
          subtitle="Bao gồm điểm loại hình và giấy phép"
        />
        <SummaryCard
          title="Tổng số công ty"
          value={formatInt(summaryCompanyCardValue)}
          subtitle={companyCardSubtitle}
        />
        <SummaryCard
          title="Số giấy phép hợp lệ"
          value={formatInt(summary.licenses)}
          subtitle={`Đã loại trừ • ${formatInt(summary.licenseCount ?? 0)} mã khác nhau`}
        />
        <SummaryCard
          title="Tờ khai có C/O"
          value={formatInt(summary.co ?? 0)}
          subtitle={`Tổng dòng áp C/O: ${formatInt(summary.coLines ?? 0)}`}
        />
        <SummaryCard
          title="Danh sách mã giấy phép"
          value={formatInt(summary.licenseCount ?? 0)}
          subtitle={summary.licenseSummary || "—"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendLineChart data={trendSeries} comparison={trendComparison} />
        <TeamTrendChart data={teamTrendSeries} teams={trendTeams} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopStaffWidget data={topStaffData} />
        <TeamPieWidget data={teamPieData} />
      </div>

      <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <div className="font-semibold text-gray-900">Chế độ xem</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScope("staff")}
              className={`rounded px-3 py-1.5 ${
                scope === "staff"
                  ? "bg-black text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Nhân viên
            </button>
            <button
              type="button"
              onClick={() => setScope("team")}
              className={`rounded px-3 py-1.5 ${
                scope === "team"
                  ? "bg-black text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Tổ đội
            </button>
          </div>

          {scope === "staff" ? (
            <select
              className="ml-auto rounded border px-3 py-2 text-sm"
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
            >
              {staffOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="ml-auto rounded border px-3 py-2 text-sm"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
            >
              {teamOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="font-semibold text-gray-900">Cột báo cáo</span>
          {COLUMN_VISIBILITY_OPTIONS.map((option) => {
            const checked = columnVisibility[option.key] !== false;
            return (
              <label
                key={option.key}
                className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 ${
                  checked ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={checked}
                  onChange={() => handleToggleColumnVisibility(option.key)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
          <span className="ml-auto text-[11px] text-gray-400">
            Ẩn/hiện sẽ được áp dụng cho cả giao diện và bản in.
          </span>
        </div>

        <div>{scope === "staff" ? renderStaffSection() : renderTeamSection()}</div>
      </div>

      <div className="space-y-2 rounded-lg border bg-white p-4 text-sm text-gray-600 shadow-sm">
        <div className="font-semibold text-gray-900">Ghi chú & Quy tắc tính điểm</div>
        <p>
          Điểm KPI được tính tự động dựa trên quy tắc trong mục “Quy tắc KPI”. Khi bạn import tờ khai hợp lệ từ
          Excel, hệ thống sẽ áp dụng quy tắc hiện hành để tính điểm cho từng bản ghi và cộng dồn theo nhân viên,
          tổ đội.
        </p>
        <p>
          Các loại giấy phép bị loại trừ khỏi việc tính điểm: <strong>{excludeCodes}</strong>.
          Bạn có thể điều chỉnh danh sách này trong phần cấu hình quy tắc.
        </p>
        <p>
          Để in báo cáo, hãy chọn phạm vi thời gian và chế độ xem mong muốn, sau đó sử dụng nút “In / Xuất PDF”.
          Khi cần lưu trữ hoặc chia sẻ, sử dụng nút “Xuất Excel” để tải file theo template chứa bảng tổng hợp và
          bảng chi tiết tương ứng.
        </p>
      </div>
    </div>
  );
}
