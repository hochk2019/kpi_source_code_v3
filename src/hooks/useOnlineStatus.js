import { useCallback, useEffect, useState } from "react";

/**
 * Hook to track online/offline status with visibility-aware revalidation
 * @returns {object} Online status and helper functions
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Re-check online status when tab becomes visible
        setIsOnline(navigator.onLine);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const resetWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    resetWasOffline,
  };
}

/**
 * Hook to queue actions when offline and execute when back online
 * @returns {object} Queue management functions
 */
export function useOfflineQueue() {
  const [queue, setQueue] = useState([]);
  const { isOnline } = useOnlineStatus();

  const addToQueue = useCallback((action) => {
    setQueue((prev) => [...prev, { id: crypto.randomUUID(), ...action }]);
  }, []);

  const removeFromQueue = useCallback((id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // Process queue when back online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      // Execute queued actions
      queue.forEach((action) => {
        if (typeof action.execute === "function") {
          action.execute().catch(() => {
            // Keep in queue if failed
          });
        }
      });
    }
  }, [isOnline, queue]);

  return {
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    queueLength: queue.length,
  };
}
