import React from "react";

import {
  SummaryCard,
  TeamPieWidget,
  TopStaffWidget,
  TrendLineChart,
} from "@/components/reporting/ReportingOverviewWidgets.jsx";
import { ReportingAdjustmentsPanel } from "@/components/reporting/ReportingAdjustmentsPanel.jsx";
import { ReportingExecutiveSummaryPanel } from "@/components/reporting/ReportingExecutiveSummaryPanel.jsx";

export function ReportingDashboardOverview({
  summary = {},
  adjustmentsReport = {},
  summaryCompanyCardValue = 0,
  companyCardSubtitle = "—",
  trendSeries = [],
  trendComparison = null,
  chartPalette,
  teamPieData = [],
  teamDeclPieData = [],
  topStaffMetric = "kpi",
  onTopStaffMetricChange,
  topStaffByKpi = [],
  topStaffByDecls = [],
  topStaffVisibleCount = "auto",
  onTopStaffVisibleCountChange,
  adjustmentPage = 0,
  adjustmentPageSize = 10,
  onAdjustmentPageChange,
  onAdjustmentPageSizeChange,
  formatInt,
  formatDecimal,
}) {
  const summaryCards = [
    {
      title: "Tổng tờ khai",
      value: formatInt(summary.decls),
      subtitle: `Nhập: ${formatInt(summary.import)} • Xuất: ${formatInt(summary.export)}`,
    },
    {
      title: "Tổng điểm KPI",
      value: formatDecimal(summary.kpi),
      subtitle: "Bao gồm điểm loại hình và giấy phép",
    },
    {
      title: "Điểm KPI +/- bổ sung",
      value: formatDecimal(adjustmentsReport.totalPoints || 0),
      subtitle: `Đã duyệt: ${formatInt(adjustmentsReport.approvedCount || 0)} • Chờ duyệt: ${formatInt(
        adjustmentsReport.pendingCount || 0,
      )}`,
    },
    {
      title: "Tổng số công ty",
      value: formatInt(summaryCompanyCardValue),
      subtitle: companyCardSubtitle,
    },
    {
      title: "Số giấy phép hợp lệ",
      value: formatInt(summary.licenses),
      subtitle: `Đã loại trừ • ${formatInt(summary.licenseCount ?? 0)} mã khác nhau`,
    },
    {
      title: "Tờ khai có C/O",
      value: formatInt(summary.co ?? 0),
      subtitle: `Tổng dòng áp C/O: ${formatInt(summary.coLines ?? 0)}`,
    },
    {
      title: "Danh sách mã giấy phép",
      value: formatInt(summary.licenseCount ?? 0),
      subtitle: summary.licenseSummary || "—",
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <ReportingExecutiveSummaryPanel
          summary={summary}
          adjustmentsReport={adjustmentsReport}
          trendComparison={trendComparison}
          topStaffByKpi={topStaffByKpi}
          teamPieData={teamPieData}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.title}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
            />
          ))}
        </div>

        <TrendLineChart data={trendSeries} comparison={trendComparison} palette={chartPalette} />

        <TeamPieWidget
          kpiData={teamPieData}
          declData={teamDeclPieData}
          palette={chartPalette}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
        />
      </div>

      <div className="space-y-6">
        <TopStaffWidget
          metric={topStaffMetric}
          onMetricChange={onTopStaffMetricChange}
          kpiData={topStaffByKpi}
          declData={topStaffByDecls}
          palette={chartPalette}
          visibleCountPreference={topStaffVisibleCount}
          onVisibleCountPreferenceChange={onTopStaffVisibleCountChange}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
        />
      </div>

      <ReportingAdjustmentsPanel
        adjustmentsReport={adjustmentsReport}
        adjustmentPage={adjustmentPage}
        adjustmentPageSize={adjustmentPageSize}
        onAdjustmentPageChange={onAdjustmentPageChange}
        onAdjustmentPageSizeChange={onAdjustmentPageSizeChange}
        formatInt={formatInt}
        formatDecimal={formatDecimal}
      />
    </div>
  );
}
