import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getDeclRows,
  getTeamRoster,
  sortDeclRows,
  getMSTMap,
  normalizeName,
  normalizeStr,
  mapMemberNamesToTeams,
  getKpiAdjustments,
  KPI_ADJUSTMENTS_KEY,
} from "@/lib/store.js";
import { subscribe as subscribeStorage } from "@/lib/storageClient.js";
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
  LabelList,
  Cell,
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

const METRIC_SORT_KEYS = ["kpi", "decls", "licenses"];

const SORT_OPTIONS = [
  { value: "kpi", label: "Điểm KPI" },
  { value: "decls", label: "Số tờ khai" },
  { value: "licenses", label: "Số giấy phép" },
];

const REPORT_PREFS_STORAGE_KEY = "kpi_report_viewer_prefs_v1";
const QUICK_RANGE_VALUES = new Set([
  ...QUICK_RANGE_OPTIONS.map((option) => option.value),
  "custom",
]);
const SCOPE_VALUES = new Set(["staff", "team"]);

function sanitizeQuickRange(value) {
  if (typeof value !== "string") {
    return "this_month";
  }
  const normalized = value.trim();
  if (QUICK_RANGE_VALUES.has(normalized)) {
    return normalized;
  }
  return "this_month";
}

function sanitizeSortKey(value) {
  if (METRIC_SORT_KEYS.includes(value)) {
    return value;
  }
  return "kpi";
}

function sanitizeScope(value) {
  if (typeof value !== "string") {
    return "staff";
  }
  const normalized = value.trim();
  return SCOPE_VALUES.has(normalized) ? normalized : "staff";
}

function sanitizeTopStaffMetric(value) {
  return value === "decls" ? "decls" : "kpi";
}

function sanitizeSelection(value) {
  if (typeof value !== "string") {
    return "all";
  }
  const normalized = value.trim();
  return normalized || "all";
}

function sanitizeDateInput(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  return normalized || fallback;
}

function loadReportPreferences() {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(REPORT_PREFS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveReportPreferences(prefs) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(REPORT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn("Không thể lưu bộ lọc báo cáo vào localStorage", err);
  }
}

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

function sortStatsCollection(list = [], sortKey = "kpi", getLabel = (item) => item?.name || "") {
  const key = METRIC_SORT_KEYS.includes(sortKey) ? sortKey : "kpi";
  const fallbackKeys = METRIC_SORT_KEYS.filter((item) => item !== key);
  return [...list].sort((a = {}, b = {}) => {
    const statsA = a.stats || {};
    const statsB = b.stats || {};
    const primaryDiff = Number(statsB[key] || 0) - Number(statsA[key] || 0);
    if (primaryDiff !== 0) return primaryDiff;
    for (const fallback of fallbackKeys) {
      const diff = Number(statsB[fallback] || 0) - Number(statsA[fallback] || 0);
      if (diff !== 0) return diff;
    }
    const labelA = getLabel(a) || "";
    const labelB = getLabel(b) || "";
    return labelA.localeCompare(labelB, "vi", { sensitivity: "base" });
  });
}

const COLUMN_VISIBILITY_OPTIONS = [
  { key: "items", label: "Mục hàng" },
  { key: "licenses", label: "Số giấy phép" },
  { key: "co", label: "Tờ khai C/O" },
  { key: "coLines", label: "Dòng C/O" },
  { key: "licenseCodes", label: "Mã giấy phép" },
];

function CompanySummaryTable({
  rows,
  includeStaff = false,
  includeTeam = false,
  visibleColumns = {},
  sortKey = "kpi",
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
    },
  );

  const activeColumns = columns.filter((col) => (col.visibleKey ? visibleColumns[col.visibleKey] !== false : true));
  const sortedRows = useMemo(() => sortCompanyRows(rows, sortKey), [rows, sortKey]);

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
          {sortedRows.length ? (
            sortedRows.map((row, idx) => (
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

function TopStaffWidget({ metric = "kpi", onMetricChange, kpiData = [], declData = [] }) {
  const hasKpiData = kpiData.length > 0;
  const hasDeclData = declData.length > 0;
  const hasData = metric === "kpi" ? hasKpiData : hasDeclData;

  const maxKPI = hasKpiData ? Math.max(...kpiData.map((item) => item.stats.kpi || 0), 1) : 1;
  const totalDecls = hasDeclData ? declData.reduce((sum, item) => sum + (item.decls || 0), 0) : 0;

  const renderEmptyState = (
    <p className="mt-3 text-sm text-gray-500">Chưa có dữ liệu hợp lệ trong giai đoạn này.</p>
  );

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">
          Top 5 nhân viên theo {metric === "kpi" ? "điểm KPI" : "số tờ khai"}
        </h3>
        <div className="flex gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onMetricChange?.("kpi")}
            className={`rounded px-3 py-1.5 ${
              metric === "kpi" ? "bg-black text-white" : "border bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Điểm KPI
          </button>
          <button
            type="button"
            onClick={() => onMetricChange?.("decls")}
            className={`rounded px-3 py-1.5 ${
              metric === "decls" ? "bg-black text-white" : "border bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Số tờ khai
          </button>
        </div>
      </div>

      {!hasData ? (
        renderEmptyState
      ) : metric === "kpi" ? (
        <div className="mt-4 space-y-4">
          {kpiData.map((item, idx) => {
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
                  <div className="h-full rounded-full" style={{ width: `${ratio}%`, backgroundColor: color }} />
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
      ) : (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={declData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={formatInt} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${formatInt(value)} tờ khai`, "Tờ khai"]}
                labelFormatter={(label, payload) => {
                  const entry = payload && payload[0] && payload[0].payload;
                  if (entry?.team && entry.team !== "Chưa gán tổ đội") {
                    return `${label} — ${entry.team}`;
                  }
                  return label;
                }}
              />
              <Bar dataKey="decls" name="Tờ khai" radius={[0, 4, 4, 0]}>
                {declData.map((item, idx) => (
                  <Cell key={item.key || item.name || idx} fill={chartColors[idx % chartColors.length]} />
                ))}
                <LabelList dataKey="decls" position="right" formatter={(value) => formatInt(value)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 text-xs text-gray-500">Tổng: {formatInt(totalDecls)} tờ khai</div>
        </div>
      )}
    </section>
  );
}

function TeamMetricPieCard({ title, data, valueFormatter, percentLabel, emptyMessage }) {
  const normalizedData = Array.isArray(data)
    ? data.map((item = {}) => ({
        name: item.name || "",
        value: Number(item.value || 0),
      }))
    : [];

  const total = normalizedData.reduce((sum, item) => sum + item.value, 0);
  const segments = [];
  let cursor = 0;

  normalizedData.forEach((item, idx) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    const start = cursor;
    const end = cursor + percent;
    const color = chartColors[idx % chartColors.length];
    segments.push(`${color} ${start}% ${end}%`);
    cursor = end;
  });

  const gradient = segments.length ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#e5e7eb 0 100%)";

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div
          className="h-40 w-40 flex-shrink-0 rounded-full border"
          style={{ backgroundImage: gradient }}
        >
          {total === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
              Không có dữ liệu
            </div>
          ) : null}
        </div>
        <ul className="w-full space-y-2 text-sm">
          {normalizedData.length ? (
            normalizedData.map((item, idx) => {
              const color = chartColors[idx % chartColors.length];
              const percent = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0;
              return (
                <li key={`${title}-${item.name}-${idx}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-medium text-gray-900">{item.name || "Chưa gán tổ đội"}</span>
                  <span className="text-gray-500">{valueFormatter(item.value)}</span>
                  <span className="text-gray-500">({percent}% {percentLabel})</span>
                </li>
              );
            })
          ) : (
            <li className="text-gray-500">{emptyMessage}</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function TeamPieWidget({ kpiData, declData }) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-2">
        <TeamMetricPieCard
          title="Phân bổ KPI theo tổ đội"
          data={kpiData}
          valueFormatter={formatDecimal}
          percentLabel="KPI"
          emptyMessage="Chưa có dữ liệu KPI cho các tổ đội."
        />
        <TeamMetricPieCard
          title="Phân bổ lượng tờ khai theo tổ đội"
          data={declData}
          valueFormatter={formatInt}
          percentLabel="tờ khai"
          emptyMessage="Chưa có dữ liệu tờ khai cho các tổ đội."
        />
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

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-gray-500">{subtitle}</div> : null}
    </div>
  );
}

function StaffDetailCard({ staff, canExport, onExport, exporting, visibleColumns = {} }) {
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
          <div className="flex flex-col gap-1 text-right">
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
            </div>
            <span className="text-[11px] text-gray-400">Dùng Ctrl+P nếu cần in nhanh</span>
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
                      <td className="px-3 py-1.5 text-center">{row.hasCO ? "Có" : "Không"}</td>
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

function TeamDetailCard({ team, canExport, onExport, exporting, visibleColumns = {}, memberSortKey = "kpi" }) {
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
          <div className="flex flex-col gap-1 text-right">
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
            </div>
            <span className="text-[11px] text-gray-400">Dùng Ctrl+P nếu cần in nhanh</span>
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
        <CompanySummaryTable
          rows={aggregated}
          includeStaff
          visibleColumns={visibleColumns}
          sortKey={memberSortKey}
        />
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
                {sortStatsCollection(members, memberSortKey, (item) => item.name || "").map((member, idx) => (
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
                        <td className="px-3 py-1.5 text-center">{row.hasCO ? "Có" : "Không"}</td>
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
  const storedPrefs = useMemo(() => loadReportPreferences(), []);
  const initialQuickRange = sanitizeQuickRange(storedPrefs.quickRange);
  const quickRangeBase = initialQuickRange === "custom" ? "this_month" : initialQuickRange;
  const initialRange = useMemo(() => computeQuickRange(quickRangeBase), [quickRangeBase]);
  const [quickRange, setQuickRange] = useState(initialQuickRange);
  const [from, setFrom] = useState(() =>
    initialQuickRange === "custom"
      ? sanitizeDateInput(storedPrefs.from, initialRange.from)
      : initialRange.from
  );
  const [to, setTo] = useState(() =>
    initialQuickRange === "custom"
      ? sanitizeDateInput(storedPrefs.to, initialRange.to)
      : initialRange.to
  );
  const [scope, setScope] = useState(() => sanitizeScope(storedPrefs.scope));
  const [selectedStaff, setSelectedStaff] = useState(() => sanitizeSelection(storedPrefs.selectedStaff));
  const [selectedTeam, setSelectedTeam] = useState(() => sanitizeSelection(storedPrefs.selectedTeam));
  const [staffViewMode, setStaffViewMode] = useState("detail");
  const [teamViewMode, setTeamViewMode] = useState("detail");
  const [topStaffMetric, setTopStaffMetric] = useState(() => sanitizeTopStaffMetric(storedPrefs.topStaffMetric));
  const [staffSortKey, setStaffSortKey] = useState(() => sanitizeSortKey(storedPrefs.staffSortKey));
  const [teamSortKey, setTeamSortKey] = useState(() => sanitizeSortKey(storedPrefs.teamSortKey));
  const [version, setVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState(() => ({
    items: true,
    licenses: true,
    co: true,
    coLines: true,
    licenseCodes: true,
  }));
  const prefsSnapshotRef = useRef("");

  const handleToggleColumnVisibility = (key) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [key]: prev[key] === false,
    }));
  };

  useEffect(() => {
    const payload = {
      quickRange,
      from,
      to,
      scope,
      selectedStaff,
      selectedTeam,
      staffSortKey,
      teamSortKey,
      topStaffMetric,
    };
    const snapshot = JSON.stringify(payload);
    if (prefsSnapshotRef.current === snapshot) {
      return;
    }
    prefsSnapshotRef.current = snapshot;
    saveReportPreferences(payload);
  }, [
    quickRange,
    from,
    to,
    scope,
    selectedStaff,
    selectedTeam,
    staffSortKey,
    teamSortKey,
    topStaffMetric,
  ]);

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
  const [adjustments, setAdjustments] = useState(() => getKpiAdjustments());

  useEffect(() => {
    setRulesState(loadRules());
    setRoster(getTeamRoster());
    setMstRows(getMSTMap());
    setDeclarations(sortDeclRows(getDeclRows()));
    setAdjustments(getKpiAdjustments());
  }, [version]);

  useEffect(() => {
    const unsubscribe = subscribeStorage(KPI_ADJUSTMENTS_KEY, () => {
      setAdjustments(getKpiAdjustments());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const report = useMemo(
    () => buildReportData(declarations, { roster, rules, from, to, adjustments }),
    [declarations, roster, rules, from, to, adjustments]
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

  const adjustmentsReport = useMemo(() => {
    const base = report.adjustments || {};
    return {
      list: Array.isArray(base.list) ? base.list : [],
      applied: Array.isArray(base.applied) ? base.applied : [],
      totalPoints: Number(base.totalPoints || 0),
      pendingCount: Number(base.pendingCount || 0),
      approvedCount: Number(base.approvedCount || 0),
      rejectedCount: Number(base.rejectedCount || 0),
      appliedCount: Number(base.appliedCount || 0),
    };
  }, [report.adjustments]);

  const appliedAdjustments = adjustmentsReport.applied;
  const pendingAdjustments = useMemo(
    () => adjustmentsReport.list.filter((item) => item?.status === "pending"),
    [adjustmentsReport.list]
  );
  const rejectedAdjustments = useMemo(
    () => adjustmentsReport.list.filter((item) => item?.status === "rejected"),
    [adjustmentsReport.list]
  );

  const topStaffByKpi = useMemo(() => {
    return sortStatsCollection(report.staff.list, "kpi", (item) => item.name || "").slice(0, 5);
  }, [report.staff.list]);

  const topStaffByDecls = useMemo(() => {
    return sortStatsCollection(report.staff.list, "decls", (item) => item.name || "")
      .map((item) => {
        const teamLabel = item.teamLabel && item.teamLabel !== "Chưa gán tổ đội"
          ? item.teamLabel
          : "Chưa gán tổ đội";
        return {
          key: item.key,
          name: item.name,
          decls: Number(item?.stats?.decls || 0),
          team: teamLabel,
        };
      })
      .filter((item) => item.decls > 0)
      .slice(0, 5);
  }, [report.staff.list]);

  const teamPieData = useMemo(() => {
    return report.teams.list.map((item) => ({
      name: item.name,
      value: Math.round((item.stats.kpi || 0) * 10) / 10,
    }));
  }, [report.teams.list]);

  const teamDeclPieData = useMemo(() => {
    return report.teams.list.map((item) => ({
      name: item.name,
      value: Number(item.stats.decls || 0),
    }));
  }, [report.teams.list]);

  const sortedStaffList = useMemo(() => {
    return sortStatsCollection(
      report.staff.list,
      staffSortKey,
      (item) => {
        const team = item.teamLabel && item.teamLabel !== "Chưa gán tổ đội" ? ` — ${item.teamLabel}` : "";
        return `${item.name || ""}${team}`;
      }
    );
  }, [report.staff.list, staffSortKey]);

  const sortedTeamList = useMemo(() => {
    return sortStatsCollection(report.teams.list, teamSortKey, (item) => item.name || "");
  }, [report.teams.list, teamSortKey]);

  const trend = report.trend || {};
  const trendSeries = trend.series || [];
  const trendComparison = trend.comparison || null;

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
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="font-semibold text-gray-900">Sắp xếp theo:</span>
              <div className="flex gap-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStaffSortKey(option.value)}
                    className={`rounded px-2.5 py-1 font-semibold ${
                      staffSortKey === option.value
                        ? "bg-black text-white"
                        : "border bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto flex flex-col gap-1 text-right">
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
              <span className="text-[11px] text-gray-400">Nhấn Ctrl+P để in nhanh toàn trang</span>
            </div>
          </div>

          {staffViewMode === "summary" ? (
            <CompanySummaryTable
              rows={companySummaryAllStaff}
              includeStaff
              visibleColumns={columnVisibility}
              sortKey={staffSortKey}
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
                    {sortedStaffList.map((item, idx) => (
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
                {sortedStaffList.map((item) => (
                  <StaffDetailCard
                    key={item.key}
                    staff={item}
                    canExport={canExport}
                    onExport={() => handleExportStaffDetail(item)}
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
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="font-semibold text-gray-900">Sắp xếp theo:</span>
              <div className="flex gap-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTeamSortKey(option.value)}
                    className={`rounded px-2.5 py-1 font-semibold ${
                      teamSortKey === option.value
                        ? "bg-black text-white"
                        : "border bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto flex flex-col gap-1 text-right">
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
              <span className="text-[11px] text-gray-400">Nhấn Ctrl+P để in nhanh toàn trang</span>
            </div>
          </div>

          {teamViewMode === "summary" ? (
            <CompanySummaryTable
              rows={companySummaryAllTeams}
              includeStaff
              includeTeam
              visibleColumns={columnVisibility}
              sortKey={teamSortKey}
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
                    {sortedTeamList.map((item, idx) => (
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
                {sortedTeamList.map((item) => (
                  <TeamDetailCard
                    key={item.key}
                    team={item}
                    canExport={canExport}
                    onExport={() => handleExportTeamDetail(item)}
                    exporting={exporting}
                    visibleColumns={columnVisibility}
                    memberSortKey={teamSortKey}
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
        exporting={exporting}
        visibleColumns={columnVisibility}
        memberSortKey={teamSortKey}
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
          title="Điểm KPI +/- bổ sung"
          value={formatDecimal(adjustmentsReport.totalPoints || 0)}
          subtitle={`Đã duyệt: ${formatInt(adjustmentsReport.approvedCount || 0)} • Chờ duyệt: ${formatInt(
            adjustmentsReport.pendingCount || 0
          )}`}
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

      <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Điểm KPI +/- bổ sung</h3>
            <p className="mt-1 text-sm text-gray-500">
              Điểm cộng/trừ được duyệt sẽ được cộng trực tiếp vào KPI tháng tương ứng trong báo cáo.
            </p>
          </div>
          <div className="text-sm text-gray-600 text-right">
            <div>Đã duyệt: {formatInt(adjustmentsReport.approvedCount || 0)} mục</div>
            <div>Chờ duyệt: {formatInt(adjustmentsReport.pendingCount || 0)} mục</div>
            {adjustmentsReport.rejectedCount ? (
              <div>Đã từ chối: {formatInt(adjustmentsReport.rejectedCount || 0)} mục</div>
            ) : null}
            <div className="mt-1 font-semibold text-emerald-600">
              Điểm đã áp dụng: {formatDecimal(adjustmentsReport.totalPoints || 0)}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h4 className="mb-3 text-sm font-semibold text-gray-800">Chi tiết điểm đã áp dụng</h4>
            <div className="overflow-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Tháng</th>
                    <th className="px-3 py-2 text-left">Hạng mục</th>
                    <th className="px-3 py-2 text-left">Nhân viên</th>
                    <th className="px-3 py-2 text-left">Tổ đội</th>
                    <th className="px-3 py-2 text-right">Số lượng × Hệ số</th>
                    <th className="px-3 py-2 text-right">Điểm</th>
                    <th className="px-3 py-2 text-left">Tham chiếu</th>
                    <th className="px-3 py-2 text-left">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {appliedAdjustments.length ? (
                    appliedAdjustments.map((item) => {
                      const key = item.adjustment?.id || `${item.date}-${item.nhan_vien || ''}`;
                      const quantity = Number.isFinite(Number(item.adjustment?.quantity))
                        ? Number(item.adjustment.quantity)
                        : null;
                      const unitPoints = Number.isFinite(Number(item.adjustment?.unitPoints))
                        ? Number(item.adjustment.unitPoints)
                        : null;
                      const references = Array.isArray(item.adjustment?.references)
                        ? item.adjustment.references.filter(Boolean).join(', ')
                        : '';
                      const note = item.adjustment?.note || '';
                      const scoreClass = item.kpi >= 0 ? 'text-emerald-600' : 'text-rose-600';
                      return (
                        <tr key={key} className="odd:bg-white even:bg-gray-50">
                          <td className="px-3 py-1.5">{item.displayDate || (item.date ? item.date.slice(0, 7) : '—')}</td>
                          <td className="px-3 py-1.5">{item.adjustment?.label || item.loai_hinh}</td>
                          <td className="px-3 py-1.5">{item.nhan_vien || 'Chưa gán'}</td>
                          <td className="px-3 py-1.5">{item.team || 'Chưa gán tổ đội'}</td>
                          <td className="px-3 py-1.5 text-right">
                            {quantity !== null ? formatDecimal(quantity) : '—'}
                            {unitPoints !== null ? (
                              <span className="ml-1 text-xs text-gray-500">× {formatDecimal(unitPoints)}</span>
                            ) : null}
                          </td>
                          <td className={`px-3 py-1.5 text-right font-semibold ${scoreClass}`}>
                            {formatDecimal(item.kpi)}
                          </td>
                          <td className="px-3 py-1.5">{references || '—'}</td>
                          <td className="px-3 py-1.5">{note || '—'}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-3 py-4 text-center text-gray-500" colSpan={8}>
                        Chưa có điểm bổ sung nào được duyệt trong khoảng thời gian này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Chờ duyệt</h4>
              {pendingAdjustments.length ? (
                <ul className="mt-2 space-y-2 text-sm text-gray-600">
                  {pendingAdjustments.map((item) => (
                    <li key={item.id} className="rounded border border-dashed border-amber-300 bg-amber-50 px-3 py-2">
                      <div className="font-medium text-gray-900">{item.label || item.category}</div>
                      <div>{item.staffName || 'Chưa gán'} — {item.month}</div>
                      <div>Điểm đề xuất: {formatDecimal(item.totalPoints || 0)}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gray-500">Không có yêu cầu đang chờ.</p>
              )}
            </div>
            {rejectedAdjustments.length ? (
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Đã từ chối gần đây</h4>
                <ul className="mt-2 space-y-2 text-sm text-gray-500">
                  {rejectedAdjustments.slice(0, 3).map((item) => (
                    <li key={item.id} className="rounded border px-3 py-2">
                      <div className="font-medium text-gray-900">{item.label || item.category}</div>
                      <div>{item.staffName || 'Chưa gán'} — {item.month}</div>
                      <div>Điểm: {formatDecimal(item.totalPoints || 0)}</div>
                    </li>
                  ))}
                </ul>
                {rejectedAdjustments.length > 3 ? (
                  <div className="pt-1 text-xs text-gray-400">
                    Còn {rejectedAdjustments.length - 3} mục khác đã bị từ chối.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendLineChart data={trendSeries} comparison={trendComparison} />
        <TopStaffWidget
          metric={topStaffMetric}
          onMetricChange={setTopStaffMetric}
          kpiData={topStaffByKpi}
          declData={topStaffByDecls}
        />
        <div className="lg:col-span-2">
          <TeamPieWidget kpiData={teamPieData} declData={teamDeclPieData} />
        </div>
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
          Để in báo cáo, hãy chọn phạm vi thời gian và chế độ xem mong muốn, sau đó sử dụng tổ hợp phím
          <strong> Ctrl+P</strong> (hoặc Command+P trên macOS). Khi cần lưu trữ hoặc chia sẻ, sử dụng nút “Xuất Excel”
          để tải file theo template chứa bảng tổng hợp và bảng chi tiết tương ứng.
        </p>
      </div>
    </div>
  );
}
