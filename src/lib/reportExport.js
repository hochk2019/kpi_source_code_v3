// reportExport.js
// Backward-compatible re-export from reportExport/ barrel
// @deprecated Use @/lib/reportExport/ directly for new code

export {
  ensureWindow,
  parseFilename,
  triggerDownload,
  requestExport,
  normalizeText,
  buildCompactExportPayload,
  exportStaffReport,
  exportTeamReport,
  exportAllStaffReport,
  exportAllTeamReport,
} from './reportExport/index.js';

import { exportStaffReport, exportTeamReport, exportAllStaffReport, exportAllTeamReport } from './reportExport/index.js';

export default {
  exportStaffReport,
  exportTeamReport,
  exportAllStaffReport,
  exportAllTeamReport,
};
