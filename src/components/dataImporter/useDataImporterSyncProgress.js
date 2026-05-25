// useDataImporterSyncProgress.js
// Phase 1: Re-export from main hook
// Phase 2: Extract progress tracking logic

import useDataImporterSync from './useDataImporterSync.js';

/**
 * Hook for sync progress tracking - job state, history, and logging
 * 
 * TODO Phase 2: Extract these from useDataImporterSync:
 * - Job state management (syncJobState)
 * - Activity log (syncActivityLog)
 * - History tracking (syncHistory)
 * - Progress step calculation
 */
export function useDataImporterSyncProgress(params) {
  const sync = useDataImporterSync(params);

  return {
    // Progress tracking
    syncProgressSteps: sync.syncProgressSteps,
    syncActivityLog: sync.syncActivityLog,
    
    // History
    syncHistory: sync.syncHistory,
    
    // Resume state
    syncResumeJob: sync.syncResumeJob,
    syncResumeLabel: sync.syncResumeLabel,
    
    // Alerts (progress monitoring)
    alertSummary: sync.alertSummary,
    alertEntries: sync.alertEntries,
    alertLoading: sync.alertLoading,
    handleRefreshAlerts: sync.handleRefreshAlerts,
    
    // Status monitoring
    statusInfo: sync.statusInfo,
    statusLoading: sync.statusLoading,
    statusError: sync.statusError,
    fetchSyncStatus: sync.fetchSyncStatus,
  };
}

export default useDataImporterSyncProgress;
