// reportExport/staffSheet.js
// Staff detail and summary sheet exports

import { requestExport, buildCompactExportPayload, normalizeText } from './core.js';

/**
 * Export single staff detail report
 * @param {Object} params
 * @param {Object} params.staff - Staff info with name and key
 * @param {Object} params.range - Date range {from, to}
 * @param {Object} params.rules - Rule configuration
 * @param {Object} params.columns - Column configuration
 */
export async function exportStaffReport({ staff, range, rules, columns }) {
  const fallback = `bao-cao-kpi-nhan-vien-${(staff?.name || "chua-gan").replace(/\s+/g, "-")}.xlsx`;
  await requestExport(
    "staff",
    buildCompactExportPayload({ staff, range, rules, columns }),
    fallback.toLowerCase()
  );
}

/**
 * Export all staff summary report
 * @param {Object} params
 * @param {Object} params.range - Date range {from, to}
 * @param {Object} params.rules - Rule configuration
 * @param {Object} params.columns - Column configuration
 */
export async function exportAllStaffReport({ range, rules, columns }) {
  await requestExport(
    "allStaff",
    buildCompactExportPayload({ range, rules, columns }),
    "bao-cao-kpi-nhan-vien-tong-hop.xlsx"
  );
}

export default {
  exportStaffReport,
  exportAllStaffReport,
};
