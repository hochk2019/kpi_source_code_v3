// Domain barrel: MST Assignment Store
// Re-exports MST assignment operations

export {
  // Keys
  MST_KEY,
  MST_HISTORY_KEY,
  LEGACY_MST_KEY,
} from '../storeRuntime.js';

export {
  MST_ASSIGNMENT_STATUS,
} from '../mstAssignments.js';

// Read operations
export {
  getMSTRowsRaw,
  getMSTMap,
  getMSTFor,
  getMSTHistoryEntries,
  getMSTHistoryFor,
} from '../storeRuntime.js';

// Write operations
export {
  setMSTRows,
  assignMST,
  unassignMST,
} from '../mstAssignments.js';

// Helpers
export {
  normalizeMST,
  extractMSTFromDeclRow,
} from '../storeRuntime.js';
