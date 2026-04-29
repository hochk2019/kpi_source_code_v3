// reportExport/index.js
// Barrel export for all report sheet types

// Core utilities
export {
  ensureWindow,
  parseFilename,
  triggerDownload,
  requestExport,
  normalizeText,
  buildCompactExportPayload,
} from './core.js';

// Staff sheets
export {
  exportStaffReport,
  exportAllStaffReport,
} from './staffSheet.js';

// Team sheets
export {
  exportTeamReport,
  exportAllTeamReport,
} from './teamSheet.js';

// Summary sheets (future expansion)
export {
  exportCompanySummary,
  exportAdjustmentSummary,
} from './summarySheet.js';

// Default export combining all
import * as staff from './staffSheet.js';
import * as team from './teamSheet.js';

export default {
  ...staff,
  ...team,
};
