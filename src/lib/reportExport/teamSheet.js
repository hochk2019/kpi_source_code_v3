// reportExport/teamSheet.js
// Team detail and summary sheet exports

import { requestExport, buildCompactExportPayload } from './core.js';

/**
 * Export single team detail report
 * @param {Object} params
 * @param {Object} params.team - Team info with name and key
 * @param {Object} params.range - Date range {from, to}
 * @param {Object} params.rules - Rule configuration
 * @param {Object} params.columns - Column configuration
 */
export async function exportTeamReport({ team, range, rules, columns }) {
  const fallback = `bao-cao-kpi-to-doi-${(team?.name || "chua-gan").replace(/\s+/g, "-")}.xlsx`;
  await requestExport(
    "team",
    buildCompactExportPayload({ team, range, rules, columns }),
    fallback.toLowerCase()
  );
}

/**
 * Export all teams summary report
 * @param {Object} params
 * @param {Object} params.range - Date range {from, to}
 * @param {Object} params.rules - Rule configuration
 * @param {Object} params.columns - Column configuration
 */
export async function exportAllTeamReport({ range, rules, columns }) {
  await requestExport(
    "allTeam",
    buildCompactExportPayload({ range, rules, columns }),
    "bao-cao-kpi-to-doi-tong-hop.xlsx"
  );
}

export default {
  exportTeamReport,
  exportAllTeamReport,
};
