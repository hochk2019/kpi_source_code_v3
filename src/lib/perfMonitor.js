const MAX_METRIC_EVENTS = 300;
const STORAGE_KEY = 'kpi_perf_metrics_v1';

const listeners = new Set();
const metricBuffer = [];
let webVitalsStarted = false;
let loadedFromStorage = false;

function safeTruncate(value, maxLength = 160) {
  if (typeof value !== 'string') return value;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function safeSerialize(detail, depth = 0) {
  if (detail == null) {
    return undefined;
  }
  if (depth > 3) {
    if (Array.isArray(detail)) {
      return detail.length;
    }
    if (typeof detail === 'object') {
      return Object.keys(detail).length;
    }
    return undefined;
  }
  const type = typeof detail;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return type === 'string' ? safeTruncate(detail, 240) : detail;
  }
  if (Array.isArray(detail)) {
    return detail.slice(0, 6).map((item) => safeSerialize(item, depth + 1));
  }
  if (type === 'object') {
    const result = {};
    let count = 0;
    for (const [key, value] of Object.entries(detail)) {
      result[key] = safeSerialize(value, depth + 1);
      count += 1;
      if (count >= 12) {
        break;
      }
    }
    return result;
  }
  return undefined;
}

function describeNode(node) {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  const tag = node.tagName ? node.tagName.toLowerCase() : node.nodeName?.toLowerCase();
  const id = typeof node.id === 'string' && node.id ? `#${node.id}` : '';
  let className = '';
  if (typeof node.className === 'string' && node.className.trim()) {
    className = `.${node.className.trim().split(/\s+/).slice(0, 3).join('.')}`;
  }
  return tag ? `${tag}${id}${className}` : undefined;
}

function clampBuffer() {
  const overflow = metricBuffer.length - MAX_METRIC_EVENTS;
  if (overflow > 0) {
    metricBuffer.splice(0, overflow);
  }
}

function persistBuffer() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const payload = JSON.stringify(metricBuffer);
    window.sessionStorage?.setItem(STORAGE_KEY, payload);
  } catch (error) {
    console.warn('Không thể lưu cache hiệu năng', error);
  }
}

function ensureStorageLoaded() {
  if (loadedFromStorage || typeof window === 'undefined') {
    return;
  }
  loadedFromStorage = true;
  try {
    const cached = window.sessionStorage?.getItem(STORAGE_KEY);
    if (!cached) {
      return;
    }
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (item && typeof item === 'object') {
          metricBuffer.push(item);
        }
      });
      clampBuffer();
    }
  } catch (error) {
    console.warn('Không thể đọc cache hiệu năng', error);
  }
}

function notify() {
  if (listeners.size === 0) {
    return;
  }
  const snapshot = metricBuffer.slice();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('Performance listener error', error);
    }
  });
}

export function recordMetric({
  source = 'custom',
  name = 'unknown',
  value = null,
  detail,
  unit,
  rating,
  meta,
  timestamp,
}) {
  ensureStorageLoaded();
  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    source,
    name,
    value: typeof value === 'number' ? value : null,
    unit: typeof unit === 'string' && unit ? unit : undefined,
    rating,
    detail: safeSerialize(detail),
    meta: safeSerialize(meta),
    createdAt: typeof timestamp === 'number' ? timestamp : Date.now(),
  };
  metricBuffer.push(entry);
  clampBuffer();
  persistBuffer();
  notify();
  return entry;
}

export function getPerformanceMetrics() {
  ensureStorageLoaded();
  return metricBuffer.slice();
}

export function subscribePerformanceMetrics(listener) {
  ensureStorageLoaded();
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  try {
    listener(metricBuffer.slice());
  } catch (error) {
    console.error('Performance listener error during subscription', error);
  }
  return () => {
    listeners.delete(listener);
  };
}

function summarizeAttribution(attribution) {
  if (!attribution || typeof attribution !== 'object') {
    return undefined;
  }
  const summary = {};
  if (attribution.loadState) {
    summary.loadState = attribution.loadState;
  }
  if (attribution.navigationType) {
    summary.navigationType = attribution.navigationType;
  }
  if (typeof attribution.largestShiftTime === 'number') {
    summary.largestShiftTime = Math.round(attribution.largestShiftTime);
  }
  if (attribution.largestShiftTarget) {
    summary.largestShiftTarget = describeNode(attribution.largestShiftTarget) || undefined;
  }
  if (typeof attribution.inputDelay === 'number') {
    summary.inputDelay = Math.round(attribution.inputDelay);
  }
  if (typeof attribution.processingTime === 'number') {
    summary.processingTime = Math.round(attribution.processingTime);
  }
  if (typeof attribution.presentationDelay === 'number') {
    summary.presentationDelay = Math.round(attribution.presentationDelay);
  }
  if (typeof attribution.timeToFirstByte === 'number') {
    summary.timeToFirstByte = Math.round(attribution.timeToFirstByte);
  }
  if (typeof attribution.eventEntry === 'object' && attribution.eventEntry) {
    const { name, startTime, duration } = attribution.eventEntry;
    summary.eventName = name;
    if (typeof startTime === 'number') {
      summary.eventStart = Math.round(startTime);
    }
    if (typeof duration === 'number') {
      summary.eventDuration = Math.round(duration);
    }
  }
  if (typeof attribution.interactionType === 'string') {
    summary.interactionType = attribution.interactionType;
  }
  if (typeof attribution.interactionTarget === 'string') {
    summary.interactionTarget = attribution.interactionTarget;
  }
  return summary;
}

function recordWebVital(metric) {
  if (!metric || typeof metric !== 'object') {
    return;
  }
  recordMetric({
    source: 'web-vitals',
    name: metric.name || 'web-vital',
    value: metric.value,
    unit: metric.name === 'CLS' ? undefined : 'ms',
    rating: metric.rating,
    detail: {
      id: metric.id,
      value: metric.value,
      delta: metric.delta,
      navigationType: metric.navigationType,
      entries: Array.isArray(metric.entries)
        ? metric.entries.slice(0, 4).map((entry) => ({
            name: entry.name,
            entryType: entry.entryType,
            startTime: Math.round(entry.startTime ?? 0),
            duration: Math.round(entry.duration ?? 0),
          }))
        : undefined,
      attribution: summarizeAttribution(metric.attribution),
    },
  });
}

export function startPerformanceMonitoring() {
  if (typeof window === 'undefined') {
    return () => {};
  }
  ensureStorageLoaded();
  if (webVitalsStarted) {
    return () => {};
  }
  webVitalsStarted = true;
  const cleanups = [];

  import('web-vitals/attribution')
    .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      try {
        onCLS(recordWebVital);
        onFCP(recordWebVital);
        onINP(recordWebVital);
        onLCP(recordWebVital);
        onTTFB(recordWebVital);
      } catch (error) {
        console.error('Không thể đăng ký Web Vitals', error);
      }
    })
    .catch((error) => {
      console.error('Không thể tải thư viện Web Vitals', error);
    });

  if (typeof PerformanceObserver === 'function') {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          recordMetric({
            source: 'longtask',
            name: entry.name || 'longtask',
            value: entry.duration,
            unit: 'ms',
            detail: {
              startTime: Math.round(entry.startTime || 0),
              attribution: Array.isArray(entry.attribution)
                ? entry.attribution.slice(0, 5).map((item) => ({
                    name: item.name,
                    entryType: item.entryType,
                    duration: Math.round(item.duration ?? 0),
                  }))
                : undefined,
            },
          });
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      cleanups.push(() => longTaskObserver.disconnect());
    } catch (error) {
      console.warn('Không thể khởi tạo PerformanceObserver longtask', error);
    }
  }

  if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    try {
      const navigationEntries = performance.getEntriesByType('navigation');
      navigationEntries.forEach((entry) => {
        recordMetric({
          source: 'navigation',
          name: entry.type || 'navigation',
          value: entry.duration,
          unit: 'ms',
          detail: {
            domContentLoaded: Math.round(entry.domContentLoadedEventEnd || 0),
            domInteractive: Math.round(entry.domInteractive || 0),
            loadEventEnd: Math.round(entry.loadEventEnd || 0),
            transferSize: entry.transferSize,
          },
        });
      });
    } catch (error) {
      console.warn('Không thể ghi nhận navigation timing', error);
    }
  }

  return () => {
    cleanups.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.error('Lỗi khi dừng theo dõi hiệu năng', error);
      }
    });
  };
}
