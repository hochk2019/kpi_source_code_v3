import { useEffect, useRef } from 'react';

import { recordMetric } from '@/lib/perfMonitor.js';

const hasPerformance = typeof performance !== 'undefined' && typeof performance.now === 'function';

function getNow() {
  if (hasPerformance) {
    return performance.now();
  }
  return Date.now();
}

export default function useRenderMetrics(name, detailFactory) {
  const startRef = useRef(getNow());
  startRef.current = getNow();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const duration = Math.max(0, getNow() - startRef.current);
    let detail;
    try {
      detail = typeof detailFactory === 'function' ? detailFactory() : detailFactory;
    } catch (error) {
      detail = { error: error?.message || 'Không thể thu thập chi tiết render' };
    }
    recordMetric({
      source: 'render',
      name: name || 'component',
      value: duration,
      unit: 'ms',
      detail,
    });
    return undefined;
  });
}
