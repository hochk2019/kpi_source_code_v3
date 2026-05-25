// reportExport/summarySheet.js
// Summary/aggregated report exports (future expansion)

import { requestExport, buildCompactExportPayload } from './core.js';

/**
 * Export company-wide summary report
 * @param {Object} params
 * @param {Object} params.range - Date range {from, to}
 * @param {Object} params.rules - Rule configuration
 */
export async function exportCompanySummary({ range, rules }) {
  await requestExport(
    "companySummary",
    buildCompactExportPayload({ range, rules, columns: {} }),
    "bao-cao-kpi-tong-hop-cong-ty.xlsx"
  );
}

/**
 * Export KPI adjustment summary report
 * @param {Object} params
 * @param {Object} params.range - Date range {from, to}
 */
export async function exportAdjustmentSummary({ range }) {
  await requestExport(
    "adjustmentSummary",
    buildCompactExportPayload({ range, columns: {} }),
    "bao-cao-dieu-chinh-kpi.xlsx"
  );
}

export default {
  exportCompanySummary,
  exportAdjustmentSummary,
};
