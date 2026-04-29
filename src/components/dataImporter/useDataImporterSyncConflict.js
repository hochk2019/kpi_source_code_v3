// useDataImporterSyncConflict.js
// Phase 1: Re-export from main hook
// Phase 2: Extract conflict detection logic

import useDataImporterSync from './useDataImporterSync.js';

/**
 * Hook for sync conflict resolution - preview and conflict detection
 * 
 * TODO Phase 2: Extract these from useDataImporterSync:
 * - handlePreviewSync() - fetch preview data
 * - Preview conflict detection (summarizePreviewConflictRows)
 * - Conflict summary calculation
 * - Overwrite confirmation logic
 */
export function useDataImporterSyncConflict(params) {
  const sync = useDataImporterSync(params);

  return {
    // Preview data
    previewRows: sync.previewRows,
    previewLimited: sync.previewLimited,
    previewLoading: sync.previewLoading,
    previewError: sync.previewError,
    previewRangeInfo: sync.previewRangeInfo,
    previewRangeLabel: sync.previewRangeLabel,
    
    // Conflict detection
    previewConflictSummary: sync.previewConflictSummary,
    previewConflictWarningActive: sync.previewConflictWarningActive,
    
    // Filter config
    activeIncludeTaxCodes: sync.activeIncludeTaxCodes,
    activeExcludeTaxCodes: sync.activeExcludeTaxCodes,
    mstFilterNotice: sync.mstFilterNotice,
    
    // Actions
    handlePreviewSync: sync.handlePreviewSync,
    handleManualRangeChange: sync.handleManualRangeChange,
    
    // Range state (needed for preview)
    manualRange: sync.manualRange,
    setManualRange: sync.setManualRange,
  };
}

export default useDataImporterSyncConflict;
