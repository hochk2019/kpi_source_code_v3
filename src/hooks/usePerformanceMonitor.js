import { useEffect } from 'react';

import { startPerformanceMonitoring } from '@/lib/perfMonitor.js';

export default function usePerformanceMonitor(enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }
    const stop = startPerformanceMonitoring();
    return () => {
      try {
        stop?.();
      } catch (error) {
        console.error('Không thể dừng theo dõi hiệu năng', error);
      }
    };
  }, [enabled]);
}
