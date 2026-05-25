// Domain barrel: Declaration Store
// Re-exports declaration-related operations from specialized stores

export {
  // Keys
  DECL_KEY,
  DECL_HISTORY_KEY,
  DECL_DELETED_LOG_KEY,
  DECL_DELETED_LOG_LIMIT,
} from '../storeRuntime.js';

// Read operations
export {
  getDeclRows,
  getDeclRowsRaw,
  getRecentDeclRows,
  sortDeclRows,
  getData,
  useDeclData,
} from '../declReadStore.js';

// Write operations
export {
  previewDeclRows,
  writeDeclRows,
  mergeDeclRows,
  overwriteDeclRows,
  deleteDeclRows,
  patchDeclRowsClient,
} from '../declWriteStore.js';

// Mutation operations
export {
  computeDeclMutation,
  applyDeclMutation,
  previewDeclMutation,
} from '../declMutationStore.js';

// Helpers
export {
  normalizeDeclarationRow,
  getDeclarationKey,
  mergeDeclarationRowClient,
  isExportDecl,
  isImportDecl,
  isExportByNumber,
  isImportByNumber,
  isExportByType,
  isImportByType,
} from '../storeRuntime.js';
