// useDataImporterSyncOrchestrator.js
// Phase 1: Re-export from main hook
// Phase 2: Extract orchestration logic (executeSyncJob, polling, run/resume)

import useDataImporterSync from './useDataImporterSync.js';

/**
 * Hook for sync orchestration - handles job execution and polling
 * 
 * TODO Phase 2: Extract these from useDataImporterSync:
 * - executeSyncJob() - main execution with retry logic
 * - handleRunSync() - start new sync job
 * - handleResumeSync() - resume from persisted job state
 * - Polling logic for job status
 */
export function useDataImporterSyncOrchestrator(params) {
  const sync = useDataImporterSync(params);

  return {
    // Execution state
    syncLoading: sync.syncLoading,
    syncRunning: sync.syncRunning,
    syncMessage: sync.syncMessage,
    syncError: sync.syncError,
    
    // Progress steps
    syncProgressSteps: sync.syncProgressSteps,
    
    // Resume capability
    syncResumeJob: sync.syncResumeJob,
    syncResumeLabel: sync.syncResumeLabel,
    
    // Preflight checks
    syncPreflightChecks: sync.syncPreflightChecks,
    syncPreflightSummary: sync.syncPreflightSummary,
    
    // Actions
    handleRunSync: sync.handleRunSync,
    handleResumeSync: sync.handleResumeSync,
    fetchSyncStatus: sync.fetchSyncStatus,
  };
}

export default useDataImporterSyncOrchestrator;
