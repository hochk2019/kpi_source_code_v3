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
  getReportSchedules,
  saveReportSchedule,
  deleteReportSchedule,
  REPORT_SCHEDULE_KEY,
  calculateNextReportScheduleRun,
} from "@/lib/store.js";
import { subscribe as subscribeStorage } from "@/lib/storageClient.js";
import { loadRules, loadRuleSets } from "@/lib/rules.js";
import { formatDisplayDate } from "@/shared/format.js";
import {
  QUICK_RANGE_OPTIONS,
  computeQuickRange,
  buildReportData,
  aggregateByCompany,
} from "@/lib/reports.js";
import { seedSampleDeclarations } from "@/shared/sampleDeclarations.js";
import { toAdjustmentTotalsArray } from "../../shared/kpiAdjustments.js";
import { isAdminRole } from "@/shared/accountRoles.js";
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
import { useChartPalette } from "@/designSystem/hooks.js";
import { toast } from "@/shared/toast.js";

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

function formatOptionalDecimal(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || Math.abs(num) < 0.0001) {
    return "—";
  }
  return formatDecimal(num);
}

function formatOptionalInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return "—";
  }
  return formatInt(num);
}

const DEFAULT_CHART_COLORS = ["#2563eb", "#22c55e", "#f97316", "#a855f7", "#14b8a6"];

const METRIC_SORT_KEYS = ["kpi", "decls", "licenses"];

const ADJUSTMENT_CATEGORY_TONE_MAP = {
  support: "text-emerald-600",
  cancel: "text-rose-500",
  correction: "text-amber-600",
  tax: "text-sky-600",
  teamwork: "text-indigo-600",
  coworker_attitude: "text-purple-600",
  customer_attitude: "text-fuchsia-600",
  discipline: "text-amber-700",
};

const SORT_OPTIONS = [
  { value: "kpi", label: "Điểm KPI" },
  { value: "decls", label: "Số tờ khai" },
  { value: "licenses", label: "Số giấy phép" },
];

const ADJUSTMENT_PAGE_SIZE_OPTIONS = [5, 10, 20];
const DEFAULT_ADJUSTMENT_PAGE_SIZE = 10;

const DETAIL_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];
const DEFAULT_DETAIL_PAGE_SIZE = 20;

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Thứ hai" },
  { value: 2, label: "Thứ ba" },
  { value: 3, label: "Thứ tư" },
  { value: 4, label: "Thứ năm" },
  { value: 5, label: "Thứ sáu" },
  { value: 6, label: "Thứ bảy" },
  { value: 7, label: "Chủ nhật" },
];

const SCHEDULE_FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Hàng tuần" },
  { value: "monthly", label: "Hàng tháng" },
];

const SCHEDULE_FORMAT_OPTIONS = [
  { value: "excel", label: "Excel" },
  { value: "pdf", label: "PDF" },
];

function createScheduleDraft(entry = null) {
  const raw = entry && typeof entry === "object" ? entry : {};
  const formats = Array.isArray(raw.formats) && raw.formats.length ? raw.formats : ["excel"];
  const recipients = Array.isArray(raw.recipients)
    ? raw.recipients.join(", ")
    : typeof raw.recipientsInput === "string"
    ? raw.recipientsInput
    : "";
  return {
    id: raw.id || "",
    name: raw.name || "",
    frequency: raw.frequency || "weekly",
    dayOfWeek: Number.isFinite(Number(raw.dayOfWeek)) ? Number(raw.dayOfWeek) : 1,
    dayOfMonth: Number.isFinite(Number(raw.dayOfMonth)) ? Number(raw.dayOfMonth) : 1,
    time: raw.time || "08:00",
    recipientsInput: recipients,
    formats,
    active: raw.active !== false,
  };
}

function toSchedulePayload(draft) {
  return {
    id: draft.id || undefined,
    name: draft.name,
    frequency: draft.frequency,
    dayOfWeek:
      draft.frequency === "weekly"
        ? Number.isFinite(Number(draft.dayOfWeek))
          ? Number(draft.dayOfWeek)
          : 1
        : null,
    dayOfMonth:
      draft.frequency === "monthly"
        ? Number.isFinite(Number(draft.dayOfMonth))
          ? Number(draft.dayOfMonth)
          : 1
        : null,
    time: draft.time || "08:00",
    recipients: draft.recipientsInput || "",
    formats: Array.isArray(draft.formats) && draft.formats.length ? draft.formats : ["excel"],
    active: Boolean(draft.active),
  };
}

function formatScheduleNextRunLabel(isoString) {
  if (!isoString) {
    return "Chưa lên lịch";
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "Chưa lên lịch";
  }
  return date.toLocaleString("vi-VN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeScheduleFrequency(schedule) {
  if (!schedule) return "";
  const timeLabel = schedule.time || "08:00";
  if (schedule.frequency === "weekly") {
    const dayOption = WEEKDAY_OPTIONS.find((item) => item.value === Number(schedule.dayOfWeek));
    const dayLabel = dayOption ? dayOption.label : "tuần";
    return `Mỗi ${dayLabel.toLowerCase()} lúc ${timeLabel}`;
  }
  if (schedule.frequency === "monthly") {
    const day = Number.isFinite(Number(schedule.dayOfMonth)) ? Number(schedule.dayOfMonth) : 1;
    return `Ngày ${day} hàng tháng lúc ${timeLabel}`;
  }
  return "";
}

function getSegmentedButtonClass(isActive) {
  return [
    "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
    isActive
      ? "bg-[color:var(--ds-surface-primary)] text-[color:var(--ds-text-primary)] shadow-sm"
      : "border border-[color:var(--ds-border-subtle)] bg-white text-[color:var(--ds-text-secondary)] hover:text-[color:var(--ds-text-primary)]",
  ].join(" ");
}

const REPORT_PREFS_STORAGE_KEY = "kpi_report_viewer_prefs_v1";
const EXPORT_COLUMN_KEYS = ["items", "licenses", "co", "coLines", "licenseCodes"];
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

function sanitizeAdjustmentPageSize(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return DEFAULT_ADJUSTMENT_PAGE_SIZE;
  }
  return ADJUSTMENT_PAGE_SIZE_OPTIONS.includes(num) ? num : DEFAULT_ADJUSTMENT_PAGE_SIZE;
}

function sanitizeDetailPageSize(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return DEFAULT_DETAIL_PAGE_SIZE;
  }
  return DETAIL_PAGE_SIZE_OPTIONS.includes(num) ? num : DEFAULT_DETAIL_PAGE_SIZE;
}

function sanitizeRulePreference(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
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

function sanitizeColumnVisibility(input = {}) {
  if (!input || typeof input !== "object") {
    return {};
  }
  const result = {};
  for (const key of EXPORT_COLUMN_KEYS) {
    if (input[key] === false) {
      result[key] = false;
    }
  }
  return result;
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

function TopStaffWidget({ metric = "kpi", onMetricChange, kpiData = [], declData = [], palette = DEFAULT_CHART_COLORS }) {
  const hasKpiData = kpiData.length > 0;
  const hasDeclData = declData.length > 0;
  const hasData = metric === "kpi" ? hasKpiData : hasDeclData;

  const maxKPI = hasKpiData ? Math.max(...kpiData.map((item) => item.stats.kpi || 0), 1) : 1;
  const totalDecls = hasDeclData ? declData.reduce((sum, item) => sum + (item.decls || 0), 0) : 0;
  const colors = Array.isArray(palette) && palette.length ? palette : DEFAULT_CHART_COLORS;

  const renderEmptyState = (
    <p className="mt-3 text-sm text-gray-500">Chưa có dữ liệu hợp lệ trong giai đoạn này.</p>
  );

  return (
    <section className="ds-card space-y-4 p-4">
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
            const color = colors[idx % colors.length];
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
                  <Cell key={item.key || item.name || idx} fill={colors[idx % colors.length]} />
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

function TeamMetricPieCard({ title, data, valueFormatter, percentLabel, emptyMessage, palette = DEFAULT_CHART_COLORS }) {
  const normalizedData = Array.isArray(data)
    ? data.map((item = {}) => ({
        name: item.name || "",
        value: Number(item.value || 0),
      }))
    : [];

  const total = normalizedData.reduce((sum, item) => sum + item.value, 0);
  const segments = [];
  let cursor = 0;
  const colors = Array.isArray(palette) && palette.length ? palette : DEFAULT_CHART_COLORS;

  normalizedData.forEach((item, idx) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    const start = cursor;
    const end = cursor + percent;
    const color = colors[idx % colors.length];
    segments.push(`${color} ${start}% ${end}%`);
    cursor = end;
  });

  const gradient = segments.length ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#e5e7eb 0 100%)";

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div
          className="h-40 w-40 flex-shrink-0 rounded-full border border-subtle"
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
              const color = colors[idx % colors.length];
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

function TeamPieWidget({ kpiData, declData, palette = DEFAULT_CHART_COLORS }) {
  return (
    <section className="ds-card space-y-6 p-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <TeamMetricPieCard
          title="Phân bổ KPI theo tổ đội"
          data={kpiData}
          valueFormatter={formatDecimal}
          percentLabel="KPI"
          emptyMessage="Chưa có dữ liệu KPI cho các tổ đội."
          palette={palette}
        />
        <TeamMetricPieCard
          title="Phân bổ lượng tờ khai theo tổ đội"
          data={declData}
          valueFormatter={formatInt}
          percentLabel="tờ khai"
          emptyMessage="Chưa có dữ liệu tờ khai cho các tổ đội."
          palette={palette}
        />
      </div>
    </section>
  );
}

function TrendLineChart({ data, comparison, palette = DEFAULT_CHART_COLORS }) {
  const colors = Array.isArray(palette) && palette.length ? palette : DEFAULT_CHART_COLORS;
  const kpiColor = colors[0] ?? DEFAULT_CHART_COLORS[0];
  const declColor = colors[1] ?? DEFAULT_CHART_COLORS[1];
  if (!data || data.length === 0) {
    return (
      <section className="ds-card space-y-3 p-4">
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
    <section className="ds-card space-y-4 p-4">
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
            <YAxis yAxisId="left" stroke={kpiColor} />
            <YAxis yAxisId="right" orientation="right" stroke={declColor} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="kpi" name="Điểm KPI" stroke={kpiColor} strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="decls" name="Tờ khai" stroke={declColor} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="ds-card p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-gray-500">{subtitle}</div> : null}
    </div>
  );
}

function StaffDetailCard({ staff, canExport, onExport, exporting, visibleColumns = {} }) {
  const { stats, rows, adjustmentSummary } = staff;
  const [mode, setMode] = useState("summary");
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
  const adjustmentTotals = useMemo(
    () => toAdjustmentTotalsArray(adjustmentSummary || {}),
    [adjustmentSummary]
  );
  const totalAdjustmentPoints = useMemo(
    () =>
      adjustmentTotals.reduce((sum, item) => {
        const value = Number(item?.points || 0);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0),
    [adjustmentTotals]
  );
  const totalAdjustmentEntries = useMemo(
    () => rows.filter((row) => row?.isAdjustment).length,
    [rows]
  );
  const adjustmentBreakdown = useMemo(() => {
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    for (const row of rows) {
      if (!row?.isAdjustment) continue;
      const value = Number(row?.kpi || 0);
      if (!Number.isFinite(value) || Math.abs(value) < 0.0001) {
        neutral += 1;
        continue;
      }
      if (value > 0) {
        positive += 1;
      } else {
        negative += 1;
      }
    }
    return { positive, negative, neutral };
  }, [rows]);
  const adjustmentTooltip = useMemo(() => {
    const lines = adjustmentTotals
      .filter((item) => Number(item?.points))
      .map((item) => `${item.label}: ${formatDecimal(item.points)}`);
    if (!lines.length) {
      return "Chưa có điều chỉnh";
    }
    return lines.join("\n");
  }, [adjustmentTotals]);
  const adjustmentSubtitle = useMemo(() => {
    if (!totalAdjustmentEntries) {
      return "Chưa có điều chỉnh";
    }
    const segments = [];
    if (adjustmentBreakdown.positive) {
      segments.push(`${formatInt(adjustmentBreakdown.positive)} lượt cộng`);
    }
    if (adjustmentBreakdown.negative) {
      segments.push(`${formatInt(adjustmentBreakdown.negative)} lượt trừ`);
    }
    if (adjustmentBreakdown.neutral) {
      segments.push(`${formatInt(adjustmentBreakdown.neutral)} lượt 0 điểm`);
    }
    if (!segments.length) {
      return `${formatInt(totalAdjustmentEntries)} lượt cộng/trừ`;
    }
    return segments.join(" • ");
  }, [adjustmentBreakdown, totalAdjustmentEntries]);
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
          <div className="flex items-center gap-2 rounded-full bg-[color:var(--ds-surface-muted)] px-2 py-1">
            <button
              type="button"
              onClick={() => setMode("summary")}
              className={getSegmentedButtonClass(mode === "summary")}
            >
              Tổng quan
            </button>
            <button
              type="button"
              onClick={() => setMode("detail")}
              className={getSegmentedButtonClass(mode === "detail")}
            >
              Chi tiết
            </button>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onExport}
                disabled={!canExport || exporting}
                className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                  canExport && !exporting
                    ? 'border-[color:var(--ds-border-strong)] bg-[color:var(--ds-surface-primary)] text-white hover:bg-[color:var(--ds-surface-strong)]'
                    : 'cursor-not-allowed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-disabled)]'
                }`}
              >
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
            </div>
            <span className="text-[11px] text-gray-400">Dùng Ctrl+P nếu cần in nhanh</span>
          </div>
        </div>
      </header>

      <div className="grid gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
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
        <div className="rounded border bg-gray-50 px-3 py-2" title={adjustmentTooltip}>
          <div className="text-xs uppercase text-gray-500">Điểm KPI +/-</div>
          <div className="text-base font-semibold text-gray-900">{formatDecimal(totalAdjustmentPoints)}</div>
          <div className="mt-1 text-[11px] text-gray-500">{adjustmentSubtitle}</div>
        </div>
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
  const { stats, members, rows, adjustmentSummary } = team;
  const [mode, setMode] = useState("summary");
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
  const adjustmentTotals = useMemo(
    () => toAdjustmentTotalsArray(adjustmentSummary || {}),
    [adjustmentSummary]
  );
  const totalAdjustmentPoints = useMemo(
    () =>
      adjustmentTotals.reduce((sum, item) => {
        const value = Number(item?.points || 0);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0),
    [adjustmentTotals]
  );
  const totalAdjustmentEntries = useMemo(
    () => rows.filter((row) => row?.isAdjustment).length,
    [rows]
  );
  const adjustmentBreakdown = useMemo(() => {
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    for (const row of rows) {
      if (!row?.isAdjustment) continue;
      const value = Number(row?.kpi || 0);
      if (!Number.isFinite(value) || Math.abs(value) < 0.0001) {
        neutral += 1;
        continue;
      }
      if (value > 0) {
        positive += 1;
      } else {
        negative += 1;
      }
    }
    return { positive, negative, neutral };
  }, [rows]);
  const adjustmentTooltip = useMemo(() => {
    const lines = adjustmentTotals
      .filter((item) => Number(item?.points))
      .map((item) => `${item.label}: ${formatDecimal(item.points)}`);
    if (!lines.length) {
      return "Chưa có điều chỉnh";
    }
    return lines.join("\n");
  }, [adjustmentTotals]);
  const adjustmentSubtitle = useMemo(() => {
    if (!totalAdjustmentEntries) {
      return "Chưa có điều chỉnh";
    }
    const segments = [];
    if (adjustmentBreakdown.positive) {
      segments.push(`${formatInt(adjustmentBreakdown.positive)} lượt cộng`);
    }
    if (adjustmentBreakdown.negative) {
      segments.push(`${formatInt(adjustmentBreakdown.negative)} lượt trừ`);
    }
    if (adjustmentBreakdown.neutral) {
      segments.push(`${formatInt(adjustmentBreakdown.neutral)} lượt 0 điểm`);
    }
    if (!segments.length) {
      return `${formatInt(totalAdjustmentEntries)} lượt cộng/trừ`;
    }
    return segments.join(" • ");
  }, [adjustmentBreakdown, totalAdjustmentEntries]);
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
          <div className="flex items-center gap-2 rounded-full bg-[color:var(--ds-surface-muted)] px-2 py-1">
            <button
              type="button"
              onClick={() => setMode("summary")}
              className={getSegmentedButtonClass(mode === "summary")}
            >
              Tổng quan
            </button>
            <button
              type="button"
              onClick={() => setMode("detail")}
              className={getSegmentedButtonClass(mode === "detail")}
            >
              Chi tiết
            </button>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onExport}
                disabled={!canExport || exporting}
                className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                  canExport && !exporting
                    ? 'border-[color:var(--ds-border-strong)] bg-[color:var(--ds-surface-primary)] text-white hover:bg-[color:var(--ds-surface-strong)]'
                    : 'cursor-not-allowed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-disabled)]'
                }`}
              >
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
            </div>
            <span className="text-[11px] text-gray-400">Dùng Ctrl+P nếu cần in nhanh</span>
          </div>
        </div>
      </header>

      <div className="grid gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
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
        <div className="rounded border bg-gray-50 px-3 py-2" title={adjustmentTooltip}>
          <div className="text-xs uppercase text-gray-500">Điểm KPI +/-</div>
          <div className="text-base font-semibold text-gray-900">{formatDecimal(totalAdjustmentPoints)}</div>
          <div className="mt-1 text-[11px] text-gray-500">{adjustmentSubtitle}</div>
        </div>
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

export default function ReportViewer({ canExport = true, currentUser = null }) {
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
  const [staffViewMode, setStaffViewMode] = useState("summary");
  const [teamViewMode, setTeamViewMode] = useState("summary");
  const [topStaffMetric, setTopStaffMetric] = useState(() => sanitizeTopStaffMetric(storedPrefs.topStaffMetric));
  const [staffSortKey, setStaffSortKey] = useState(() => sanitizeSortKey(storedPrefs.staffSortKey));
  const [teamSortKey, setTeamSortKey] = useState(() => sanitizeSortKey(storedPrefs.teamSortKey));
  const [version, setVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const storedColumnPrefs = useMemo(
    () => sanitizeColumnVisibility(storedPrefs.columns),
    [storedPrefs]
  );
  const [columnVisibility, setColumnVisibility] = useState(() => ({
    items: storedColumnPrefs.items === false ? false : true,
    licenses: storedColumnPrefs.licenses === false ? false : true,
    co: storedColumnPrefs.co === false ? false : true,
    coLines: storedColumnPrefs.coLines === false ? false : true,
    licenseCodes: storedColumnPrefs.licenseCodes === false ? false : true,
  }));
  const exportColumns = useMemo(() => sanitizeColumnVisibility(columnVisibility), [columnVisibility]);
  const prefsSnapshotRef = useRef("");
  const [scheduleCollapsed, setScheduleCollapsed] = useState(() => storedPrefs.scheduleCollapsed === true);
  const isAdmin = isAdminRole(currentUser?.role);

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

  const [ruleCollection, setRuleCollection] = useState(() => loadRuleSets());
  const [selectedRuleId, setSelectedRuleId] = useState(() => sanitizeRulePreference(storedPrefs.ruleId));
  const [rules, setRulesState] = useState(() =>
    loadRules(sanitizeRulePreference(storedPrefs.ruleId) || undefined)
  );
  const [roster, setRoster] = useState(() => getTeamRoster());
  const [mstRows, setMstRows] = useState(() => getMSTMap());
  const [declarations, setDeclarations] = useState(() => sortDeclRows(getDeclRows()));
  const [adjustments, setAdjustments] = useState(() => getKpiAdjustments());
  const [reportSchedules, setReportSchedules] = useState(() => getReportSchedules());
  const [scheduleDraft, setScheduleDraft] = useState(() => createScheduleDraft());
  const [editingScheduleId, setEditingScheduleId] = useState("");

  const [adjustmentPageSize, setAdjustmentPageSize] = useState(() =>
    sanitizeAdjustmentPageSize(storedPrefs.adjustmentPageSize)
  );
  const [adjustmentPage, setAdjustmentPage] = useState(0);
  const [detailPageSize, setDetailPageSize] = useState(() =>
    sanitizeDetailPageSize(storedPrefs.detailPageSize)
  );
  const [staffDetailPage, setStaffDetailPage] = useState(0);
  const [teamDetailPage, setTeamDetailPage] = useState(0);

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
      columns: exportColumns,
      ruleId: selectedRuleId,
      adjustmentPageSize,
      detailPageSize,
      scheduleCollapsed,
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
    exportColumns,
    selectedRuleId,
    adjustmentPageSize,
    detailPageSize,
    scheduleCollapsed,
  ]);

  useEffect(() => {
    setRuleCollection(loadRuleSets());
    setRoster(getTeamRoster());
    setMstRows(getMSTMap());
    setDeclarations(sortDeclRows(getDeclRows()));
    setAdjustments(getKpiAdjustments());
    setReportSchedules(getReportSchedules());
  }, [version]);

  useEffect(() => {
    const unsubscribeAdjustments = subscribeStorage(KPI_ADJUSTMENTS_KEY, () => {
      setAdjustments(getKpiAdjustments());
    });
    const unsubscribeSchedules = subscribeStorage(REPORT_SCHEDULE_KEY, () => {
      setReportSchedules(getReportSchedules());
    });
    return () => {
      unsubscribeAdjustments();
      unsubscribeSchedules();
    };
  }, []);

  useEffect(() => {
    const sets = Array.isArray(ruleCollection?.sets) ? ruleCollection.sets : [];
    if (!sets.length) {
      setRulesState(loadRules());
      return;
    }
    const availableIds = new Set(sets.map((item) => item.id));
    let targetId = selectedRuleId && availableIds.has(selectedRuleId) ? selectedRuleId : "";
    if (!targetId) {
      const storedId = sanitizeRulePreference(storedPrefs.ruleId);
      if (storedId && availableIds.has(storedId)) {
        targetId = storedId;
      }
    }
    if (!targetId) {
      const activeId = ruleCollection?.activeId;
      if (activeId && availableIds.has(activeId)) {
        targetId = activeId;
      } else {
        targetId = sets[0].id;
      }
    }
    if (targetId !== selectedRuleId) {
      setSelectedRuleId(targetId);
      return;
    }
    setRulesState(loadRules(targetId || undefined));
  }, [ruleCollection, selectedRuleId, storedPrefs.ruleId]);

  const report = useMemo(
    () => buildReportData(declarations, { roster, rules, from, to, adjustments }),
    [declarations, roster, rules, from, to, adjustments]
  );

  const activeRule = useMemo(() => {
    const sets = Array.isArray(ruleCollection?.sets) ? ruleCollection.sets : [];
    return sets.find((item) => item.id === ruleCollection?.activeId) || null;
  }, [ruleCollection]);

  const baselineReport = useMemo(() => {
    if (!activeRule || !activeRule.id) {
      return null;
    }
    if (rules && activeRule.id === rules.id) {
      return null;
    }
    return buildReportData(declarations, {
      roster,
      rules: activeRule,
      from,
      to,
      adjustments,
    });
  }, [activeRule, declarations, roster, from, to, adjustments, rules]);

  const ruleComparison = useMemo(() => {
    if (!baselineReport) {
      return null;
    }
    const currentSummary = report?.summary;
    const baselineSummary = baselineReport.summary;
    if (!currentSummary || !baselineSummary) {
      return null;
    }
    return {
      kpi: (currentSummary.kpi || 0) - (baselineSummary.kpi || 0),
      decls: (currentSummary.decls || 0) - (baselineSummary.decls || 0),
      items: (currentSummary.items || 0) - (baselineSummary.items || 0),
    };
  }, [baselineReport, report]);

  const ruleOptions = useMemo(() => {
    const sets = Array.isArray(ruleCollection?.sets) ? ruleCollection.sets : [];
    return sets.map((set) => {
      const versionLabel = Number.isFinite(Number(set.version)) ? `v${Number(set.version)}` : "";
      const activeBadge = ruleCollection?.activeId === set.id ? " • Đang áp dụng" : "";
      const name = set.name || set.id || "Bộ quy tắc";
      return {
        value: set.id,
        label: `${name} ${versionLabel}`.trim() + activeBadge,
      };
    });
  }, [ruleCollection]);

  const selectedRuleMeta = useMemo(() => {
    const sets = Array.isArray(ruleCollection?.sets) ? ruleCollection.sets : [];
    return sets.find((set) => set.id === selectedRuleId) || null;
  }, [ruleCollection, selectedRuleId]);

  const nextScheduleRun = useMemo(() => {
    const activeSchedules = (reportSchedules || []).filter((item) => item && item.active);
    const sorted = activeSchedules
      .slice()
      .filter((item) => item.nextRun)
      .sort((a, b) => {
        const dateA = new Date(a.nextRun || 0).getTime();
        const dateB = new Date(b.nextRun || 0).getTime();
        return dateA - dateB;
      });
    return sorted[0] || null;
  }, [reportSchedules]);

  const ruleDeltaLabel = useMemo(() => {
    if (!ruleComparison) {
      return "";
    }
    const kpiLabel = `${ruleComparison.kpi >= 0 ? "+" : ""}${formatDecimal(ruleComparison.kpi || 0)} điểm`;
    const declLabel = `${ruleComparison.decls >= 0 ? "+" : ""}${formatInt(ruleComparison.decls || 0)} tờ khai`;
    return `${kpiLabel} • ${declLabel}`;
  }, [ruleComparison]);

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
  const ruleTitle = selectedRuleMeta?.name || report.rules?.name || "Chưa đặt tên";
  const ruleApply = selectedRuleMeta?.applyFrom
    ? `Áp dụng từ ${selectedRuleMeta.applyFrom}`
    : report.rules?.applyFrom
    ? `Áp dụng từ ${report.rules.applyFrom}`
    : "Áp dụng ngay";

  const adjustmentsReport = useMemo(() => {
    const base = report.adjustments || {};
    const totalsRaw = base.totalsByCategory || base.totals || {};
    const normalizeTotals = (entry) => ({
      points: Number(entry?.points || 0),
      quantity: Number(entry?.quantity || 0),
    });
    const totalsByCategory = Object.keys(totalsRaw).reduce((acc, key) => {
      acc[key] = normalizeTotals(totalsRaw[key]);
      return acc;
    }, {});
    return {
      list: Array.isArray(base.list) ? base.list : [],
      applied: Array.isArray(base.applied) ? base.applied : [],
      totalPoints: Number(base.totalPoints || 0),
      pendingCount: Number(base.pendingCount || 0),
      approvedCount: Number(base.approvedCount || 0),
      rejectedCount: Number(base.rejectedCount || 0),
      appliedCount: Number(base.appliedCount || 0),
      totalsByCategory,
    };
  }, [report.adjustments]);

  const appliedAdjustments = adjustmentsReport.applied;
  const totalAdjustmentPages = Math.max(
    1,
    Math.ceil(appliedAdjustments.length / Math.max(adjustmentPageSize, 1))
  );
  const currentAdjustmentPage = Math.min(adjustmentPage, totalAdjustmentPages - 1);
  const paginatedAppliedAdjustments = useMemo(() => {
    const start = currentAdjustmentPage * adjustmentPageSize;
    return appliedAdjustments.slice(start, start + adjustmentPageSize);
  }, [appliedAdjustments, currentAdjustmentPage, adjustmentPageSize]);

  useEffect(() => {
    setAdjustmentPage(0);
  }, [adjustmentPageSize, appliedAdjustments.length]);
  const pendingAdjustments = useMemo(
    () => adjustmentsReport.list.filter((item) => item?.status === "pending"),
    [adjustmentsReport.list]
  );
  const rejectedAdjustments = useMemo(
    () => adjustmentsReport.list.filter((item) => item?.status === "rejected"),
    [adjustmentsReport.list]
  );
  const adjustmentTotals = useMemo(
    () => toAdjustmentTotalsArray(adjustmentsReport.totalsByCategory || {}),
    [adjustmentsReport.totalsByCategory]
  );
  const adjustmentStatusStats = useMemo(
    () => [
      { label: "Đã duyệt", value: Number(adjustmentsReport.approvedCount || 0), tone: "text-emerald-600" },
      { label: "Chờ duyệt", value: Number(adjustmentsReport.pendingCount || 0), tone: "text-amber-600" },
      { label: "Đã từ chối", value: Number(adjustmentsReport.rejectedCount || 0), tone: "text-rose-500" },
    ],
    [adjustmentsReport.approvedCount, adjustmentsReport.pendingCount, adjustmentsReport.rejectedCount]
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

  const chartPalette = useChartPalette();

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

  const filteredStaffList = sortedStaffList;
  const filteredTeamList = sortedTeamList;
  const filteredCompanySummaryStaff = companySummaryAllStaff;
  const filteredCompanySummaryTeam = companySummaryAllTeams;

  useEffect(() => {
    if (selectedStaff !== "all" || staffViewMode !== "detail") {
      if (staffDetailPage !== 0) {
        setStaffDetailPage(0);
      }
      return;
    }
    const totalPages = Math.max(1, Math.ceil(filteredStaffList.length / detailPageSize)) || 1;
    if (staffDetailPage > totalPages - 1) {
      setStaffDetailPage(totalPages - 1);
    }
  }, [
    selectedStaff,
    staffViewMode,
    filteredStaffList.length,
    detailPageSize,
    staffDetailPage,
  ]);

  useEffect(() => {
    if (selectedTeam !== "all" || teamViewMode !== "detail") {
      if (teamDetailPage !== 0) {
        setTeamDetailPage(0);
      }
      return;
    }
    const totalPages = Math.max(1, Math.ceil(filteredTeamList.length / detailPageSize)) || 1;
    if (teamDetailPage > totalPages - 1) {
      setTeamDetailPage(totalPages - 1);
    }
  }, [
    selectedTeam,
    teamViewMode,
    filteredTeamList.length,
    detailPageSize,
    teamDetailPage,
  ]);

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

  const handleDetailPageSizeChange = (event) => {
    const value = sanitizeDetailPageSize(event?.target?.value);
    setDetailPageSize(value);
    setStaffDetailPage(0);
    setTeamDetailPage(0);
  };

  const handleScheduleFieldChange = (field, value) => {
    setScheduleDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggleScheduleFormat = (format) => {
    setScheduleDraft((prev) => {
      const current = Array.isArray(prev.formats) ? [...prev.formats] : [];
      const index = current.indexOf(format);
      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(format);
      }
      if (!current.length) {
        current.push(format);
      }
      return { ...prev, formats: current };
    });
  };

  const handleEditSchedule = (schedule) => {
    setEditingScheduleId(schedule?.id || "");
    setScheduleDraft(createScheduleDraft(schedule));
  };

  const handleResetScheduleForm = () => {
    setEditingScheduleId("");
    setScheduleDraft(createScheduleDraft());
  };

  const handleSaveSchedule = (event) => {
    event?.preventDefault?.();
    const payload = toSchedulePayload({ ...scheduleDraft, id: editingScheduleId });
    if (!payload.name || !payload.name.trim()) {
      toast.warning?.("Đặt tên cho lịch gửi báo cáo để dễ quản lý.");
      return;
    }
    if (!String(payload.recipients || "").trim()) {
      toast.warning?.("Nhập danh sách email nhận báo cáo (ngăn cách bởi dấu phẩy hoặc xuống dòng).");
      return;
    }
    try {
      const saved = saveReportSchedule(payload, { actor: "ui.report" });
      setReportSchedules(getReportSchedules());
      setEditingScheduleId(saved.id);
      setScheduleDraft(createScheduleDraft(saved));
      toast.success?.("Đã lưu lịch gửi báo cáo KPI.");
    } catch (error) {
      console.error(error);
      toast.error?.(error?.message || "Không thể lưu lịch gửi báo cáo.");
    }
  };

  const handleDeleteSchedule = (schedule) => {
    if (!schedule?.id) return;
    const confirmed = window.confirm(
      `Xoá lịch gửi "${schedule.name || "Báo cáo KPI"}"?`
    );
    if (!confirmed) {
      return;
    }
    const ok = deleteReportSchedule(schedule.id, { actor: "ui.report" });
    if (ok) {
      setReportSchedules(getReportSchedules());
      if (editingScheduleId === schedule.id) {
        handleResetScheduleForm();
      }
      toast.success?.("Đã xoá lịch gửi báo cáo.");
    } else {
      toast.error?.("Không thể xoá lịch gửi báo cáo đã chọn.");
    }
  };

  const goToAdjustmentPage = (target) => {
    setAdjustmentPage((prev) => {
      const desired = Number.isFinite(Number(target)) ? Number(target) : prev;
      if (!Number.isFinite(desired)) {
        return 0;
      }
      return Math.min(Math.max(desired, 0), totalAdjustmentPages - 1);
    });
  };

  const handleAdjustmentPrev = () => {
    goToAdjustmentPage(currentAdjustmentPage - 1);
  };

  const handleAdjustmentNext = () => {
    goToAdjustmentPage(currentAdjustmentPage + 1);
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
        columns: exportColumns,
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
        columns: exportColumns,
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
        columns: exportColumns,
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
        columns: exportColumns,
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
      const totalStaffRows = filteredStaffList.length;
      const staffSliceStart = staffDetailPage * detailPageSize;
      const staffPageItems = filteredStaffList.slice(
        staffSliceStart,
        staffSliceStart + detailPageSize
      );
      const staffPageStart = totalStaffRows === 0 ? 0 : staffSliceStart + 1;
      const staffPageEnd =
        totalStaffRows === 0
          ? 0
          : Math.min(totalStaffRows, staffSliceStart + staffPageItems.length);
      const staffDetailColumnCount =
        6 +
        (columnVisibility.items !== false ? 1 : 0) +
        (columnVisibility.licenses !== false ? 1 : 0) +
        (columnVisibility.co !== false ? 1 : 0) +
        (columnVisibility.coLines !== false ? 1 : 0) +
        (columnVisibility.licenseCodes !== false ? 1 : 0);
      const totalStaffPages = totalStaffRows === 0 ? 1 : Math.ceil(totalStaffRows / detailPageSize);
      const isFirstStaffPage = staffDetailPage === 0;
      const isLastStaffPage = staffDetailPage >= totalStaffPages - 1;
      const staffRangeLabel = totalStaffRows
        ? `${formatInt(staffPageStart)}–${formatInt(staffPageEnd)} / ${formatInt(totalStaffRows)}`
        : "0 / 0";

      return (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-[color:var(--ds-surface-muted)] px-2 py-1">
              <button
                type="button"
                onClick={() => setStaffViewMode("summary")}
                className={getSegmentedButtonClass(staffViewMode === "summary")}
              >
                Tổng quan
              </button>
              <button
                type="button"
                onClick={() => setStaffViewMode("detail")}
                className={getSegmentedButtonClass(staffViewMode === "detail")}
              >
                Chi tiết
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--ds-text-secondary)]">
              <span className="font-semibold text-[color:var(--ds-text-primary)]">Sắp xếp theo:</span>
              <div className="flex items-center gap-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStaffSortKey(option.value)}
                    className={getSegmentedButtonClass(staffSortKey === option.value)}
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
                className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                  canExport && !exporting
                    ? 'border-[color:var(--ds-border-strong)] bg-[color:var(--ds-surface-primary)] text-white hover:bg-[color:var(--ds-surface-strong)]'
                    : 'cursor-not-allowed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-disabled)]'
                }`}
              >
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
              <span className="text-[11px] text-[color:var(--ds-text-muted)]">Nhấn Ctrl+P để in nhanh toàn trang</span>
            </div>
          </div>

          {staffViewMode === "summary" ? (
            <CompanySummaryTable
              rows={filteredCompanySummaryStaff}
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
                    {totalStaffRows ? (
                      staffPageItems.map((item, idx) => (
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
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={staffDetailColumnCount}
                          className="px-3 py-4 text-center text-sm text-[color:var(--ds-text-muted)]"
                        >
                          Không có nhân viên phù hợp với điều kiện lọc hiện tại.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalStaffRows ? (
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[color:var(--ds-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <span>Hiển thị</span>
                    <select
                      value={detailPageSize}
                      onChange={handleDetailPageSizeChange}
                      className="rounded border px-2 py-1 text-xs text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                    >
                      {DETAIL_PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <span>dòng/trang</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{staffRangeLabel}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setStaffDetailPage((prev) => Math.max(prev - 1, 0))}
                        disabled={isFirstStaffPage}
                        className={`rounded border px-2 py-1 font-semibold transition-colors ${
                          isFirstStaffPage
                            ? 'cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]'
                            : 'border-[color:var(--ds-border-strong)] text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]'
                        }`}
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setStaffDetailPage((prev) =>
                            Math.min(prev + 1, totalStaffPages - 1)
                          )
                        }
                        disabled={isLastStaffPage}
                        className={`rounded border px-2 py-1 font-semibold transition-colors ${
                          isLastStaffPage
                            ? 'cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]'
                            : 'border-[color:var(--ds-border-strong)] text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]'
                        }`}
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {totalStaffRows ? (
                <div className="space-y-6">
                  {staffPageItems.map((item) => (
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
              ) : (
                <div className="rounded border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-center text-sm text-[color:var(--ds-text-secondary)]">
                  Không có nhân viên nào khớp tìm kiếm.
                </div>
              )}
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
      const totalTeamRows = filteredTeamList.length;
      const teamSliceStart = teamDetailPage * detailPageSize;
      const teamPageItems = filteredTeamList.slice(teamSliceStart, teamSliceStart + detailPageSize);
      const teamPageStart = totalTeamRows === 0 ? 0 : teamSliceStart + 1;
      const teamPageEnd =
        totalTeamRows === 0 ? 0 : Math.min(totalTeamRows, teamSliceStart + teamPageItems.length);
      const teamDetailColumnCount =
        5 +
        (columnVisibility.items !== false ? 1 : 0) +
        (columnVisibility.licenses !== false ? 1 : 0) +
        (columnVisibility.co !== false ? 1 : 0) +
        (columnVisibility.coLines !== false ? 1 : 0) +
        (columnVisibility.licenseCodes !== false ? 1 : 0);
      const totalTeamPages = totalTeamRows === 0 ? 1 : Math.ceil(totalTeamRows / detailPageSize);
      const isFirstTeamPage = teamDetailPage === 0;
      const isLastTeamPage = teamDetailPage >= totalTeamPages - 1;
      const teamRangeLabel = totalTeamRows
        ? `${formatInt(teamPageStart)}–${formatInt(teamPageEnd)} / ${formatInt(totalTeamRows)}`
        : "0 / 0";

      return (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-[color:var(--ds-surface-muted)] px-2 py-1">
              <button
                type="button"
                onClick={() => setTeamViewMode("summary")}
                className={getSegmentedButtonClass(teamViewMode === "summary")}
              >
                Tổng quan
              </button>
              <button
                type="button"
                onClick={() => setTeamViewMode("detail")}
                className={getSegmentedButtonClass(teamViewMode === "detail")}
              >
                Chi tiết
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--ds-text-secondary)]">
              <span className="font-semibold text-[color:var(--ds-text-primary)]">Sắp xếp theo:</span>
              <div className="flex items-center gap-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTeamSortKey(option.value)}
                    className={getSegmentedButtonClass(teamSortKey === option.value)}
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
                className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                  canExport && !exporting
                    ? 'border-[color:var(--ds-border-strong)] bg-[color:var(--ds-surface-primary)] text-white hover:bg-[color:var(--ds-surface-strong)]'
                    : 'cursor-not-allowed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-disabled)]'
                }`}
              >
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
              <span className="text-[11px] text-[color:var(--ds-text-muted)]">Nhấn Ctrl+P để in nhanh toàn trang</span>
            </div>
          </div>

          {teamViewMode === "summary" ? (
            <CompanySummaryTable
              rows={filteredCompanySummaryTeam}
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
                    {totalTeamRows ? (
                      teamPageItems.map((item, idx) => (
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
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={teamDetailColumnCount}
                          className="px-3 py-4 text-center text-sm text-[color:var(--ds-text-muted)]"
                        >
                          Không có tổ đội nào phù hợp với điều kiện lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalTeamRows ? (
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[color:var(--ds-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <span>Hiển thị</span>
                    <select
                      value={detailPageSize}
                      onChange={handleDetailPageSizeChange}
                      className="rounded border px-2 py-1 text-xs text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                    >
                      {DETAIL_PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <span>dòng/trang</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{teamRangeLabel}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTeamDetailPage((prev) => Math.max(prev - 1, 0))}
                        disabled={isFirstTeamPage}
                        className={`rounded border px-2 py-1 font-semibold transition-colors ${
                          isFirstTeamPage
                            ? 'cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]'
                            : 'border-[color:var(--ds-border-strong)] text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]'
                        }`}
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTeamDetailPage((prev) => Math.min(prev + 1, totalTeamPages - 1))
                        }
                        disabled={isLastTeamPage}
                        className={`rounded border px-2 py-1 font-semibold transition-colors ${
                          isLastTeamPage
                            ? 'cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]'
                            : 'border-[color:var(--ds-border-strong)] text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]'
                        }`}
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {totalTeamRows ? (
                <div className="space-y-6">
                  {teamPageItems.map((item) => (
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
              ) : (
                <div className="rounded border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-center text-sm text-[color:var(--ds-text-secondary)]">
                  Không có tổ đội nào khớp tìm kiếm.
                </div>
              )}
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
      <div className="ds-card space-y-4 p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Khoảng thời gian</label>
            <select
              className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
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
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Từ ngày</label>
            <input
              type="date"
              className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setQuickRange("custom");
              }}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-[color:var(--ds-text-primary)]">Đến ngày</label>
            <input
              type="date"
              className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setQuickRange("custom");
              }}
            />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setVersion((v) => v + 1)}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-gray-50"
            >
              Tải lại dữ liệu
            </button>
            <button
              type="button"
              onClick={handleSeedSamples}
              className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 shadow-sm transition hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200"
            >
              Sinh dữ liệu mẫu (100 dòng)
            </button>
          </div>
        </div>


        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-2 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-3">
            <label
              htmlFor="report-rule-select"
              className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]"
            >
              Bộ quy tắc KPI
            </label>
            <select
              id="report-rule-select"
              value={selectedRuleId}
              onChange={(event) => setSelectedRuleId(event.target.value)}
              className="w-full rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
            >
              {ruleOptions.length ? (
                ruleOptions.map((option) => (
                  <option key={option.value || "__default"} value={option.value}>
                    {option.label}
                  </option>
                ))
              ) : (
                <option value="">Chưa có bộ quy tắc</option>
              )}
            </select>
            <div className="text-xs text-[color:var(--ds-text-secondary)]">
              Phiên bản: {selectedRuleMeta?.version != null ? `v${selectedRuleMeta.version}` : "—"}
            </div>
            {ruleComparison ? (
              <div className="rounded-lg border border-dashed border-emerald-400 bg-emerald-500/10 p-2 text-xs text-emerald-700">
                Chênh lệch so với bộ đang áp dụng: {ruleDeltaLabel}
              </div>
            ) : (
              <div className="text-xs text-[color:var(--ds-text-secondary)]">
                {ruleCollection?.activeId === (selectedRuleMeta?.id || "")
                  ? "Đang xem đúng bộ quy tắc đang áp dụng."
                  : `Bộ đang áp dụng: ${activeRule?.name || "—"}`}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-3 text-sm text-[color:var(--ds-text-secondary)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase text-[color:var(--ds-text-muted)]">Thông tin báo cáo</span>
              {nextScheduleRun ? (
                <span className="text-xs font-medium text-emerald-600">
                  Lịch gửi tiếp theo: {formatScheduleNextRunLabel(nextScheduleRun.nextRun)}
                </span>
              ) : (
                <span className="text-xs text-[color:var(--ds-text-muted)]">Chưa thiết lập lịch gửi</span>
              )}
            </div>
            <div className="mt-2 text-base font-semibold text-[color:var(--ds-text-primary)]">
              {formatInt(summary.decls)} tờ khai hợp lệ
            </div>
            <div className="mt-1 text-xs text-[color:var(--ds-text-secondary)]">
              Khoảng: {report.range.from || "…"} → {report.range.to || "…"}
            </div>
            <div className="mt-1 text-xs text-[color:var(--ds-text-secondary)]">{ruleApply}</div>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="ds-card space-y-4 p-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[color:var(--ds-text-primary)]">
                Lập lịch gửi báo cáo KPI
              </h3>
              <p className="text-sm text-[color:var(--ds-text-secondary)]">
                Thiết lập gửi tự động file Excel/PDF theo tuần hoặc tháng tới danh sách email mong muốn.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[color:var(--ds-text-muted)]">
              <span>
                {nextScheduleRun
                  ? `Lịch sắp chạy: ${formatScheduleNextRunLabel(nextScheduleRun.nextRun)}`
                  : "Chưa có lịch chạy tự động"}
              </span>
              <button
                type="button"
                onClick={() => setScheduleCollapsed((value) => !value)}
                className="inline-flex items-center gap-1 rounded border border-[color:var(--ds-border-subtle)] px-2 py-1 font-semibold text-[color:var(--ds-text-secondary)] transition-colors hover:border-[color:var(--ds-border-strong)] hover:text-[color:var(--ds-text-primary)]"
              >
                {scheduleCollapsed ? "Mở rộng" : "Thu gọn"}
              </button>
            </div>
          </div>

          {!scheduleCollapsed ? (
            <>
              <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSaveSchedule}>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]" htmlFor="schedule-name">
                    Tên lịch gửi
                  </label>
                  <input
                    id="schedule-name"
                    type="text"
                    value={scheduleDraft.name}
                    onChange={(event) => handleScheduleFieldChange("name", event.target.value)}
                    placeholder="Báo cáo KPI tuần"
                    className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]" htmlFor="schedule-recipients">
                    Email nhận (phân tách bằng dấu phẩy)
                  </label>
                  <textarea
                    id="schedule-recipients"
                    rows={2}
                    value={scheduleDraft.recipientsInput}
                    onChange={(event) => handleScheduleFieldChange("recipientsInput", event.target.value)}
                    placeholder="ceo@company.vn, kpi@company.vn"
                    className="min-h-[60px] rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]" htmlFor="schedule-frequency">
                    Chu kỳ gửi
                  </label>
                  <select
                    id="schedule-frequency"
                    value={scheduleDraft.frequency}
                    onChange={(event) => handleScheduleFieldChange("frequency", event.target.value)}
                    className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                  >
                    {SCHEDULE_FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {scheduleDraft.frequency === "weekly" ? (
                    <select
                      value={scheduleDraft.dayOfWeek}
                      onChange={(event) => handleScheduleFieldChange("dayOfWeek", Number(event.target.value))}
                      className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                    >
                      {WEEKDAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={scheduleDraft.dayOfMonth}
                        onChange={(event) => handleScheduleFieldChange("dayOfMonth", Number(event.target.value))}
                        className="w-20 rounded border border-[color:var(--ds-border-subtle)] bg-white px-2 py-2 text-sm text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                      />
                      <span className="text-xs text-[color:var(--ds-text-secondary)]">Ngày trong tháng</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]" htmlFor="schedule-time">
                    Thời gian gửi
                  </label>
                  <input
                    id="schedule-time"
                    type="time"
                    value={scheduleDraft.time}
                    onChange={(event) => handleScheduleFieldChange("time", event.target.value)}
                    className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[color:var(--ds-text-secondary)]">
                    {SCHEDULE_FORMAT_OPTIONS.map((option) => {
                      const checked = Array.isArray(scheduleDraft.formats)
                        ? scheduleDraft.formats.includes(option.value)
                        : option.value === "excel";
                      return (
                        <label key={option.value} className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleScheduleFormat(option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <label className="mt-1 inline-flex items-center gap-2 text-xs text-[color:var(--ds-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={Boolean(scheduleDraft.active)}
                      onChange={(event) => handleScheduleFieldChange("active", event.target.checked)}
                    />
                    Kích hoạt lịch gửi này
                  </label>
                </div>
                <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-end gap-2 pt-2">
                  {editingScheduleId ? (
                    <button
                      type="button"
                      onClick={handleResetScheduleForm}
                      className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-2 text-sm font-semibold text-[color:var(--ds-text-secondary)] transition-colors hover:border-[color:var(--ds-border-strong)]"
                    >
                      Huỷ chỉnh sửa
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="rounded bg-[color:var(--ds-surface-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color:var(--ds-surface-strong)]"
                  >
                    {editingScheduleId ? "Cập nhật lịch gửi" : "Thêm lịch gửi"}
                  </button>
                </div>
              </form>

              <div className="border-t border-[color:var(--ds-border-subtle)] pt-4">
                {reportSchedules.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {reportSchedules.map((schedule) => {
                      const nextLabel = formatScheduleNextRunLabel(
                        schedule.nextRun || calculateNextReportScheduleRun(schedule) || ""
                      );
                      const formatLabel = Array.isArray(schedule.formats)
                        ? schedule.formats.map((item) => item.toUpperCase()).join(", ")
                        : "EXCEL";
                      return (
                        <div
                          key={schedule.id}
                          className="rounded-lg border border-[color:var(--ds-border-subtle)] bg-white p-3 text-sm text-[color:var(--ds-text-secondary)] shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                                {schedule.name || "Lịch gửi"}
                              </div>
                              <div className="text-xs text-[color:var(--ds-text-muted)]">
                                {describeScheduleFrequency(schedule)}
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                schedule.active
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                            >
                              {schedule.active ? 'Đang bật' : 'Tạm tắt'}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-[color:var(--ds-text-secondary)]">
                            <div>Lần tiếp theo: {nextLabel}</div>
                            <div>Định dạng: {formatLabel}</div>
                            <div>Email: {(schedule.recipients || []).join(", ") || '—'}</div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditSchedule(schedule)}
                              className="rounded border border-[color:var(--ds-border-subtle)] px-2 py-1 text-xs font-semibold text-[color:var(--ds-text-secondary)] transition-colors hover:border-[color:var(--ds-border-strong)]"
                            >
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSchedule(schedule)}
                              className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 transition-colors hover:border-rose-400 hover:text-rose-700"
                            >
                              Xoá
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--ds-text-muted)]">
                    Chưa có lịch gửi báo cáo. Hãy thêm mới để tự động gửi KPI cho lãnh đạo.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
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

          <TrendLineChart data={trendSeries} comparison={trendComparison} palette={chartPalette} />
          <TeamPieWidget kpiData={teamPieData} declData={teamDeclPieData} palette={chartPalette} />
        </div>

        <div className="space-y-6">
          <TopStaffWidget
            metric={topStaffMetric}
            onMetricChange={setTopStaffMetric}
            kpiData={topStaffByKpi}
            declData={topStaffByDecls}
            palette={chartPalette}
          />
        </div>

        <div className="xl:col-span-2">
          <div className="ds-card space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[color:var(--ds-text-primary)]">Điểm KPI +/- bổ sung</h3>
                <p className="mt-1 text-sm text-[color:var(--ds-text-muted)]">
                  Điểm cộng/trừ được duyệt sẽ được cộng trực tiếp vào KPI tháng tương ứng trong báo cáo.
                </p>
              </div>
              <div className="text-sm text-right text-[color:var(--ds-text-secondary)]">
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
                <h4 className="mb-3 text-sm font-semibold text-[color:var(--ds-text-primary)]">Chi tiết điểm đã áp dụng</h4>
                <div className="overflow-auto rounded border border-[color:var(--ds-border-subtle)]">
                  <table className="min-w-full text-sm text-[color:var(--ds-text-primary)]">
                    <thead className="bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-secondary)]">
                      <tr className="text-left text-xs uppercase">
                        <th className="px-3 py-2">Tháng</th>
                        <th className="px-3 py-2">Hạng mục</th>
                        <th className="px-3 py-2">Nhân viên</th>
                        <th className="px-3 py-2">Tổ đội</th>
                        <th className="px-3 py-2 text-right">Số lượng × Hệ số</th>
                        <th className="px-3 py-2 text-right">Điểm</th>
                        <th className="px-3 py-2">Tham chiếu</th>
                        <th className="px-3 py-2">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAppliedAdjustments.length ? (
                        paginatedAppliedAdjustments.map((item) => {
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
                            <tr key={key} className="border-b border-[color:var(--ds-border-subtle)] odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)] last:border-b-0">
                              <td className="px-3 py-2">{item.displayDate || (item.date ? item.date.slice(0, 7) : '—')}</td>
                              <td className="px-3 py-2">{item.adjustment?.label || item.loai_hinh}</td>
                              <td className="px-3 py-2">{item.nhan_vien || 'Chưa gán'}</td>
                              <td className="px-3 py-2">{item.team || 'Chưa gán tổ đội'}</td>
                              <td className="px-3 py-2 text-right">
                                {quantity !== null ? formatDecimal(quantity) : '—'}
                                {unitPoints !== null ? (
                                  <span className="ml-1 text-xs text-[color:var(--ds-text-muted)]">× {formatDecimal(unitPoints)}</span>
                                ) : null}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${scoreClass}`}>
                                {formatDecimal(item.kpi)}
                              </td>
                              <td className="px-3 py-2">{references || '—'}</td>
                              <td className="px-3 py-2">{note || '—'}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-3 py-4 text-center text-[color:var(--ds-text-muted)]" colSpan={8}>
                            Chưa có điểm bổ sung nào được duyệt trong khoảng thời gian này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--ds-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <label className="text-[color:var(--ds-text-muted)]" htmlFor="adjustment-page-size">
                      Số mục mỗi trang
                    </label>
                    <select
                      id="adjustment-page-size"
                      value={adjustmentPageSize}
                      onChange={(event) =>
                        setAdjustmentPageSize(sanitizeAdjustmentPageSize(event.target.value))
                      }
                      className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-2 py-1 text-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                    >
                      {ADJUSTMENT_PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>
                      Trang {totalAdjustmentPages ? currentAdjustmentPage + 1 : 0}/{totalAdjustmentPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAdjustmentPrev}
                        disabled={currentAdjustmentPage === 0}
                        className={`rounded border px-2 py-1 font-semibold transition-colors ${
                          currentAdjustmentPage === 0
                            ? 'cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]'
                            : 'border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-secondary)] hover:border-[color:var(--ds-border-strong)] hover:text-[color:var(--ds-text-primary)]'
                        }`}
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        onClick={handleAdjustmentNext}
                        disabled={currentAdjustmentPage >= totalAdjustmentPages - 1}
                        className={`rounded border px-2 py-1 font-semibold transition-colors ${
                          currentAdjustmentPage >= totalAdjustmentPages - 1
                            ? 'cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]'
                            : 'border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-secondary)] hover:border-[color:var(--ds-border-strong)] hover:text-[color:var(--ds-text-primary)]'
                        }`}
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <section className="space-y-3 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4">
                  <div className="text-xs uppercase tracking-wide text-[color:var(--ds-text-secondary)]">Điểm đã áp dụng</div>
                  <div className="text-3xl font-semibold text-emerald-600">
                    {formatDecimal(adjustmentsReport.totalPoints || 0)}
                  </div>
                  <div className="text-xs text-[color:var(--ds-text-secondary)]">
                    Từ {formatInt(adjustmentsReport.approvedCount || adjustmentsReport.appliedCount || 0)} lượt xử lý thành công
                  </div>
                  <ul className="space-y-1 pt-2 text-sm text-[color:var(--ds-text-secondary)]">
                    {adjustmentStatusStats.map((item) => (
                      <li key={item.label} className="flex items-center justify-between">
                        <span>{item.label}</span>
                        <span className={`font-semibold ${item.tone}`}>{formatInt(item.value)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Phân bổ theo hạng mục</h4>
                  {adjustmentTotals.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
                      {adjustmentTotals.map((item) => {
                        const tone = ADJUSTMENT_CATEGORY_TONE_MAP[item.key] || "text-slate-600";
                        return (
                          <li
                            key={item.key}
                            className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium text-[color:var(--ds-text-primary)]">{item.label}</span>
                              <span className={`font-semibold ${tone}`}>{formatOptionalDecimal(item.points)}</span>
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--ds-text-muted)]">
                              Số lượt: <span className="font-semibold text-[color:var(--ds-text-primary)]">{formatOptionalInt(item.quantity)}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-[color:var(--ds-text-muted)]">Chưa có dữ liệu phân bổ.</p>
                  )}
                </section>

                <section className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Chờ duyệt</h4>
                    {pendingAdjustments.length ? (
                      <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
                        {pendingAdjustments.map((item) => (
                          <li key={item.id} className="rounded border border-dashed border-amber-400 bg-amber-500/10 px-3 py-2">
                            <div className="font-medium text-[color:var(--ds-text-primary)]">{item.label || item.category}</div>
                            <div>{item.staffName || 'Chưa gán'} — {item.month}</div>
                            <div>Điểm đề xuất: {formatDecimal(item.totalPoints || 0)}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[color:var(--ds-text-muted)]">Không có yêu cầu đang chờ.</p>
                    )}
                  </div>
                  {rejectedAdjustments.length ? (
                    <div>
                      <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Đã từ chối gần đây</h4>
                      <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
                        {rejectedAdjustments.slice(0, 3).map((item) => (
                          <li key={item.id} className="rounded border border-rose-400/60 bg-rose-500/10 px-3 py-2">
                            <div className="font-medium text-[color:var(--ds-text-primary)]">{item.label || item.category}</div>
                            <div>{item.staffName || 'Chưa gán'} — {item.month}</div>
                            <div>Điểm: {formatDecimal(item.totalPoints || 0)}</div>
                          </li>
                        ))}
                      </ul>
                      {rejectedAdjustments.length > 3 ? (
                        <div className="pt-1 text-xs text-[color:var(--ds-text-muted)]">
                          Còn {rejectedAdjustments.length - 3} mục khác đã bị từ chối.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ds-card space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <div className="font-semibold text-gray-900">Chế độ xem</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScope("staff")}
              className={`rounded px-3 py-1.5 ${
                scope === "staff"
                  ? "bg-[color:var(--ds-text-primary)] text-[color:var(--ds-text-inverse)]"
                  : "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
              }`}
            >
              Nhân viên
            </button>
            <button
              type="button"
              onClick={() => setScope("team")}
              className={`rounded px-3 py-1.5 ${
                scope === "team"
                  ? "bg-[color:var(--ds-text-primary)] text-[color:var(--ds-text-inverse)]"
                  : "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
              }`}
            >
              Tổ đội
            </button>
          </div>

          {scope === "staff" ? (
            <select
              className="ml-auto rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
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
              className="ml-auto rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
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

      <div className="ds-card ds-card--flat space-y-2 p-4 text-sm text-gray-600">
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
