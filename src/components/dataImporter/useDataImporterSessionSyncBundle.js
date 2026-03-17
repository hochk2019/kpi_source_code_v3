import useDataImporterCoMonitoring from "@/components/dataImporter/useDataImporterCoMonitoring.js";
import useDataImporterWorkflowSession from "@/components/dataImporter/useDataImporterWorkflowSession.js";

export default function useDataImporterSessionSyncBundle({
  canManageSync,
  fetchWithAuth,
  extractErrorMessage,
  ...workflowSessionProps
}) {
  const coMonitoring = useDataImporterCoMonitoring({
    canManageSync,
    fetchWithAuth,
    extractErrorMessage,
  });

  const workflowSession = useDataImporterWorkflowSession({
    ...workflowSessionProps,
    canManageSync,
    fetchWithAuth,
    handleRefreshCoDiscrepancy: coMonitoring.handleRefreshCoDiscrepancy,
  });

  return {
    ...coMonitoring,
    ...workflowSession,
  };
}
