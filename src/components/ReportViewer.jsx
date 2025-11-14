import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import useRenderMetrics from "@/hooks/useRenderMetrics.js";

import "../print.css";

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
  getReportTemplates,
  saveReportTemplate,
  deleteReportTemplate,
  KPI_REPORT_TEMPLATES_KEY,
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

import ReportFilterBar from "@/components/report-viewer/ReportFilterBar.jsx";
import ReportContextToolbar from "@/components/report-viewer/ReportContextToolbar.jsx";
import KpiAdjustmentPanel from "@/components/report-viewer/KpiAdjustmentPanel.jsx";
import ReportEntityTable from "@/components/report-viewer/ReportEntityTable.jsx";
import {
  DEFAULT_DETAIL_PAGE_SIZE,
  DETAIL_PAGE_SIZE_OPTIONS,
  getSegmentedButtonClass,
  sortStatsCollection,
} from "@/components/report-viewer/detailShared.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";
import {
  formatDecimal,
  formatInt,
  formatOptionalDecimal,
  formatOptionalInt,
} from "@/components/report-viewer/formatters.js";

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

  PieChart,

  Pie,

} from "recharts";

import { useChartPalette } from "@/designSystem/hooks.js";
import { SlidersHorizontal } from "lucide-react";

import { toast } from "@/shared/toast.js";



let reportExporterPromise;

const StaffDetailCard = React.lazy(() => import("@/components/report-viewer/StaffDetailCard.jsx"));

const TeamDetailCard = React.lazy(() => import("@/components/report-viewer/TeamDetailCard.jsx"));

function loadReportExporterModule() {

  if (!reportExporterPromise) {

    reportExporterPromise = import("@/lib/reportExport.js");

  }

  return reportExporterPromise;

}
function formatPeriodLabel(periodKey) {

  if (typeof periodKey !== "string" || periodKey.length < 7) {

    return periodKey || "Không xác định";

  }

  const [year, month] = periodKey.split("-");

  if (!year || !month) {

    return periodKey;

  }

  return `${month}/${year}`;

}



const DEFAULT_CHART_COLORS = ["#2563eb", "#22c55e", "#f97316", "#a855f7", "#14b8a6"];



const METRIC_SORT_KEYS = ["kpi", "decls", "licenses"];



const ALERT_TONE_STYLES = {

  danger: {

    badge: "bg-rose-500/10 text-rose-600",

    title: "text-rose-600",

  },

  warning: {

    badge: "bg-amber-500/10 text-amber-600",

    title: "text-amber-600",

  },

  info: {

    badge: "bg-sky-500/10 text-sky-600",

    title: "text-sky-600",

  },

  success: {

    badge: "bg-emerald-500/10 text-emerald-600",

    title: "text-emerald-600",

  },

};



const SORT_OPTIONS = [

  { value: "kpi", label: "Điểm KPI" },

  { value: "decls", label: "Số tờ khai" },

  { value: "licenses", label: "Số giấy phép" },

];



const ADJUSTMENT_PAGE_SIZE_OPTIONS = [5, 10, 20];

const DEFAULT_ADJUSTMENT_PAGE_SIZE = 10;



const TOP_STAFF_VISIBLE_COUNT_OPTIONS = [5, 7, 8, 9, 10, 12, 15];

const TOP_STAFF_VISIBLE_COUNT_SET = new Set(TOP_STAFF_VISIBLE_COUNT_OPTIONS);

const TOP_COMPANY_VISIBLE_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

const TOP_COMPANY_VISIBLE_COUNT_SET = new Set(TOP_COMPANY_VISIBLE_COUNT_OPTIONS);



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



function sanitizeTopStaffVisibleCount(value) {

  if (value === "auto") {

    return "auto";

  }

  const num = Number(value);

  if (!Number.isFinite(num)) {

    return "auto";

  }

  const rounded = Math.round(num);

  return TOP_STAFF_VISIBLE_COUNT_SET.has(rounded) ? rounded : "auto";

}





function sanitizeTopCompanyVisibleCount(value) {

  if (value === "all") {

    return "all";

  }

  const num = Number(value);

  if (!Number.isFinite(num)) {

    return 10;

  }

  const rounded = Math.round(num);

  return TOP_COMPANY_VISIBLE_COUNT_SET.has(rounded) ? rounded : 10;

}

function sanitizeSelection(value) {

  if (typeof value !== "string") {

    return "all";

  }

  const normalized = value.trim();

  return normalized || "all";

}



function sanitizeTemplateId(value) {

  if (typeof value !== "string") {

    return "";

  }

  return value.trim();

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

  if (!Number.isFinite(num) || num <= 0) {

    return DEFAULT_DETAIL_PAGE_SIZE;

  }

  const normalized = Math.round(num);

  return Math.max(1, Math.min(normalized, 500));

}



function sanitizeRulePreference(value) {

  if (typeof value !== "string") {

    return "";

  }

  return value.trim();

}



function sanitizeTopCompanyPeriod(value) {

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



function normalizeTemplateConfig(config = {}) {

  const source = config && typeof config === "object" ? config : {};

  const quickRange = sanitizeQuickRange(source.quickRange);

  const from = typeof source.from === "string" ? source.from.trim() : "";

  const to = typeof source.to === "string" ? source.to.trim() : "";

  const scope = SCOPE_VALUES.has(source.scope) ? source.scope : "staff";

  const selectedStaff = sanitizeSelection(source.selectedStaff);

  const selectedTeam = sanitizeSelection(source.selectedTeam);

  const staffSortKey = sanitizeSortKey(source.staffSortKey);

  const teamSortKey = sanitizeSortKey(source.teamSortKey);

  const topStaffMetric = sanitizeTopStaffMetric(source.topStaffMetric);

  const topStaffVisibleCount = sanitizeTopStaffVisibleCount(source.topStaffVisibleCount);

  const columns = sanitizeColumnVisibility(source.columns);

  const ruleId = sanitizeRulePreference(source.ruleId);

  const detailPageSize = sanitizeDetailPageSize(source.detailPageSize);

  const adjustmentPageSize = sanitizeAdjustmentPageSize(source.adjustmentPageSize);

  const staffViewMode = source.staffViewMode === "detail" ? "detail" : "summary";

  const teamViewMode = source.teamViewMode === "detail" ? "detail" : "summary";

  const adjustmentExpanded = source.adjustmentExpanded === true;

  const topCompanyPeriod = sanitizeTopCompanyPeriod(source.topCompanyPeriod);

  return {

    quickRange,

    from,

    to,

    scope,

    selectedStaff,

    selectedTeam,

    staffSortKey,

    teamSortKey,

    topStaffMetric,

    topStaffVisibleCount,

    columns,

    ruleId,

    detailPageSize,

    adjustmentPageSize,

    staffViewMode,

    teamViewMode,

    adjustmentExpanded,

    topCompanyPeriod,

  };

}



function deriveColumnVisibilityState(columnsConfig) {

  const columns = sanitizeColumnVisibility(columnsConfig);

  return {

    items: columns.items === false ? false : true,

    licenses: columns.licenses === false ? false : true,

    co: columns.co === false ? false : true,

    coLines: columns.coLines === false ? false : true,

    licenseCodes: columns.licenseCodes === false ? false : true,

  };

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



const TOP_STAFF_LIMIT_BREAKPOINTS = [

  { minHeight: 1280, limit: 12 },

  { minHeight: 1100, limit: 11 },

  { minHeight: 980, limit: 10 },

  { minHeight: 900, limit: 9 },

  { minHeight: 820, limit: 8 },

  { minHeight: 740, limit: 7 },

];



function computeResponsiveTopStaffLimit(viewportHeight) {

  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {

    return 5;

  }



  for (const breakpoint of TOP_STAFF_LIMIT_BREAKPOINTS) {

    if (viewportHeight >= breakpoint.minHeight) {

      return breakpoint.limit;

    }

  }



  return 5;

}



function TopStaffWidget({

  metric = "kpi",

  onMetricChange,

  kpiData = [],

  declData = [],

  palette = DEFAULT_CHART_COLORS,

  visibleCountPreference = "auto",

  onVisibleCountPreferenceChange,

}) {

  const [autoVisibleCount, setAutoVisibleCount] = useState(() =>

    computeResponsiveTopStaffLimit(typeof window !== "undefined" ? window.innerHeight : Number.NaN)

  );



  useEffect(() => {

    if (typeof window === "undefined") {

      return undefined;

    }



    const handleResize = () => {

      const next = computeResponsiveTopStaffLimit(window.innerHeight);

      setAutoVisibleCount((prev) => (prev === next ? prev : next));

    };



    handleResize();

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);

  }, []);



  const resolvedPreference = useMemo(() => {

    if (visibleCountPreference === "auto") {

      return "auto";

    }

    const num = Number(visibleCountPreference);

    if (!Number.isFinite(num)) {

      return "auto";

    }

    return Math.max(1, Math.round(num));

  }, [visibleCountPreference]);



  const effectiveVisibleCount = resolvedPreference === "auto" ? autoVisibleCount : resolvedPreference;

  const visibleCount = Math.max(1, Number.isFinite(effectiveVisibleCount) ? effectiveVisibleCount : autoVisibleCount || 5);



  const displayedKpiData = useMemo(() => kpiData.slice(0, Math.max(visibleCount, 1)), [kpiData, visibleCount]);

  const displayedDeclData = useMemo(

    () => declData.slice(0, Math.max(visibleCount, 1)),

    [declData, visibleCount]

  );



  const hasKpiData = displayedKpiData.length > 0;

  const hasDeclData = displayedDeclData.length > 0;

  const hasData = metric === "kpi" ? hasKpiData : hasDeclData;



  const maxKPI = hasKpiData ? Math.max(...displayedKpiData.map((item) => item.stats.kpi || 0), 1) : 1;

  const totalDecls = hasDeclData

    ? displayedDeclData.reduce((sum, item) => sum + (item.decls || 0), 0)

    : 0;

  const colors = Array.isArray(palette) && palette.length ? palette : DEFAULT_CHART_COLORS;

  const totalKpiEntries = kpiData.length;

  const totalDeclEntries = declData.length;

  const totalEntries = metric === "kpi" ? totalKpiEntries : totalDeclEntries;

  const visibleEntries = metric === "kpi" ? displayedKpiData.length : displayedDeclData.length;



  const handleVisibleCountChange = (event) => {

    const value = event?.target?.value;

    if (value === "auto") {

      onVisibleCountPreferenceChange?.("auto");

      return;

    }

    const num = Number(value);

    if (!Number.isFinite(num)) {

      return;

    }

    const rounded = Math.round(num);

    if (!TOP_STAFF_VISIBLE_COUNT_SET.has(rounded)) {

      return;

    }

    onVisibleCountPreferenceChange?.(rounded);

  };



  const selectValue = resolvedPreference === "auto" ? "auto" : String(resolvedPreference);



  const preferenceDescription =

    resolvedPreference === "auto"

      ? "Tự động theo chiều cao màn hình"

      : `${resolvedPreference} nhân viên (cố định)`;



  const renderEmptyState = (

    <p className="mt-3 text-sm text-gray-500">Chưa có dữ liệu hợp lệ trong giai đoạn này.</p>

  );



  return (

    <section className="ds-card space-y-4 p-4">

      <div className="flex flex-wrap items-center justify-between gap-3">

        <h3 className="text-base font-semibold text-gray-900">

          Top nhân viên theo {metric === "kpi" ? "điểm KPI" : "số tờ khai"}

        </h3>

        <div className="flex flex-wrap items-center gap-3">

          <label className="flex items-center gap-2 text-xs text-gray-600">

            Hiển thị

            <select

              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

              value={selectValue}

              onChange={handleVisibleCountChange}

            >

              <option value="auto">Tự động</option>

              {TOP_STAFF_VISIBLE_COUNT_OPTIONS.map((option) => (

                <option key={option} value={option}>

                  {option} nhân viên

                </option>

              ))}

            </select>

          </label>

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

      </div>



      {!hasData ? (

        renderEmptyState

      ) : metric === "kpi" ? (

        <div className="mt-4 space-y-4">

          {displayedKpiData.map((item, idx) => {

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

        <div

          className="mt-4 w-full"

          style={{ height: Math.max(220, visibleEntries * 44) }}

        >

          <ResponsiveContainer width="100%" height="100%">

            <BarChart

              layout="vertical"

              data={displayedDeclData}

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

                {displayedDeclData.map((item, idx) => (

                  <Cell key={item.key || item.name || idx} fill={colors[idx % colors.length]} />

                ))}

                <LabelList dataKey="decls" position="right" formatter={(value) => formatInt(value)} />

              </Bar>

            </BarChart>

          </ResponsiveContainer>

        </div>

      )}



      <div className="mt-3 space-y-1 text-xs leading-relaxed">

        {metric !== "kpi" && hasDeclData ? (

          <p className="text-gray-500">Tổng: {formatInt(totalDecls)} tờ khai</p>

        ) : null}

        {totalEntries > visibleEntries ? (

          <p className="text-gray-400">

            Đang hiển thị {visibleEntries}/{totalEntries} nhân viên. {preferenceDescription}

          </p>

        ) : (

          <p className="text-gray-400">{preferenceDescription}</p>

        )}

      </div>

    </section>

  );

}



function TeamMetricPieCard({ title, data, valueFormatter, percentLabel, emptyMessage, palette = DEFAULT_CHART_COLORS }) {
  const normalizedData = Array.isArray(data)
    ? data.map((item = {}) => ({
        name: item.name || "Chưa gán tổ đội",
        value: Number(item.value || 0),
      }))
    : [];
  const total = normalizedData.reduce((sum, item) => sum + item.value, 0);
  const hasData = normalizedData.length > 0 && total > 0;
  const colors = Array.isArray(palette) && palette.length ? palette : DEFAULT_CHART_COLORS;
  const topEntry = hasData
    ? normalizedData.reduce((prev, current) => (current.value > prev.value ? current : prev), normalizedData[0])
    : null;
  const topPercent = topEntry && total > 0 ? (topEntry.value / total) * 100 : 0;
  return (
    <article className="space-y-4 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-white/95 p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">{title}</p>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            {hasData
              ? `${normalizedData.length} tổ đội • Tổng ${valueFormatter(total)} ${percentLabel}`
              : "Đang chờ dữ liệu từ các tổ đội"}
          </p>
        </div>
        {topEntry && hasData ? (
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--ds-text-muted)]">Tỷ trọng cao nhất</p>
            <p className="text-lg font-semibold text-[color:var(--ds-text-primary)]">{topPercent.toFixed(1)}%</p>
            <p className="text-xs text-[color:var(--ds-text-secondary)]">{topEntry.name}</p>
          </div>
        ) : null}
      </header>
      {hasData ? (
        <div className="space-y-5">
          <div className="mx-auto w-full max-w-[320px]">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={normalizedData}
                  dataKey="value"
                  nameKey="name"
                  startAngle={90}
                  endAngle={-270}
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={1}
                  stroke="var(--ds-card-bg, #fff)"
                >
                  {normalizedData.map((entry, idx) => (
                    <Cell key={`${title}-segment-${idx}`} fill={colors[idx % colors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {normalizedData.map((item, idx) => {
              const color = colors[idx % colors.length];
              const percent = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0;
              return (
                <div
                  key={`${title}-${item.name}-${idx}`}
                  className="flex flex-col gap-1 rounded-xl border border-[color:var(--ds-border-subtle)]/80 bg-white/80 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[color:var(--ds-text-primary)]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-medium">{item.name || "Chưa gán tổ đội"}</span>
                    </div>
                    <span className="text-xs text-[color:var(--ds-text-muted)]">{percent}%</span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-[color:var(--ds-text-secondary)]">
                    <span>{valueFormatter(item.value)}</span>
                    <span>{percentLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[color:var(--ds-border-subtle)]/80 bg-white/70 p-4 text-sm text-[color:var(--ds-text-muted)]">
          {emptyMessage}
        </div>
      )}
    </article>
  );
}



function TeamPieWidget({ kpiData, declData, palette = DEFAULT_CHART_COLORS, variant = "card" }) {
  const charts = (
    <div className="space-y-6">
      <TeamMetricPieCard
        title="Cơ cấu tổ đội KPI"
        data={kpiData}
        valueFormatter={formatDecimal}
        percentLabel="KPI"
        emptyMessage="Chưa có dữ liệu KPI cho các tổ đội."
        palette={palette}
      />
      <TeamMetricPieCard
        title="Cơ cấu tổ đội tờ khai"
        data={declData}
        valueFormatter={formatInt}
        percentLabel="tờ khai"
        emptyMessage="Chưa có dữ liệu tờ khai cho các tổ đội."
        palette={palette}
      />
    </div>
  );
  if (variant === "inline") {
    return charts;
  }
  return (
    <section className="ds-card space-y-6 p-4">
      {charts}
    </section>
  );
}


function TopCompanyLeaderboard({
  periods = [],
  selectedKey,
  onPeriodChange,
  visibleCount = 10,
  onVisibleCountChange,
  visibleCountOptions = TOP_COMPANY_VISIBLE_COUNT_OPTIONS,
}) {
  const hasData = Array.isArray(periods) && periods.length > 0;
  const activePeriod = hasData
    ? periods.find((item) => item.key === selectedKey) || periods[0]
    : null;
  const rows = Array.isArray(activePeriod?.topCompanies) ? activePeriod.topCompanies : [];
  const totalDecls = Number(activePeriod?.totalDecls || 0);
  const totalCompanies = rows.length;
  const normalizedVisible = visibleCount === 'all' ? totalCompanies : Number(visibleCount) || 10;
  const limit = visibleCount === 'all' ? totalCompanies : Math.max(1, Math.round(normalizedVisible));
  const displayRows = rows.slice(0, limit);
  const otherCompanyCount = Math.max(0, totalCompanies - displayRows.length);
  const activeKey = activePeriod?.key || '';
  const handlePeriodChange = (event) => {
    onPeriodChange?.(event?.target?.value || '');
  };
  const handleVisibleCountChange = (event) => {
    onVisibleCountChange?.(event?.target?.value || '');
  };
  return (
    <section className="ds-card space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[color:var(--ds-text-primary)]">
            Xếp hạng doanh nghiệp theo tờ khai
          </h3>
          {hasData ? (
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              {totalCompanies > 0
                ? `Đang hiển thị ${displayRows.length}/${totalCompanies} công ty`
                : 'Chưa có dữ liệu top doanh nghiệp cho kỳ này.'}
            </p>
          ) : (
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              Chưa có dữ liệu top doanh nghiệp cho kỳ này.
            </p>
          )}
        </div>
        {hasData ? (
          <div className="flex flex-wrap gap-3 text-sm text-[color:var(--ds-text-secondary)]">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-[color:var(--ds-text-muted)]">
                Kỳ dữ liệu
              </span>
              <select
                className="rounded border border-[color:var(--ds-border-subtle)] bg-white/80 px-3 py-1.5 text-sm font-medium text-[color:var(--ds-text-primary)] shadow-sm"
                value={activeKey}
                onChange={handlePeriodChange}
              >
                {periods.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label || item.key}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-[color:var(--ds-text-muted)]">
                Số công ty hiển thị
              </span>
              <select
                className="rounded border border-[color:var(--ds-border-subtle)] bg-white/80 px-3 py-1.5 text-sm font-medium text-[color:var(--ds-text-primary)] shadow-sm"
                value={String(visibleCount)}
                onChange={handleVisibleCountChange}
              >
                {visibleCountOptions.map((option) => (
                  <option key={option} value={String(option)}>
                    {option} công ty
                  </option>
                ))}
                <option value="all">Tất cả</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>
      {hasData ? (
        <>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            Dữ liệu được lấy từ tổng số tờ khai của từng doanh nghiệp trong kỳ. Bạn có thể mở rộng danh sách nếu màn hình còn đủ
            không gian.
          </p>
          <div className="max-h-[30rem] overflow-x-auto overflow-y-auto rounded-lg border border-[color:var(--ds-border-subtle)] bg-white/70 shadow-sm">
            <table className="min-w-full divide-y divide-[color:var(--ds-border-subtle)] text-sm">
              <thead className="bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-secondary)]">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Thứ hạng
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Doanh nghiệp
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Mã số thuế
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Số tờ khai
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Điểm KPI
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Thị phần
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--ds-border-subtle)] bg-white">
                {displayRows.length ? (
                  displayRows.map((row, index) => {
                    const sharePercent = totalDecls > 0 ? (Number(row.decls || 0) / totalDecls) * 100 : 0;
                    const widthPercent = Math.min(100, Math.max(0, sharePercent));
                    return (
                      <tr key={`${row.mst || row.cong_ty || 'company'}-${index}`} className="hover:bg-[color:var(--ds-surface-muted)]/60">
                        <td className="px-3 py-2 text-sm font-semibold text-[color:var(--ds-text-secondary)]">#{index + 1}</td>
                        <td className="px-3 py-2 font-medium text-[color:var(--ds-text-primary)]">{row.cong_ty || 'Chưa cập nhật'}</td>
                        <td className="px-3 py-2 text-[color:var(--ds-text-secondary)]">{row.mst || '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[color:var(--ds-text-primary)]">{formatInt(row.decls)}</td>
                        <td className="px-3 py-2 text-right text-[color:var(--ds-text-secondary)]">{formatDecimal(row.kpi)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-[color:var(--ds-border-subtle)]">
                              <div
                                className="h-2 rounded-full bg-[color:var(--ds-accent-strong)]"
                                style={{ width: `${widthPercent}%` }}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="w-12 text-right text-xs text-[color:var(--ds-text-secondary)]">{sharePercent.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-3 py-6 text-center text-sm text-[color:var(--ds-text-muted)]" colSpan={6}>
                      Không có dữ liệu top doanh nghiệp cho kỳ này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {otherCompanyCount > 0 ? (
            <div className="text-xs text-[color:var(--ds-text-muted)]">
              Còn {otherCompanyCount} công ty khác ngoài danh sách đang hiển thị.
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[color:var(--ds-border-subtle)] p-6 text-center text-sm text-[color:var(--ds-text-muted)]">
          Chưa có dữ liệu doanh nghiệp cho kỳ này.
        </div>
      )}
    </section>
  );
}


function KpiOverviewSection({
  summary,
  summaryCompanyCardValue,
  companyCardSubtitle,
  adjustmentsReport,
  overviewAlerts,
  trendSeries,
  trendComparison,
  teamPieData,
  teamDeclPieData,
  companyLeaderboard,
  topCompanyPeriod,
  topCompanyVisibleCount,
  onTopCompanyPeriodChange,
  onTopCompanyVisibleCountChange,
  topStaffMetric,
  onTopStaffMetricChange,
  topStaffByKpi,
  topStaffByDecls,
  topStaffVisibleCount,
  onTopStaffVisibleCountChange,
  palette,
  children,
}) {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-[color:var(--ds-text-primary)]">Tổng quan KPI</h2>
        <p className="text-sm text-[color:var(--ds-text-secondary)]">
          Theo dõi nhanh các chỉ số trọng yếu, xếp hạng doanh nghiệp và nhân sự nổi bật dựa trên khoảng thời gian đã lọc.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <KpiOverviewDashboard
            summary={summary}
            summaryCompanyCardValue={summaryCompanyCardValue}
            companyCardSubtitle={companyCardSubtitle}
            adjustmentsTotal={Number(adjustmentsReport.totalPoints || 0)}
            trendSeries={trendSeries}
            comparison={trendComparison}
            alerts={overviewAlerts}
            palette={palette}
            teamPieData={teamPieData}
            teamDeclPieData={teamDeclPieData}
          />
          {children}
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]">
              Xếp hạng nổi bật
            </h3>
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              So sánh nhân sự dẫn đầu và doanh nghiệp phát sinh tờ khai trong cùng bộ lọc.
            </p>
          </div>
          <TopStaffWidget
            metric={topStaffMetric}
            onMetricChange={onTopStaffMetricChange}
            kpiData={topStaffByKpi}
            declData={topStaffByDecls}
            visibleCount={topStaffVisibleCount}
            onVisibleCountPreferenceChange={onTopStaffVisibleCountChange}
            palette={palette}
          />
          <TopCompanyLeaderboard
            periods={companyLeaderboard}
            selectedKey={topCompanyPeriod}
            onPeriodChange={onTopCompanyPeriodChange}
            visibleCount={topCompanyVisibleCount}
            onVisibleCountChange={onTopCompanyVisibleCountChange}
            visibleCountOptions={TOP_COMPANY_VISIBLE_COUNT_OPTIONS}
          />
        </div>
      </div>
    </section>
  );
}


function KpiOverviewDashboard({
  summary = {},
  summaryCompanyCardValue = 0,
  companyCardSubtitle = '',
  adjustmentsTotal = 0,
  trendSeries = [],
  comparison = null,
  alerts = [],
  palette = DEFAULT_CHART_COLORS,
  teamPieData = [],
  teamDeclPieData = [],
}) {
  const totalKpi = Number(summary?.kpi || 0);
  const importDecls = Number(summary?.import || 0);
  const exportDecls = Number(summary?.export || 0);
  const adjustmentsValue = Number(adjustmentsTotal || 0);
  const alertEntries = Array.isArray(alerts) && alerts.length ? alerts : [];
  const summaryCards = [
    {
      title: 'Tổng tờ khai',
      value: formatInt(summary.decls),
      subtitle: `Nhập: ${formatInt(importDecls)} • Xuất: ${formatInt(exportDecls)}`,
    },
    {
      title: 'Tổng điểm KPI',
      value: formatDecimal(totalKpi),
      subtitle:
        comparison?.delta?.kpiPercent != null
          ? `So với kỳ trước ${comparison.delta.kpiPercent > 0 ? 'tăng' : 'giảm'} ${Math.abs(
              comparison.delta.kpiPercent
            ).toFixed(1)}%`
          : 'Bao gồm điểm loại hình & giấy phép',
    },
    {
      title: 'Điểm KPI +/- bổ sung',
      value: formatDecimal(adjustmentsValue),
      subtitle:
        adjustmentsValue === 0
          ? 'Chưa có điều chỉnh trong kỳ'
          : adjustmentsValue > 0
          ? `Đang cộng ${formatDecimal(adjustmentsValue)} điểm`
          : `Đang trừ ${formatDecimal(Math.abs(adjustmentsValue))} điểm`,
    },
    {
      title: 'Tổng số công ty',
      value: formatInt(summaryCompanyCardValue),
      subtitle: companyCardSubtitle || 'Theo bộ lọc hiện tại',
    },
    {
      title: 'Số giấy phép hợp lệ',
      value: formatInt(summary.licenses),
      subtitle: `Đã loại trừ • ${formatInt(summary.licenseCount ?? 0)} mã khác nhau`,
    },
    {
      title: 'Tờ khai có C/O',
      value: formatInt(summary.co ?? 0),
      subtitle: `Tổng dòng áp C/O: ${formatInt(summary.coLines ?? 0)}`,
    },
  ];
  return (
    <section className="rounded-3xl border border-[color:var(--ds-border-subtle)] bg-white/90 p-6 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[color:var(--ds-text-primary)]">Diễn biến & cơ cấu KPI</h3>
        <p className="text-sm text-[color:var(--ds-text-secondary)]">
          Toàn bộ chỉ số, xu hướng và cơ cấu tổ đội được cập nhật tự động theo khoảng thời gian bạn đã chọn.
        </p>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-gradient-to-br from-white via-[color:var(--ds-surface-muted)]/60 to-white p-4 shadow-inner">
            <TrendLineChart variant="inline" data={trendSeries} comparison={comparison} palette={palette} />
            <div className="grid gap-3 md:grid-cols-2">
              {alertEntries.length ? (
                alertEntries.map((alert) => {
                  const tone = ALERT_TONE_STYLES[alert.tone] || ALERT_TONE_STYLES.info;
                  return (
                    <div
                      key={alert.key}
                      className="space-y-1 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-white/80 p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.badge}`}>
                          {alert.badge || 'Lưu ý'}
                        </span>
                        <span className={`text-xs font-semibold ${tone.title}`}>{alert.title}</span>
                      </div>
                      {alert.detail ? (
                        <p className="text-xs leading-relaxed text-[color:var(--ds-text-secondary)]">{alert.detail}</p>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--ds-border-subtle)] bg-white/50 p-4 text-sm text-[color:var(--ds-text-muted)]">
                  KPI biến động trong phạm vi cho phép, chưa có cảnh báo nào.
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]">Chỉ số tổng hợp</h4>
              <span className="text-xs text-[color:var(--ds-text-muted)]">Đồng bộ cùng bộ lọc báo cáo</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((item) => (
                <SummaryCard key={item.title} title={item.title} value={item.value} subtitle={item.subtitle} />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-white/80 p-4 shadow-sm">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]">Cơ cấu tổ đội</h4>
            <p className="text-xs text-[color:var(--ds-text-muted)]">Tỷ trọng điểm KPI và số tờ khai giữa các tổ đội.</p>
          </div>
          <TeamPieWidget kpiData={teamPieData} declData={teamDeclPieData} palette={palette} variant="inline" />
        </div>
      </div>
    </section>
  );
}


function TrendLineChart({ data, comparison, palette = DEFAULT_CHART_COLORS, variant = "card" }) {
  const colors = Array.isArray(palette) && palette.length ? palette : DEFAULT_CHART_COLORS;
  const kpiColor = colors[0] ?? DEFAULT_CHART_COLORS[0];
  const declColor = colors[1] ?? DEFAULT_CHART_COLORS[1];
  const deltaKPI = comparison?.delta?.kpi ?? 0;
  const deltaDecls = comparison?.delta?.decls ?? 0;
  const deltaPercent = comparison?.delta?.kpiPercent ?? null;
  const deltaClass =
    deltaKPI > 0 ? 'text-emerald-600' : deltaKPI < 0 ? 'text-red-600' : 'text-[color:var(--ds-text-secondary)]';
  const renderDeltaSummary = () => {
    if (!comparison) {
      return null;
    }
    return (
      <>
        So với kỳ liền trước:
        <span className={`ml-1 font-medium ${deltaClass}`}>
          {deltaKPI > 0 ? '+' : ''}
          {deltaKPI.toFixed(1)} điểm KPI
        </span>
        {deltaPercent !== null && (
          <span className={`ml-1 ${deltaClass}`}>
            ({deltaPercent > 0 ? '+' : ''}
            {deltaPercent.toFixed(1)}%)
          </span>
        )}
        <span className="ml-2 text-[color:var(--ds-text-muted)]">
          {deltaDecls > 0 ? '+' : ''}
          {formatInt(deltaDecls)} tờ khai
        </span>
      </>
    );
  };
  if (!data || data.length === 0) {
    if (variant === 'inline') {
      return (
        <div className="rounded border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-sm text-[color:var(--ds-text-muted)]">
          Chưa có dữ liệu để hiển thị biểu đồ xu hướng.
        </div>
      );
    }
    return (
      <section className="ds-card space-y-3 p-4">
        <h3 className="text-base font-semibold text-gray-900">Xu hướng KPI 6 kỳ gần nhất</h3>
        <p className="mt-3 text-sm text-gray-500">Chưa có dữ liệu để hiển thị biểu đồ xu hướng.</p>
      </section>
    );
  }
  const chart = (
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
  );
  if (variant === 'inline') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Xu hướng KPI 6 kỳ gần nhất</h4>
          {comparison ? <div className="text-xs text-[color:var(--ds-text-muted)]">{renderDeltaSummary()}</div> : null}
        </div>
        <div className="h-56 w-full">{chart}</div>
      </div>
    );
  }
  return (
    <section className="ds-card space-y-4 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">Xu hướng KPI 6 kỳ gần nhất</h3>
        {comparison ? <div className="text-xs text-gray-500">{renderDeltaSummary()}</div> : null}
      </div>
      <div className="mt-4 h-64 w-full">{chart}</div>
    </section>
  );
}


function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-white/85 p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ds-text-muted)]">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-[color:var(--ds-text-primary)]">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-[color:var(--ds-text-secondary)]">{subtitle}</div> : null}
    </div>
  );
}


function DetailPanelSkeleton({ label }) {

  return (

    <div className="space-y-3 rounded-lg border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-6 text-sm text-[color:var(--ds-text-secondary)]">

      <div className="h-4 w-32 rounded bg-[color:var(--ds-border-muted)]" />

      <div className="h-3 w-full rounded bg-[color:var(--ds-border-muted)]" />

      <div className="h-3 w-3/4 rounded bg-[color:var(--ds-border-muted)]" />

      <div className="text-xs font-medium text-[color:var(--ds-text-muted)]">{label}</div>

    </div>

  );

}



function ScopeBreadcrumb({ scopeLabel, summaryLabel, detailLabel, viewMode }) {

  const segments = ["Báo cáo KPI", scopeLabel, viewMode === "detail" ? detailLabel : summaryLabel];

  return (

    <>

      <div className="hidden items-center gap-1 text-xs text-[color:var(--ds-text-muted)] sm:flex">

        {segments.map((segment, index) => (

          <React.Fragment key={`${segment || "segment"}-${index}`}>

            {index > 0 ? <span aria-hidden>›</span> : null}

            <span className="max-w-[10rem] truncate" title={segment}>

              {segment}

            </span>

          </React.Fragment>

        ))}

      </div>

      <div className="text-xs text-[color:var(--ds-text-muted)] sm:hidden">

        {scopeLabel} · {viewMode === "detail" ? detailLabel : summaryLabel}

      </div>

    </>

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

  const [activeScopeTab, setActiveScopeTab] = useState(() => sanitizeScope(storedPrefs.scope));

  const [selectedStaff, setSelectedStaff] = useState(() => sanitizeSelection(storedPrefs.selectedStaff));

  const [selectedTeam, setSelectedTeam] = useState(() => sanitizeSelection(storedPrefs.selectedTeam));

  const [staffViewMode, setStaffViewMode] = useState("summary");

  const [teamViewMode, setTeamViewMode] = useState("summary");

  const [topStaffMetric, setTopStaffMetric] = useState(() => sanitizeTopStaffMetric(storedPrefs.topStaffMetric));

  const [staffSortKey, setStaffSortKey] = useState(() => sanitizeSortKey(storedPrefs.staffSortKey));

  const [teamSortKey, setTeamSortKey] = useState(() => sanitizeSortKey(storedPrefs.teamSortKey));

  const [topStaffVisibleCount, setTopStaffVisibleCount] = useState(() =>

    sanitizeTopStaffVisibleCount(storedPrefs.topStaffVisibleCount)

  );

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

  const [reportTemplates, setReportTemplates] = useState(() => getReportTemplates());

  const [activeTemplateId, setActiveTemplateId] = useState(() => sanitizeTemplateId(storedPrefs.templateId));

  const exportColumns = useMemo(() => sanitizeColumnVisibility(columnVisibility), [columnVisibility]);
  const visibleColumnCount = useMemo(
    () =>
      COLUMN_VISIBILITY_OPTIONS.reduce((count, option) => {
        return columnVisibility[option.key] === false ? count : count + 1;
      }, 0),
    [columnVisibility],
  );
  const columnVisibilitySummary = useMemo(() => {
    if (visibleColumnCount === COLUMN_VISIBILITY_OPTIONS.length) {
      return "Hiển thị tất cả cột";
    }
    if (visibleColumnCount === 0) {
      return "Đang ẩn tất cả cột";
    }
    return `Đang hiển thị ${visibleColumnCount}/${COLUMN_VISIBILITY_OPTIONS.length} cột`;
  }, [visibleColumnCount]);

  const prefsSnapshotRef = useRef("");

  const [topCompanyPeriod, setTopCompanyPeriod] = useState(() =>

    sanitizeTopCompanyPeriod(storedPrefs.topCompanyPeriod)

  );

  const [topCompanyVisibleCount, setTopCompanyVisibleCount] = useState(() =>

    sanitizeTopCompanyVisibleCount(storedPrefs.topCompanyVisibleCount)

  );

  const [adjustmentExpanded, setAdjustmentExpanded] = useState(() => storedPrefs.adjustmentExpanded === true);

  useRenderMetrics('ReportViewer', () => ({
    quickRange,
    scope: activeScopeTab,
    staff: selectedStaff || 'all',
    team: selectedTeam || 'all',
    staffMode: staffViewMode,
    teamMode: teamViewMode,
    exporting,
    topCompanyPeriod,
    topCompanyVisibleCount,
  }));

  const isAdmin = isAdminRole(currentUser?.role);
  const adjustmentPermissions = currentUser?.permissions || {};
  const canSubmitAdjustments = adjustmentPermissions.adjustSubmit !== false;
  const canApproveAdjustments = adjustmentPermissions.adjustApprove === true;
  const adjustmentPanelReadOnly = !canSubmitAdjustments && !canApproveAdjustments;

  const actorLabel = useMemo(() => {

    const candidates = [

      currentUser?.name,

      currentUser?.fullName,

      currentUser?.displayName,

      currentUser?.username,

    ];

    for (const candidate of candidates) {

      if (typeof candidate === "string") {

        const trimmed = candidate.trim();

        if (trimmed) {

          return trimmed;

        }

      }

    }

    return "system";

  }, [currentUser]);



  const handleToggleColumnVisibility = (key, nextValue) => {

    setColumnVisibility((prev) => {

      const resolved =
        typeof nextValue === "boolean"
          ? nextValue
          : prev[key] === false;

      return {

        ...prev,

        [key]: resolved ? true : false,

      };

    });

  };



  const handleScopeTabChange = useCallback((value) => {

    const normalized = sanitizeScope(value);

    setActiveScopeTab(normalized);

  }, []);



  const [ruleCollection, setRuleCollection] = useState(() => loadRuleSets());

  const [selectedRuleId, setSelectedRuleId] = useState(() => sanitizeRulePreference(storedPrefs.ruleId));

  const [rules, setRulesState] = useState(() =>

    loadRules(sanitizeRulePreference(storedPrefs.ruleId) || undefined)

  );

  const [roster, setRoster] = useState(() => getTeamRoster());

  const [mstRows, setMstRows] = useState(() => getMSTMap());

  const [declarations, setDeclarations] = useState(() => sortDeclRows(getDeclRows()));

  const [adjustments, setAdjustments] = useState(() => getKpiAdjustments());



const [adjustmentPageSize, setAdjustmentPageSize] = useState(() =>

  sanitizeAdjustmentPageSize(storedPrefs.adjustmentPageSize)

);

const [adjustmentPage, setAdjustmentPage] = useState(0);

const initialDetailPageSize = useMemo(

  () => sanitizeDetailPageSize(storedPrefs.detailPageSize),

  [storedPrefs.detailPageSize]

);

const [detailPageSize, setDetailPageSize] = useState(initialDetailPageSize);

const [detailPageSizeMode, setDetailPageSizeMode] = useState(() =>

  DETAIL_PAGE_SIZE_OPTIONS.includes(initialDetailPageSize) ? "preset" : "custom"

);

const [detailPageSizeCustomInput, setDetailPageSizeCustomInput] = useState(() =>

  DETAIL_PAGE_SIZE_OPTIONS.includes(initialDetailPageSize) ? "" : String(initialDetailPageSize)

);

  const currentTemplateConfig = useMemo(

    () =>

      normalizeTemplateConfig({

        quickRange,

        from,

        to,

        scope: activeScopeTab,

        selectedStaff,

        selectedTeam,

        staffSortKey,

        teamSortKey,

        topStaffMetric,

        topStaffVisibleCount,

        columns: exportColumns,

        ruleId: selectedRuleId,

        detailPageSize,

        adjustmentPageSize,

        staffViewMode,

        teamViewMode,

        adjustmentExpanded,

        topCompanyPeriod,

      }),

    [

      quickRange,

      from,

      to,

      activeScopeTab,

      selectedStaff,

      selectedTeam,

      staffSortKey,

      teamSortKey,

      topStaffMetric,

      topStaffVisibleCount,

      exportColumns,

      selectedRuleId,

      detailPageSize,

      adjustmentPageSize,

      staffViewMode,

      teamViewMode,

      adjustmentExpanded,

      topCompanyPeriod,

    ],

  );

  const currentTemplateSignature = useMemo(

    () => JSON.stringify(currentTemplateConfig),

    [currentTemplateConfig],

  );

  const activeTemplate = useMemo(

    () => reportTemplates.find((item) => item.id === activeTemplateId) || null,

    [reportTemplates, activeTemplateId],

  );

  const activeTemplateSignature = useMemo(

    () => (activeTemplate ? JSON.stringify(normalizeTemplateConfig(activeTemplate.config)) : ""),

    [activeTemplate],

  );

  const isTemplateDirty = Boolean(activeTemplate) && activeTemplateSignature !== currentTemplateSignature;

  const [staffDetailPage, setStaffDetailPage] = useState(0);

  const [teamDetailPage, setTeamDetailPage] = useState(0);

  useEffect(() => {
    if (activeScopeTab === "staff" && staffViewMode === "detail") {
      import("@/components/report-viewer/StaffDetailCard.jsx");
    }
  }, [activeScopeTab, staffViewMode]);

  useEffect(() => {
    if (activeScopeTab === "team" && teamViewMode === "detail") {
      import("@/components/report-viewer/TeamDetailCard.jsx");
    }
  }, [activeScopeTab, teamViewMode]);

  const applyTemplateConfigToState = (config) => {
    const normalized = normalizeTemplateConfig(config);
    if (normalized.quickRange === "custom") {
      setQuickRange("custom");
      setFrom(normalized.from || from);
      setTo(normalized.to || to);
    } else {
      setQuickRange(normalized.quickRange);
      const computed = computeQuickRange(normalized.quickRange);
      setFrom(computed.from);
      setTo(computed.to);
    }
    setActiveScopeTab(normalized.scope);
    setSelectedStaff(normalized.selectedStaff);
    setSelectedTeam(normalized.selectedTeam);
    setStaffSortKey(normalized.staffSortKey);
    setTeamSortKey(normalized.teamSortKey);
    setTopStaffMetric(normalized.topStaffMetric);
    setTopStaffVisibleCount(normalized.topStaffVisibleCount);
    setColumnVisibility(deriveColumnVisibilityState(normalized.columns));
    setSelectedRuleId(normalized.ruleId);
    setDetailPageSize(normalized.detailPageSize);
    setAdjustmentPageSize(normalized.adjustmentPageSize);
    setStaffViewMode(normalized.staffViewMode);
    setTeamViewMode(normalized.teamViewMode);
    setAdjustmentExpanded(normalized.adjustmentExpanded);
    setTopCompanyPeriod(normalized.topCompanyPeriod);
    setDetailPageSizeMode(
      DETAIL_PAGE_SIZE_OPTIONS.includes(normalized.detailPageSize) ? "preset" : "custom",
    );
    setDetailPageSizeCustomInput(
      DETAIL_PAGE_SIZE_OPTIONS.includes(normalized.detailPageSize)
        ? ""
        : String(normalized.detailPageSize),
    );
    setStaffDetailPage(0);
    setTeamDetailPage(0);
    setAdjustmentPage(0);
  };

  const handleApplyTemplate = (templateId, { silent = false } = {}) => {
    if (!templateId) {
      setActiveTemplateId("");
      return;
    }
    const template = reportTemplates.find((item) => item && item.id === templateId);
    if (!template) {
      setActiveTemplateId("");
      toast.error?.("Template báo cáo đã bị xoá hoặc không tồn tại.");
      return;
    }
    applyTemplateConfigToState(template.config);
    setActiveTemplateId(template.id);
    if (!silent) {
      toast.success?.(`Đã áp dụng template "${template.name}".`);
    }
  };

  const handleSaveTemplateAsNew = () => {
    if (typeof window === "undefined") {
      toast.error?.("Không thể lưu template trong môi trường hiện tại.");
      return;
    }
    const nameInput = window.prompt("Đặt tên template báo cáo", "");
    if (nameInput === null) {
      return;
    }
    const normalizedName = nameInput.trim();
    if (!normalizedName) {
      toast.error?.("Tên template không được để trống.");
      return;
    }
    try {
      const saved = saveReportTemplate(
        {
          name: normalizedName,
          config: currentTemplateConfig,
          createdBy: actorLabel,
          updatedBy: actorLabel,
        },
        { actor: actorLabel },
      );
      setReportTemplates(getReportTemplates());
      setActiveTemplateId(saved?.id || "");
      toast.success?.("Đã lưu template báo cáo mới.");
    } catch (error) {
      console.error("Không thể lưu template báo cáo", error);
      toast.error?.(error?.message || "Không thể lưu template báo cáo.");
    }
  };

  const handleOverwriteTemplate = () => {
    if (!activeTemplate) {
      return;
    }
    if (typeof window === "undefined") {
      toast.error?.("Không thể cập nhật template trong môi trường hiện tại.");
      return;
    }
    const nameInput = window.prompt("Cập nhật tên template báo cáo", activeTemplate.name || "");
    if (nameInput === null) {
      return;
    }
    const normalizedName = nameInput.trim();
    if (!normalizedName) {
      toast.error?.("Tên template không được để trống.");
      return;
    }
    try {
      const saved = saveReportTemplate(
        {
          id: activeTemplate.id,
          name: normalizedName,
          config: currentTemplateConfig,
          createdBy: activeTemplate.createdBy || actorLabel,
          updatedBy: actorLabel,
        },
        { actor: actorLabel },
      );
      setReportTemplates(getReportTemplates());
      setActiveTemplateId(saved?.id || activeTemplate.id);
      toast.success?.("Đã cập nhật template báo cáo.");
    } catch (error) {
      console.error("Không thể cập nhật template báo cáo", error);
      toast.error?.(error?.message || "Không thể cập nhật template báo cáo.");
    }
  };

  const handleDeleteTemplate = () => {
    if (!activeTemplate) {
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Xoá template "${activeTemplate.name}"?`);
      if (!confirmed) {
        return;
      }
    }
    const success = deleteReportTemplate(activeTemplate.id, { actor: actorLabel });
    if (success) {
      setReportTemplates(getReportTemplates());
      setActiveTemplateId("");
      toast.success?.("Đã xoá template báo cáo.");
    } else {
      toast.error?.("Không thể xoá template báo cáo.");
    }
  };

  const hasTemplates = reportTemplates.length > 0;

  const canOverwriteTemplate = Boolean(activeTemplate) && isTemplateDirty;

  const canDeleteTemplate = Boolean(activeTemplate);



  const templateOptions = useMemo(

    () =>

      reportTemplates

        .filter((item) => item && item.id)

        .map((item) => {

          const idLabel = String(item.id);

          const suffix = idLabel.slice(-4) || idLabel;

          return {

            value: idLabel,

            label: item.name || (suffix ? `Template ${suffix}` : "Template chưa đặt tên"),

          };

        }),

    [reportTemplates],

  );


  useEffect(() => {

    const payload = {

      quickRange,

      from,

      to,

      scope: activeScopeTab,

      selectedStaff,

      selectedTeam,

      staffSortKey,

      teamSortKey,

      topStaffMetric,

      topStaffVisibleCount,

      topCompanyPeriod,

      topCompanyVisibleCount,

      columns: exportColumns,

      ruleId: selectedRuleId,

      adjustmentPageSize,

      detailPageSize,

      adjustmentExpanded,

      templateId: activeTemplateId,

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

    activeScopeTab,

    selectedStaff,

    selectedTeam,

    staffSortKey,

    teamSortKey,

    topStaffMetric,

    topStaffVisibleCount,

    topCompanyPeriod,

    topCompanyVisibleCount,

    exportColumns,

    selectedRuleId,

    adjustmentPageSize,

    detailPageSize,

    adjustmentExpanded,

    activeTemplateId,

  ]);



  useEffect(() => {

    setRuleCollection(loadRuleSets());

    setRoster(getTeamRoster());

    setMstRows(getMSTMap());

    setDeclarations(sortDeclRows(getDeclRows()));

    setAdjustments(getKpiAdjustments());


    setReportTemplates(getReportTemplates());

  }, []);



  useEffect(() => {

    const unsubscribeAdjustments = subscribeStorage(KPI_ADJUSTMENTS_KEY, () => {

      setAdjustments(getKpiAdjustments());

    });


    const unsubscribeTemplates = subscribeStorage(KPI_REPORT_TEMPLATES_KEY, () => {

      setReportTemplates(getReportTemplates());

    });

    return () => {

      unsubscribeAdjustments();


      unsubscribeTemplates();

    };

  }, []);



  useEffect(() => {

    if (!activeTemplateId) {

      return;

    }

    const exists = reportTemplates.some((item) => item && item.id === activeTemplateId);

    if (!exists) {

      setActiveTemplateId("");

    }

  }, [activeTemplateId, reportTemplates]);



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






  const ruleDeltaLabel = useMemo(() => {

    if (!ruleComparison) {

      return "";

    }

    const kpiLabel = `${ruleComparison.kpi >= 0 ? "+" : ""}${formatDecimal(ruleComparison.kpi || 0)} điểm`;

    const declLabel = `${ruleComparison.decls >= 0 ? "+" : ""}${formatInt(ruleComparison.decls || 0)} tờ khai`;

    return `${kpiLabel} • ${declLabel}`;

  }, [ruleComparison]);



  const selectedRuleVersion = selectedRuleMeta?.version;

  const selectedRuleApplyFrom = selectedRuleMeta?.applyFrom || "";

  const reportRuleApplyFrom = report.rules?.applyFrom || "";



  const ruleMetaLabel = useMemo(() => {

    if (selectedRuleVersion != null) {

      return `Phiên bản: v${selectedRuleVersion}`;

    }

    const applyFrom = selectedRuleApplyFrom || reportRuleApplyFrom;

    if (applyFrom) {

      return `Áp dụng từ ${applyFrom}`;

    }

    return "Phiên bản: —";

  }, [reportRuleApplyFrom, selectedRuleApplyFrom, selectedRuleVersion]);



  const ruleStatusLabel = useMemo(() => {

    if (ruleComparison) {

      return `Chênh lệch so với bộ đang áp dụng: ${ruleDeltaLabel}`;

    }

    if (ruleCollection?.activeId === (selectedRuleMeta?.id || "")) {

      return "Đang xem đúng bộ quy tắc đang áp dụng.";

    }

    return `Bộ đang áp dụng: ${activeRule?.name || "—"}`;

  }, [activeRule?.name, ruleCollection?.activeId, ruleComparison, ruleDeltaLabel, selectedRuleMeta?.id]);



  const normalizedTemplateName = activeTemplate?.name?.trim()

    ? activeTemplate.name.trim()

    : "Tuỳ chỉnh hiện tại";

  const normalizedRuleName = selectedRuleMeta?.name || activeRule?.name || "Chưa có bộ quy tắc";



  const appliedContextLabel = useMemo(

    () => `Template: ${normalizedTemplateName} • Bộ quy tắc: ${normalizedRuleName}`,

    [normalizedRuleName, normalizedTemplateName],

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

    if (activeScopeTab === "staff" && selectedStaff !== "all") {

      const exists = report.staff.list.some((item) => item.key === selectedStaff);

      if (!exists) {

        setSelectedStaff("all");

      }

    }

  }, [activeScopeTab, selectedStaff, report.staff.list]);



  useEffect(() => {

    if (activeScopeTab === "team" && selectedTeam !== "all") {

      const exists = report.teams.list.some((item) => item.key === selectedTeam);

      if (!exists) {

        setSelectedTeam("all");

      }

    }

  }, [activeScopeTab, selectedTeam, report.teams.list]);



  useEffect(() => {

    if (activeScopeTab !== "staff") {
      return;
    }

    if (selectedStaff === "all") {
      setStaffViewMode((mode) => (mode === "summary" ? mode : "summary"));
    } else {
      setStaffViewMode("detail");
    }
  }, [selectedStaff, activeScopeTab]);



  useEffect(() => {

    if (activeScopeTab !== "team") {
      return;
    }

    if (selectedTeam === "all") {
      setTeamViewMode((mode) => (mode === "summary" ? mode : "summary"));
    } else {
      setTeamViewMode("detail");
    }
  }, [selectedTeam, activeScopeTab]);



  const summary = report.summary;

  const summaryCompanyCardValue = managedCompanyCount || summary.companyCount;

  const teamCountForSubtitle = Array.isArray(roster?.teams)

    ? roster.teams.length

    : 0;

  const companyCardSubtitle = teamCountForSubtitle

    ? `Doanh nghiệp do ${teamCountForSubtitle} tổ đội quản lý`

    : "Doanh nghiệp duy nhất trong giai đoạn";

  const ruleApply = selectedRuleMeta?.applyFrom

    ? `Áp dụng từ ${selectedRuleMeta.applyFrom}`

    : report.rules?.applyFrom

    ? `Áp dụng từ ${report.rules.applyFrom}`

    : "Áp dụng ngay";

  const reportAdminInfo = {
    totalDeclsLabel: formatInt(summary.decls),
    rangeLabel: `Khoảng: ${report.range.from || "…"} → ${report.range.to || "…"}`,
    contextLabel: appliedContextLabel,
    ruleApplyLabel: ruleApply,
  };



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

    return sortStatsCollection(report.staff.list, "kpi", (item) => item.name || "");

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

      .filter((item) => item.decls > 0);

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

  const companyLeaderboard = useMemo(() => {

    const rows = Array.isArray(report.rows) ? report.rows : [];

    if (!rows.length) {

      return [];

    }

    const periodMap = new Map();

    for (const row of rows) {

      if (!row || row.isAdjustment) {

        continue;

      }

      const date = typeof row.date === "string" ? row.date : "";

      const periodKey = date ? date.slice(0, 7) : "";

      if (!periodKey) {

        continue;

      }

      if (!periodMap.has(periodKey)) {

        periodMap.set(periodKey, new Map());

      }

      const companyMap = periodMap.get(periodKey);

      const mst = row.mst ? String(row.mst) : "";

      const companyName = row.cong_ty ? String(row.cong_ty) : "";

      const hasIdentity = mst || companyName;

      const companyKey = hasIdentity ? `${mst}|${companyName}` : "__unknown__";

      if (!companyMap.has(companyKey)) {

        companyMap.set(companyKey, {

          key: companyKey,

          mst,

          cong_ty: companyName,

          decls: 0,

          kpi: 0,

        });

      }

      const entry = companyMap.get(companyKey);

      entry.decls += 1;

      const numericKpi = Number(row.kpi || 0);

      if (Number.isFinite(numericKpi)) {

        entry.kpi += numericKpi;

      }

    }

    return Array.from(periodMap.entries())

      .map(([periodKey, companyMap]) => {

        const values = Array.from(companyMap.values());

        if (!values.length) {

          return null;

        }

        const totalDecls = values.reduce((sum, item) => sum + Number(item.decls || 0), 0);

        const sorted = values.sort((a, b) => {

          if ((b.decls || 0) !== (a.decls || 0)) {

            return (b.decls || 0) - (a.decls || 0);

          }

          if ((b.kpi || 0) !== (a.kpi || 0)) {

            return (b.kpi || 0) - (a.kpi || 0);

          }

          const labelA = a.cong_ty || a.mst || "";

          const labelB = b.cong_ty || b.mst || "";

          return labelA.localeCompare(labelB, "vi", { sensitivity: "base" });

        });

        const topCompanies = sorted.map((item) => ({

          ...item,

          kpi: Math.round((item.kpi || 0) * 10) / 10,

          share: totalDecls > 0 ? Number(item.decls || 0) / totalDecls : 0,

        }));

        return {

          key: periodKey,

          label: formatPeriodLabel(periodKey),

          totalDecls,

          periodCompanyCount: sorted.length,

          topCompanies,

        };

      })

      .filter(Boolean)

      .sort((a, b) => b.key.localeCompare(a.key));

  }, [report.rows]);

  const overviewAlerts = useMemo(() => {

    const alerts = [];

    const kpiValues = Array.isArray(trendSeries)

      ? trendSeries.map((item) => Number(item?.kpi || 0)).filter((value) => Number.isFinite(value))

      : [];

    if (kpiValues.length >= 3) {

      const average = kpiValues.reduce((sum, value) => sum + value, 0) / kpiValues.length;

      const variance =

        kpiValues.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / kpiValues.length;

      const stdDev = Math.sqrt(variance);

      const latestValue = kpiValues[kpiValues.length - 1];

      const latestLabel = trendSeries[trendSeries.length - 1]?.period || "gần nhất";

      if (Number.isFinite(stdDev) && stdDev > 0 && latestValue < average - stdDev) {

        alerts.push({

          key: "kpi-std-low",

          tone: "warning",

          badge: "Lưu ý",

          title: `KPI tháng ${latestLabel} thấp hơn mức trung bình`,

          detail: `Đạt ${formatDecimal(latestValue)} so với trung bình ${formatDecimal(average)} (σ ${formatDecimal(stdDev)}).`,

        });

      } else if (Number.isFinite(stdDev) && stdDev > 0 && latestValue > average + stdDev) {

        alerts.push({

          key: "kpi-std-high",

          tone: "info",

          badge: "Thông tin",

          title: `KPI tháng ${latestLabel} vượt chuẩn so với trung bình`,

          detail: `Đạt ${formatDecimal(latestValue)} so với trung bình ${formatDecimal(average)} (σ ${formatDecimal(stdDev)}).`,

        });

      }

    }

    if (trendComparison?.delta?.kpiPercent != null && trendComparison.delta.kpiPercent <= -10) {

      const dropPercent = Math.abs(trendComparison.delta.kpiPercent);

      const dropKpi = trendComparison.delta.kpi ?? 0;

      const dropDecls = Number(trendComparison.delta.decls || 0);

      const declDetail =

        dropDecls === 0

          ? "Số tờ khai giữ nguyên so với kỳ trước."

          : `Số tờ khai ${dropDecls > 0 ? "tăng" : "giảm"} ${formatInt(Math.abs(dropDecls))} tờ.`;

      alerts.push({

        key: "kpi-drop",

        tone: "danger",

        badge: "Cảnh báo",

        title: `Điểm KPI giảm ${dropPercent.toFixed(1)}% so với kỳ trước`,

        detail: `Chênh lệch ${dropKpi > 0 ? "+" : ""}${dropKpi.toFixed(1)} điểm. ${declDetail}`,

      });

    }

    const totalKpi = Number(summary?.kpi || 0);

    const adjustmentAbs = Math.abs(Number(adjustmentsReport.totalPoints || 0));

    if (totalKpi > 0 && adjustmentAbs > 0) {

      const adjustmentRatio = (adjustmentAbs / totalKpi) * 100;

      if (adjustmentRatio >= 25) {

        alerts.push({

          key: "adjustment-share",

          tone: "info",

          badge: "Lưu ý",

          title: "Điểm KPI phụ thuộc nhiều vào điều chỉnh",

          detail: `Điểm cộng/trừ chiếm khoảng ${adjustmentRatio.toFixed(1)}% tổng KPI (${formatDecimal(adjustmentAbs)} điểm).`,

        });

      }

    }

    if (!alerts.length) {

      alerts.push({

        key: "kpi-stable",

        tone: "success",

        badge: "Ổn định",

        title: "Xu hướng KPI ổn định",

        detail: "Không phát hiện biến động vượt chuẩn trong 6 kỳ gần nhất.",

      });

    }

    return alerts;

  }, [trendSeries, trendComparison, summary?.kpi, adjustmentsReport.totalPoints]);

  const staffOptions = useMemo(() => {

    const base = [

      { value: "all", label: `Tất cả nhân viên (${report.staff.list.length})` },

    ];

    return base.concat(

      report.staff.list.map((item) => ({

        value: item.key,

        label:

          item.teamLabel && item.teamLabel !== "Chưa gán tổ đội"

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

  const handleDetailPageSizeChange = (event) => {

    const raw = event?.target?.value;

    if (raw === "custom") {

      setDetailPageSizeMode("custom");

      setDetailPageSizeCustomInput((prev) => {

        if (prev && Number(prev) > 0) {

          return prev;

        }

        return String(detailPageSize);

      });

      return;

    }

    const numeric = Number(raw);

    if (!Number.isFinite(numeric) || numeric <= 0) {

      return;

    }

    const normalized = sanitizeDetailPageSize(numeric);

    setDetailPageSizeMode("preset");

    setDetailPageSize(normalized);

    setDetailPageSizeCustomInput("");

    setStaffDetailPage(0);

    setTeamDetailPage(0);

  };

  const handleDetailPageSizeCustomInputChange = (event) => {

    const raw = event?.target?.value ?? "";

    setDetailPageSizeMode("custom");

    if (!raw.trim()) {

      setDetailPageSizeCustomInput("");

      return;

    }

    const numeric = Number(raw);

    if (!Number.isFinite(numeric) || numeric <= 0) {

      setDetailPageSizeCustomInput(raw);

      return;

    }

    const normalized = sanitizeDetailPageSize(numeric);

    const normalizedText = String(normalized);

    setDetailPageSizeCustomInput(normalizedText);

    if (normalized !== detailPageSize) {

      setDetailPageSize(normalized);

      setStaffDetailPage(0);

      setTeamDetailPage(0);

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

  const handleAdjustmentPageSizeChange = (value) => {

    setAdjustmentPageSize(sanitizeAdjustmentPageSize(value));

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

  const handleFromChange = (value) => {

    setFrom(value);

    setQuickRange("custom");

  };

  const handleToChange = (value) => {

    setTo(value);

    setQuickRange("custom");

  };

  const filterSummaryLabel = useMemo(() => {

    const formattedFrom = formatDisplayDate(from);

    const formattedTo = formatDisplayDate(to);

    if (formattedFrom && formattedTo) {

      if (formattedFrom === formattedTo) {

        return `Kỳ: ${formattedFrom}`;

      }

      return `Kỳ: ${formattedFrom} → ${formattedTo}`;

    }

    if (formattedFrom) {

      return `Từ ${formattedFrom}`;

    }

    if (formattedTo) {

      return `Đến ${formattedTo}`;

    }

    return "";

  }, [from, to]);


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
      const staffPageItems = filteredStaffList.slice(staffSliceStart, staffSliceStart + detailPageSize);
      const staffPageStart = totalStaffRows === 0 ? 0 : staffSliceStart + 1;
      const staffPageEnd =
        totalStaffRows === 0 ? 0 : Math.min(totalStaffRows, staffSliceStart + staffPageItems.length);
      const totalStaffPages = totalStaffRows === 0 ? 1 : Math.ceil(totalStaffRows / detailPageSize);
      const isFirstStaffPage = staffDetailPage === 0;
      const isLastStaffPage = staffDetailPage >= totalStaffPages - 1;
      const staffRangeLabel = totalStaffRows
        ? `${formatInt(staffPageStart)}–${formatInt(staffPageEnd)} / ${formatInt(totalStaffRows)}`
        : "0 / 0";

      const staffDetailColumns = [
        {
          key: "name",
          label: "Nhân viên",
          align: "left",
          headerClassName: "text-left",
          renderCell: (item) => (
            <button
              type="button"
              className="font-medium text-[color:var(--ds-text-primary)] hover:underline"
              onClick={() => {
                setSelectedStaff(item.key);
                setStaffViewMode("detail");
              }}
            >
              {item.name}
            </button>
          ),
        },
        {
          key: "team",
          label: "Tổ đội",
          align: "left",
          className: "text-[color:var(--ds-text-secondary)]",
          renderCell: (item) => item.team || "—",
        },
        {
          key: "decls",
          label: "Tờ khai",
          align: "right",
          renderCell: (item) => formatInt(item.stats.decls),
        },
        {
          key: "kpi",
          label: "Điểm KPI",
          align: "right",
          className: "font-semibold",
          renderCell: (item) => formatDecimal(item.stats.kpi),
        },
        {
          key: "import",
          label: "Nhập",
          align: "right",
          renderCell: (item) => formatInt(item.stats.import),
        },
        {
          key: "export",
          label: "Xuất",
          align: "right",
          renderCell: (item) => formatInt(item.stats.export),
        },
        {
          key: "items",
          label: "Mục hàng",
          align: "right",
          visible: columnVisibility.items !== false,
          renderCell: (item) => formatInt(item.stats.items),
        },
        {
          key: "licenses",
          label: "Số GP",
          align: "right",
          visible: columnVisibility.licenses !== false,
          renderCell: (item) => formatInt(item.stats.licenses),
        },
        {
          key: "co",
          label: "Tờ khai C/O",
          align: "right",
          visible: columnVisibility.co !== false,
          renderCell: (item) => formatInt(item.stats.co),
        },
        {
          key: "coLines",
          label: "Dòng C/O",
          align: "right",
          visible: columnVisibility.coLines !== false,
          renderCell: (item) => formatInt(item.stats.coLines),
        },
        {
          key: "licenseCodes",
          label: "Mã giấy phép",
          align: "left",
          visible: columnVisibility.licenseCodes !== false,
          renderCell: (item) => {
            const codes = item.stats.licenseCodes || [];
            const text = codes.length ? codes.join(", ") : "—";
            return (
              <span title={text} className="text-[color:var(--ds-text-secondary)]">
                {text}
              </span>
            );
          },
        },
      ];

      return (
        <Tabs value={staffViewMode} onValueChange={setStaffViewMode} className="space-y-4">
          <ScopeBreadcrumb
            scopeLabel="Nhân viên"
            summaryLabel="Tổng quan"
            detailLabel="Chi tiết"
            viewMode={staffViewMode}
          />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              <TabsList className="ds-tab-list h-9 flex-nowrap gap-2">
                <TabsTrigger value="summary" className="px-3">
                  Tổng quan
                </TabsTrigger>
                <TabsTrigger value="detail" className="px-3">
                  Chi tiết
                </TabsTrigger>
              </TabsList>
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
            </div>
            <div className="flex flex-col gap-1 text-right">
              <button
                type="button"
                onClick={handleExportStaffAll}
                disabled={!canExport || exporting}
                className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                  canExport && !exporting
                    ? 'border-[color:var(--ds-border-strong)] bg-[color:var(--ds-accent)] text-[color:var(--ds-text-inverse)] hover:bg-[color:var(--ds-accent-strong)]'
                    : 'cursor-not-allowed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-disabled)]'
                }`}
              >
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
              <span className="text-[11px] text-[color:var(--ds-text-muted)]">Nhấn Ctrl+P để in nhanh toàn trang</span>
            </div>
          </div>

          <TabsContent value="summary" className="space-y-4">
            <CompanySummaryTable
              rows={filteredCompanySummaryStaff}
              includeStaff
              visibleColumns={columnVisibility}
              sortKey={staffSortKey}
            />
          </TabsContent>

          <TabsContent value="detail" className="space-y-4">
            <ReportEntityTable
              columns={staffDetailColumns}
              rows={staffPageItems}
              emptyMessage="Không có nhân viên phù hợp với điều kiện lọc hiện tại."
              pagination={
                totalStaffRows
                  ? {
                      totalRows: totalStaffRows,
                      pageSize: detailPageSize,
                      pageSizeMode: detailPageSizeMode,
                      pageSizeOptions: DETAIL_PAGE_SIZE_OPTIONS,
                      onPageSizeChange: handleDetailPageSizeChange,
                      customPageSizeValue: detailPageSizeCustomInput,
                      onCustomPageSizeChange: handleDetailPageSizeCustomInputChange,
                      rangeLabel: staffRangeLabel,
                      onPrevPage: () => setStaffDetailPage((value) => Math.max(0, value - 1)),
                      onNextPage: () => setStaffDetailPage((value) => Math.min(totalStaffPages - 1, value + 1)),
                      isFirstPage: isFirstStaffPage,
                      isLastPage: isLastStaffPage,
                    }
                  : null
              }
            />
          </TabsContent>
        </Tabs>
      );
    }

    if (!activeStaff) {
      return null;
    }

    const staffDetailLabel = activeStaff?.name ? `Chi tiết – ${activeStaff.name}` : "Chi tiết";

    return (
      <Tabs value={staffViewMode} onValueChange={setStaffViewMode} className="space-y-4">
        <ScopeBreadcrumb
          scopeLabel="Nhân viên"
          summaryLabel="Tổng quan"
          detailLabel={staffDetailLabel}
          viewMode={staffViewMode}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="ds-tab-list h-9 flex-nowrap gap-2">
            <TabsTrigger value="summary" className="px-3" disabled>
              Tổng quan
            </TabsTrigger>
            <TabsTrigger value="detail" className="px-3">
              Chi tiết
            </TabsTrigger>
          </TabsList>
          <span className="text-xs text-[color:var(--ds-text-muted)]">
            Chọn “Tất cả nhân viên” để xem bảng tổng quan.
          </span>
        </div>
        <TabsContent value="summary">
          <div className="rounded border border-dashed border-[color:var(--ds-border-muted)] bg-[color:var(--ds-surface-muted)] p-6 text-center text-sm text-[color:var(--ds-text-muted)]">
            Chế độ tổng quan chỉ khả dụng khi hiển thị toàn bộ danh sách nhân viên.
          </div>
        </TabsContent>
        <TabsContent value="detail" className="space-y-4">
          <Suspense fallback={<DetailPanelSkeleton label="Đang tải chi tiết nhân viên..." />}>
            <StaffDetailCard
              staff={activeStaff}
              onClose={() => setSelectedStaff("all")}
              canExport={canExport}
              onExport={() => handleExportStaffDetail(activeStaff)}
              exporting={exporting}
              visibleColumns={columnVisibility}
              detailPageSize={detailPageSize}
              detailPageSizeMode={detailPageSizeMode}
              detailPageSizeCustomInput={detailPageSizeCustomInput}
              onDetailPageSizeChange={handleDetailPageSizeChange}
              onDetailPageSizeCustomInputChange={handleDetailPageSizeCustomInputChange}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
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
      const teamPageEnd = totalTeamRows === 0 ? 0 : Math.min(totalTeamRows, teamSliceStart + teamPageItems.length);
      const totalTeamPages = totalTeamRows === 0 ? 1 : Math.ceil(totalTeamRows / detailPageSize);
      const isFirstTeamPage = teamDetailPage === 0;
      const isLastTeamPage = teamDetailPage >= totalTeamPages - 1;
      const teamRangeLabel = totalTeamRows
        ? `${formatInt(teamPageStart)}–${formatInt(teamPageEnd)} / ${formatInt(totalTeamRows)}`
        : "0 / 0";

      const teamDetailColumns = [
        {
          key: "name",
          label: "Tổ đội",
          align: "left",
          headerClassName: "text-left",
          renderCell: (item) => (
            <button
              type="button"
              className="font-medium text-[color:var(--ds-text-primary)] hover:underline"
              onClick={() => {
                setSelectedTeam(item.key);
                setTeamViewMode("detail");
              }}
            >
              {item.name}
            </button>
          ),
        },
        {
          key: "decls",
          label: "Tờ khai",
          align: "right",
          renderCell: (item) => formatInt(item.stats.decls),
        },
        {
          key: "kpi",
          label: "Điểm KPI",
          align: "right",
          className: "font-semibold",
          renderCell: (item) => formatDecimal(item.stats.kpi),
        },
        {
          key: "import",
          label: "Nhập",
          align: "right",
          renderCell: (item) => formatInt(item.stats.import),
        },
        {
          key: "export",
          label: "Xuất",
          align: "right",
          renderCell: (item) => formatInt(item.stats.export),
        },
        {
          key: "items",
          label: "Mục hàng",
          align: "right",
          visible: columnVisibility.items !== false,
          renderCell: (item) => formatInt(item.stats.items),
        },
        {
          key: "licenses",
          label: "Số GP",
          align: "right",
          visible: columnVisibility.licenses !== false,
          renderCell: (item) => formatInt(item.stats.licenses),
        },
        {
          key: "co",
          label: "Tờ khai C/O",
          align: "right",
          visible: columnVisibility.co !== false,
          renderCell: (item) => formatInt(item.stats.co),
        },
        {
          key: "coLines",
          label: "Dòng C/O",
          align: "right",
          visible: columnVisibility.coLines !== false,
          renderCell: (item) => formatInt(item.stats.coLines),
        },
        {
          key: "licenseCodes",
          label: "Mã giấy phép",
          align: "left",
          visible: columnVisibility.licenseCodes !== false,
          renderCell: (item) => {
            const codes = item.stats.licenseCodes || [];
            const text = codes.length ? codes.join(", ") : "—";
            return (
              <span title={text} className="text-[color:var(--ds-text-secondary)]">
                {text}
              </span>
            );
          },
        },
      ];

      return (
        <Tabs value={teamViewMode} onValueChange={setTeamViewMode} className="space-y-4">
          <ScopeBreadcrumb
            scopeLabel="Tổ đội"
            summaryLabel="Tổng quan"
            detailLabel="Chi tiết"
            viewMode={teamViewMode}
          />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              <TabsList className="ds-tab-list h-9 flex-nowrap gap-2">
                <TabsTrigger value="summary" className="px-3">
                  Tổng quan
                </TabsTrigger>
                <TabsTrigger value="detail" className="px-3">
                  Chi tiết
                </TabsTrigger>
              </TabsList>
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
            </div>
            <div className="flex flex-col gap-1 text-right">
              <button
                type="button"
                onClick={handleExportTeamAll}
                disabled={!canExport || exporting}
                className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                  canExport && !exporting
                    ? 'border-[color:var(--ds-border-strong)] bg-[color:var(--ds-accent)] text-[color:var(--ds-text-inverse)] hover:bg-[color:var(--ds-accent-strong)]'
                    : 'cursor-not-allowed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-disabled)]'
                }`}
              >
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
              <span className="text-[11px] text-[color:var(--ds-text-muted)]">Nhấn Ctrl+P để in nhanh toàn trang</span>
            </div>
          </div>

          <TabsContent value="summary" className="space-y-4">
            <CompanySummaryTable
              rows={filteredCompanySummaryTeam}
              includeStaff
              includeTeam
              visibleColumns={columnVisibility}
              sortKey={teamSortKey}
            />
          </TabsContent>

          <TabsContent value="detail" className="space-y-4">
            <ReportEntityTable
              columns={teamDetailColumns}
              rows={teamPageItems}
              emptyMessage="Không có tổ đội phù hợp với điều kiện lọc hiện tại."
              pagination={
                totalTeamRows
                  ? {
                      totalRows: totalTeamRows,
                      pageSize: detailPageSize,
                      pageSizeMode: detailPageSizeMode,
                      pageSizeOptions: DETAIL_PAGE_SIZE_OPTIONS,
                      onPageSizeChange: handleDetailPageSizeChange,
                      customPageSizeValue: detailPageSizeCustomInput,
                      onCustomPageSizeChange: handleDetailPageSizeCustomInputChange,
                      rangeLabel: teamRangeLabel,
                      onPrevPage: () => setTeamDetailPage((value) => Math.max(0, value - 1)),
                      onNextPage: () => setTeamDetailPage((value) => Math.min(totalTeamPages - 1, value + 1)),
                      isFirstPage: isFirstTeamPage,
                      isLastPage: isLastTeamPage,
                    }
                  : null
              }
            />
          </TabsContent>
        </Tabs>
      );
    }

    if (!activeTeam) {
      return null;
    }

    const teamDetailLabel = activeTeam?.name ? `Chi tiết – ${activeTeam.name}` : "Chi tiết";

    return (
      <Tabs value={teamViewMode} onValueChange={setTeamViewMode} className="space-y-4">
        <ScopeBreadcrumb
          scopeLabel="Tổ đội"
          summaryLabel="Tổng quan"
          detailLabel={teamDetailLabel}
          viewMode={teamViewMode}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="ds-tab-list h-9 flex-nowrap gap-2">
            <TabsTrigger value="summary" className="px-3" disabled>
              Tổng quan
            </TabsTrigger>
            <TabsTrigger value="detail" className="px-3">
              Chi tiết
            </TabsTrigger>
          </TabsList>
          <span className="text-xs text-[color:var(--ds-text-muted)]">
            Chọn “Tất cả tổ đội” để xem bảng tổng quan.
          </span>
        </div>
        <TabsContent value="summary">
          <div className="rounded border border-dashed border-[color:var(--ds-border-muted)] bg-[color:var(--ds-surface-muted)] p-6 text-center text-sm text-[color:var(--ds-text-muted)]">
            Chế độ tổng quan chỉ khả dụng khi hiển thị toàn bộ danh sách tổ đội.
          </div>
        </TabsContent>
        <TabsContent value="detail" className="space-y-4">
          <Suspense fallback={<DetailPanelSkeleton label="Đang tải chi tiết tổ đội..." />}>
            <TeamDetailCard
              team={activeTeam}
              canExport={canExport}
              onExport={() => handleExportTeamDetail(activeTeam)}
              exporting={exporting}
              visibleColumns={columnVisibility}
              memberSortKey={teamSortKey}
              detailPageSize={detailPageSize}
              detailPageSizeMode={detailPageSizeMode}
              detailPageSizeCustomInput={detailPageSizeCustomInput}
              onDetailPageSizeChange={handleDetailPageSizeChange}
              onDetailPageSizeCustomInputChange={handleDetailPageSizeCustomInputChange}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    );
  };



  const excludeCodes = Array.isArray(report.rules?.license?.exclude?.codes)

    ? report.rules.license.exclude.codes.join(", ") || "Không có"

    : "Không có";



  return (

    <div className="space-y-6">

      <div className="space-y-4 print:hidden">

        <div className="ds-card p-4">

          <ReportFilterBar

            quickRange={quickRange}

            quickRangeOptions={QUICK_RANGE_OPTIONS}

            onQuickRangeChange={handleQuickRangeChange}

            from={from}

            to={to}

            onFromChange={handleFromChange}

            onToChange={handleToChange}

            summaryLabel={filterSummaryLabel}

          />

        </div>

        {isAdmin ? (

          <ReportContextToolbar

            templateOptions={templateOptions}

            activeTemplateId={activeTemplateId}

            onTemplateChange={handleApplyTemplate}

            isTemplateDirty={isTemplateDirty}

            hasTemplates={hasTemplates}

            onSaveTemplate={handleSaveTemplateAsNew}

            onOverwriteTemplate={handleOverwriteTemplate}

            onDeleteTemplate={handleDeleteTemplate}

            canOverwriteTemplate={canOverwriteTemplate}

            canDeleteTemplate={canDeleteTemplate}

            ruleOptions={ruleOptions}

            selectedRuleId={selectedRuleId}

            onRuleChange={setSelectedRuleId}

            ruleStatusLabel={ruleStatusLabel}

            ruleMetaLabel={ruleMetaLabel}

            appliedContextLabel={appliedContextLabel}

            reportInfo={reportAdminInfo}

          />

        ) : null}

      </div>





      <KpiOverviewSection
        summary={summary}
        summaryCompanyCardValue={summaryCompanyCardValue}
        companyCardSubtitle={companyCardSubtitle}
        adjustmentsReport={adjustmentsReport}
        overviewAlerts={overviewAlerts}
        trendSeries={trendSeries}
        trendComparison={trendComparison}
        teamPieData={teamPieData}
        teamDeclPieData={teamDeclPieData}
        companyLeaderboard={companyLeaderboard}
        topCompanyPeriod={topCompanyPeriod}
        topCompanyVisibleCount={topCompanyVisibleCount}
        onTopCompanyPeriodChange={setTopCompanyPeriod}
        onTopCompanyVisibleCountChange={setTopCompanyVisibleCount}
        topStaffMetric={topStaffMetric}
        onTopStaffMetricChange={setTopStaffMetric}
        topStaffByKpi={topStaffByKpi}
        topStaffByDecls={topStaffByDecls}
        topStaffVisibleCount={topStaffVisibleCount}
        onTopStaffVisibleCountChange={setTopStaffVisibleCount}
        palette={chartPalette}
      >
        <KpiAdjustmentPanel
          adjustmentsReport={adjustmentsReport}
          paginatedAppliedAdjustments={paginatedAppliedAdjustments}
          pendingAdjustments={pendingAdjustments}
          rejectedAdjustments={rejectedAdjustments}
          adjustmentTotals={adjustmentTotals}
          adjustmentStatusStats={adjustmentStatusStats}
          adjustmentPageSize={adjustmentPageSize}
          onAdjustmentPageSizeChange={handleAdjustmentPageSizeChange}
          onAdjustmentPrev={handleAdjustmentPrev}
          onAdjustmentNext={handleAdjustmentNext}
          currentAdjustmentPage={currentAdjustmentPage}
          totalAdjustmentPages={totalAdjustmentPages}
          defaultExpanded={adjustmentExpanded}
          onModeChange={setAdjustmentExpanded}
          formatDecimal={formatDecimal}
          formatInt={formatInt}
          formatOptionalDecimal={formatOptionalDecimal}
          formatOptionalInt={formatOptionalInt}
          readOnly={adjustmentPanelReadOnly}
        />
      </KpiOverviewSection>



      <div className="ds-card space-y-4 p-4">

        <Tabs value={activeScopeTab} onValueChange={handleScopeTabChange} className="space-y-4">

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">

            <div className="flex flex-wrap items-center gap-3">

              <div className="font-semibold text-gray-900">Chế độ xem</div>

              <TabsList className="ds-tab-list h-9 flex-nowrap gap-2">

                <TabsTrigger value="staff" className="px-3">

                  Nhân viên

                </TabsTrigger>

                <TabsTrigger value="team" className="px-3">

                  Tổ đội

                </TabsTrigger>

              </TabsList>

            </div>



            <div className="ml-auto w-full min-w-[200px] basis-full sm:w-auto sm:basis-0">

              {activeScopeTab === "staff" ? (

                <select

                  className="w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"

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

                  className="w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"

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

          </div>



          <div className="flex flex-col gap-2 rounded-md border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1 text-left">
              <span className="text-sm font-semibold text-gray-900">Cột báo cáo</span>
              <span className="text-xs text-gray-500">Ẩn/hiện sẽ được áp dụng cho cả giao diện và bản in.</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto inline-flex w-full items-center justify-between gap-2 whitespace-nowrap sm:w-auto"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="size-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">{columnVisibilitySummary}</span>
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-gray-900">Chọn cột hiển thị</div>
                  <p className="text-xs text-gray-500">
                    Bật hoặc tắt các cột báo cáo phù hợp với nhu cầu của bạn.
                  </p>
                </div>
                <div className="space-y-2">
                  {COLUMN_VISIBILITY_OPTIONS.map((option) => {
                    const checked = columnVisibility[option.key] !== false;
                    const checkboxId = `column-toggle-${option.key}`;
                    return (
                      <label
                        key={option.key}
                        htmlFor={checkboxId}
                        className="flex items-center justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 text-sm transition hover:border-[color:var(--ds-border-strong)] hover:bg-[color:var(--ds-surface-muted)]"
                      >
                        <span className="flex items-center gap-2 text-gray-800">
                          <Checkbox
                            id={checkboxId}
                            checked={checked}
                            onCheckedChange={(value) =>
                              handleToggleColumnVisibility(option.key, value === true || value === "indeterminate")
                            }
                          />
                          {option.label}
                        </span>
                        <span className="text-xs text-gray-400">{checked ? "Hiển thị" : "Ẩn"}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400">
                  Thiết lập này áp dụng đồng nhất cho giao diện và bản in báo cáo.
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <TabsContent value="staff" className="space-y-4">

            {renderStaffSection()}

          </TabsContent>

          <TabsContent value="team" className="space-y-4">

            {renderTeamSection()}

          </TabsContent>

        </Tabs>

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
