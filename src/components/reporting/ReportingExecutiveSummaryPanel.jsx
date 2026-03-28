import React, { useMemo } from "react";

import { buildExecutiveSummaryModel } from "@/components/reporting/reportingExecutiveSummaryModel.js";

const TONE_CLASS_MAP = {
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function formatHighlightValue(highlight, formatInt, formatDecimal) {
  if (!highlight) {
    return "—";
  }

  if (highlight.valueType === "int") {
    return formatInt(highlight.value);
  }

  if (highlight.valueType === "decimal") {
    return formatDecimal(highlight.value);
  }

  return highlight.value || "—";
}

export function ReportingExecutiveSummaryPanel({
  summary = {},
  adjustmentsReport = {},
  trendComparison = null,
  topStaffByKpi = [],
  teamPieData = [],
  formatInt,
  formatDecimal,
}) {
  const executiveSummary = useMemo(
    () =>
      buildExecutiveSummaryModel({
        summary,
        adjustmentsReport,
        trendComparison,
        topStaffByKpi,
        teamPieData,
      }),
    [summary, adjustmentsReport, trendComparison, topStaffByKpi, teamPieData],
  );

  return (
    <section className="ds-card space-y-4 p-4" aria-label="Tóm tắt điều hành KPI">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900">Tóm tắt điều hành KPI</h3>
          <p className="text-sm text-gray-500">
            Nêu nhanh tín hiệu tháng hiện tại để lãnh đạo chốt nhịp KPI trước khi drill-down chi tiết.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {executiveSummary.highlights.map((highlight) => (
          <div
            key={highlight.title}
            className="rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{highlight.title}</div>
            <div className="mt-2 text-lg font-semibold text-gray-900">
              {formatHighlightValue(highlight, formatInt, formatDecimal)}
            </div>
            <div className="mt-1 text-xs text-gray-500">{highlight.subtitle}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Tín hiệu lệch chuẩn</div>
        {executiveSummary.signals.length ? (
          <div className="grid gap-2">
            {executiveSummary.signals.map((signal) => (
              <div
                key={`${signal.tone}-${signal.title}`}
                className={`rounded-xl border px-3 py-2 text-sm ${TONE_CLASS_MAP[signal.tone] || TONE_CLASS_MAP.warning}`}
              >
                <div className="font-semibold">{signal.title}</div>
                <div className="mt-1 text-xs leading-relaxed">{signal.detail}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Không phát hiện lệch chuẩn nổi bật trong kỳ hiện tại.</p>
        )}
      </div>
    </section>
  );
}
