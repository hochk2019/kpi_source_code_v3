import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart.jsx";

const DEFAULT_CHART_COLORS = ["#2563eb", "#22c55e", "#f97316", "#a855f7", "#14b8a6"];
const TOP_STAFF_VISIBLE_COUNT_OPTIONS = [5, 7, 8, 9, 10, 12, 15];
const TOP_STAFF_VISIBLE_COUNT_SET = new Set(TOP_STAFF_VISIBLE_COUNT_OPTIONS);
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

function TeamMetricPieCard({ title, data, valueFormatter, percentLabel, emptyMessage, palette = DEFAULT_CHART_COLORS }) {
  const normalizedData = Array.isArray(data)
    ? data.map((item = {}) => ({
      name: item.name || "",
      value: Number(item.value || 0),
    }))
    : [];
  const total = normalizedData.reduce((sum, item) => sum + item.value, 0);
  const colors = Array.isArray(palette) && palette.length ? palette : DEFAULT_CHART_COLORS;

  const segments = [];
  let cursor = 0;
  normalizedData.forEach((item, index) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    const start = cursor;
    const end = cursor + percent;
    segments.push(`${colors[index % colors.length]} ${start}% ${end}%`);
    cursor = end;
  });

  const gradient = segments.length ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#e5e7eb 0 100%)";

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-40 w-40 flex-shrink-0 rounded-full border border-subtle" style={{ backgroundImage: gradient }}>
          {total === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">Không có dữ liệu</div>
          ) : null}
        </div>
        <ul className="w-full space-y-2 text-sm">
          {normalizedData.length ? (
            normalizedData.map((item, index) => {
              const color = colors[index % colors.length];
              const percent = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0;
              return (
                <li key={`${title}-${item.name}-${index}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
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

export function TopStaffWidget({
  metric = "kpi",
  onMetricChange,
  kpiData = [],
  declData = [],
  palette = DEFAULT_CHART_COLORS,
  visibleCountPreference = "auto",
  onVisibleCountPreferenceChange,
  formatInt,
  formatDecimal,
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
      setAutoVisibleCount((previous) => (previous === next ? previous : next));
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
  const displayedDeclData = useMemo(() => declData.slice(0, Math.max(visibleCount, 1)), [declData, visibleCount]);

  const hasKpiData = displayedKpiData.length > 0;
  const hasDeclData = displayedDeclData.length > 0;
  const hasData = metric === "kpi" ? hasKpiData : hasDeclData;
  const maxKPI = hasKpiData ? Math.max(...displayedKpiData.map((item) => item.stats.kpi || 0), 1) : 1;
  const totalDecls = hasDeclData ? displayedDeclData.reduce((sum, item) => sum + (item.decls || 0), 0) : 0;
  const colors = Array.isArray(palette) && palette.length ? palette : DEFAULT_CHART_COLORS;
  const totalEntries = metric === "kpi" ? kpiData.length : declData.length;
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
    resolvedPreference === "auto" ? "Tự động theo chiều cao màn hình" : `${resolvedPreference} nhân viên (cố định)`;
  const renderEmptyState = <p className="mt-3 text-sm text-gray-500">Chưa có dữ liệu hợp lệ trong giai đoạn này.</p>;

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
              className={`rounded px-3 py-1.5 ${metric === "kpi" ? "bg-black text-white" : "border bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
              Điểm KPI
            </button>
            <button
              type="button"
              onClick={() => onMetricChange?.("decls")}
              className={`rounded px-3 py-1.5 ${metric === "decls" ? "bg-black text-white" : "border bg-white text-gray-700 hover:bg-gray-50"
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
          {displayedKpiData.map((item, index) => {
            const ratio = Math.max(0, Math.min(100, (item.stats.kpi / maxKPI) * 100));
            const color = colors[index % colors.length];
            return (
              <div key={item.key || index}>
                <div className="flex items-baseline justify-between text-sm">
                  <div className="font-medium text-gray-900">
                    {index + 1}. {item.name}
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
        <div className="mt-4 w-full" style={{ height: Math.max(220, visibleEntries * 44) }}>
          <ChartContainer config={{ decls: { label: "Tờ khai", color: colors[0] } }} className="h-full w-full">
            <BarChart
              layout="vertical"
              data={displayedDeclData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={formatInt} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(label, payload) => {
                      const entry = payload && payload[0] && payload[0].payload;
                      if (entry?.team && entry.team !== "Chưa gán tổ đội") {
                        return `${label} — ${entry.team}`;
                      }
                      return label;
                    }}
                  />
                }
              />
              <Bar dataKey="decls" name="Tờ khai" radius={[0, 4, 4, 0]}>
                {displayedDeclData.map((item, index) => (
                  <Cell key={item.key || item.name || index} fill={colors[index % colors.length]} />
                ))}
                <LabelList dataKey="decls" position="right" formatter={(value) => formatInt(value)} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}

      <div className="mt-3 space-y-1 text-xs leading-relaxed">
        {metric !== "kpi" && hasDeclData ? <p className="text-gray-500">Tổng: {formatInt(totalDecls)} tờ khai</p> : null}
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

export function TeamPieWidget({ kpiData, declData, palette = DEFAULT_CHART_COLORS, formatInt, formatDecimal }) {
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

export function TrendLineChart({ data, comparison, palette = DEFAULT_CHART_COLORS }) {
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

  const chartConfig = {
    kpi: {
      label: "Điểm KPI",
      color: kpiColor,
    },
    decls: {
      label: "Tờ khai",
      color: declColor,
    },
  };

  return (
    <section className="ds-card space-y-4 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">Xu hướng KPI 6 kỳ gần nhất</h3>
        {comparison ? (
          <div className="text-xs text-gray-500">
            So với kỳ liền trước:
            <span className={`ml-1 font-medium ${deltaClass}`}>
              {deltaKPI > 0 ? "+" : ""}
              {deltaKPI.toFixed(1)} điểm KPI
            </span>
            {deltaPercent !== null ? (
              <span className={`ml-1 ${deltaClass}`}>
                ({deltaPercent > 0 ? "+" : ""}
                {deltaPercent.toFixed(1)}%)
              </span>
            ) : null}
            <span className="ml-2 text-gray-400">
              • {deltaDecls > 0 ? "+" : ""}
              {deltaDecls} tờ khai
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-4 h-64 w-full">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis yAxisId="left" stroke="var(--color-kpi)" tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" stroke="var(--color-decls)" tickLine={false} axisLine={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="kpi" name="Điểm KPI" stroke="var(--color-kpi)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line yAxisId="right" type="monotone" dataKey="decls" name="Tờ khai" stroke="var(--color-decls)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ChartContainer>
      </div>
    </section>
  );
}

export function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="ds-card p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-gray-500">{subtitle}</div> : null}
    </div>
  );
}
