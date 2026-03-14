import { useEffect, useRef } from "react";

export default function useDataImporterSyncStatusToast({
  getSyncStatus,
  subscribeSyncStatus,
  storageLimitErrorMessage,
  notifyError,
}) {
  const lastSyncToastMessageRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const initialStatus = getSyncStatus?.();
    const initialError = initialStatus?.lastError;

    if (initialError === storageLimitErrorMessage) {
      lastSyncToastMessageRef.current = initialError;
      notifyError?.(initialError);
    }

    const unsubscribe = subscribeSyncStatus?.((status) => {
      const message = status?.lastError;

      if (message === storageLimitErrorMessage && message !== lastSyncToastMessageRef.current) {
        lastSyncToastMessageRef.current = message;
        notifyError?.(message);
      } else if (!message && lastSyncToastMessageRef.current) {
        lastSyncToastMessageRef.current = "";
      }
    });

    return () => {
      lastSyncToastMessageRef.current = "";
      unsubscribe?.();
    };
  }, [getSyncStatus, notifyError, storageLimitErrorMessage, subscribeSyncStatus]);
}
