const TELEMETRY_STORAGE_KEY = 'kpi_frontend_performance_telemetry_v1';
const MAX_RENDER_EVENTS = 240;
const MAX_VITAL_EVENTS = 120;

export const DEFAULT_SLOW_SCREEN_THRESHOLD_MS = 800;

const LISTENERS = new Set();
let storageListenerBound = false;

function safeIsoTimestamp(value = Date.now()) {
  try {
    return new Date(value).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function clampNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return num;
}

function trimString(value, maxLength = 80) {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }
  return normalized.slice(0, maxLength);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sanitizeRenderEvent(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const screen = trimString(entry.screen, 120);
  if (!screen) {
    return null;
  }
  const durationMs = Math.max(0, round(clampNumber(entry.durationMs)));
  return {
    id: trimString(entry.id, 120) || `render_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    screen,
    durationMs,
    slowThresholdMs: Math.max(1, round(clampNumber(entry.slowThresholdMs, DEFAULT_SLOW_SCREEN_THRESHOLD_MS))),
    source: trimString(entry.source, 80) || 'unknown',
    deviceHint: trimString(entry.deviceHint, 120),
    occurredAt: safeIsoTimestamp(entry.occurredAt),
  };
}

function sanitizeVitalEvent(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const name = trimString(entry.name, 40).toUpperCase();
  if (!name) {
    return null;
  }
  const value = round(clampNumber(entry.value));
  const delta = entry.delta == null ? null : round(clampNumber(entry.delta));
  return {
    id: trimString(entry.id, 120) || `vital_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    name,
    value,
    delta,
    rating: trimString(entry.rating, 32).toLowerCase() || 'info',
    source: trimString(entry.source, 80) || 'unknown',
    occurredAt: safeIsoTimestamp(entry.occurredAt),
  };
}

function createEmptyState() {
  return {
    version: 1,
    updatedAt: safeIsoTimestamp(),
    renderEvents: [],
    vitalEvents: [],
  };
}

function normalizeState(rawState) {
  const state = rawState && typeof rawState === 'object' ? rawState : {};
  const renderEvents = (Array.isArray(state.renderEvents) ? state.renderEvents : [])
    .map(sanitizeRenderEvent)
    .filter(Boolean)
    .slice(-MAX_RENDER_EVENTS);
  const vitalEvents = (Array.isArray(state.vitalEvents) ? state.vitalEvents : [])
    .map(sanitizeVitalEvent)
    .filter(Boolean)
    .slice(-MAX_VITAL_EVENTS);
  return {
    version: 1,
    updatedAt: safeIsoTimestamp(state.updatedAt),
    renderEvents,
    vitalEvents,
  };
}

function readTelemetryState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createEmptyState();
  }
  try {
    const raw = window.localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) {
      return createEmptyState();
    }
    return normalizeState(JSON.parse(raw));
  } catch {
    return createEmptyState();
  }
}

function writeTelemetryState(state) {
  const normalized = normalizeState({
    ...state,
    updatedAt: safeIsoTimestamp(),
  });
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota and serialization failures; telemetry is best-effort.
    }
  }
  return normalized;
}

function ensureStorageListener() {
  if (storageListenerBound || typeof window === 'undefined') {
    return;
  }
  window.addEventListener('storage', (event) => {
    if (event?.key === TELEMETRY_STORAGE_KEY) {
      notifyListeners();
    }
  });
  storageListenerBound = true;
}

function percentile(values, targetPercentile) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((targetPercentile / 100) * sorted.length) - 1));
  return round(sorted[index]);
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return round(total / values.length);
}

export function resolveVitalRating(name, value) {
  const vitalName = trimString(name, 40).toUpperCase();
  const metricValue = clampNumber(value);

  if (vitalName === 'CLS') {
    if (metricValue <= 0.1) return 'good';
    if (metricValue <= 0.25) return 'needs-improvement';
    return 'poor';
  }
  if (vitalName === 'LCP') {
    if (metricValue <= 2500) return 'good';
    if (metricValue <= 4000) return 'needs-improvement';
    return 'poor';
  }
  if (vitalName === 'INP') {
    if (metricValue <= 200) return 'good';
    if (metricValue <= 500) return 'needs-improvement';
    return 'poor';
  }
  if (vitalName === 'FCP') {
    if (metricValue <= 1800) return 'good';
    if (metricValue <= 3000) return 'needs-improvement';
    return 'poor';
  }
  return 'info';
}

export function getDefaultDeviceHint() {
  if (typeof navigator === 'undefined') {
    return '';
  }
  const cores = clampNumber(navigator.hardwareConcurrency, 0);
  const memory = clampNumber(navigator.deviceMemory, 0);
  if (!cores && !memory) {
    return '';
  }
  if (cores && memory) {
    return `${cores}C/${memory}GB`;
  }
  return cores ? `${cores}C` : `${memory}GB`;
}

export function recordScreenRenderMetric(payload = {}) {
  const currentState = readTelemetryState();
  const entry = sanitizeRenderEvent({
    ...payload,
    slowThresholdMs: payload.slowThresholdMs ?? DEFAULT_SLOW_SCREEN_THRESHOLD_MS,
  });
  if (!entry) {
    return null;
  }
  currentState.renderEvents.push(entry);
  currentState.renderEvents = currentState.renderEvents.slice(-MAX_RENDER_EVENTS);
  writeTelemetryState(currentState);
  notifyListeners();
  return entry;
}

export function recordWebVitalMetric(payload = {}) {
  const name = trimString(payload.name, 40).toUpperCase();
  if (!name) {
    return null;
  }
  const value = clampNumber(payload.value, null);
  if (!Number.isFinite(value)) {
    return null;
  }
  const currentState = readTelemetryState();
  const entry = sanitizeVitalEvent({
    ...payload,
    name,
    value,
    rating: payload.rating || resolveVitalRating(name, value),
  });
  if (!entry) {
    return null;
  }
  currentState.vitalEvents.push(entry);
  currentState.vitalEvents = currentState.vitalEvents.slice(-MAX_VITAL_EVENTS);
  writeTelemetryState(currentState);
  notifyListeners();
  return entry;
}

export function getPerformanceTelemetrySummary(options = {}) {
  const slowThresholdMs = Math.max(
    1,
    round(clampNumber(options.slowThresholdMs, DEFAULT_SLOW_SCREEN_THRESHOLD_MS)),
  );
  const state = readTelemetryState();
  const renderEvents = Array.isArray(state.renderEvents) ? state.renderEvents : [];
  const vitalEvents = Array.isArray(state.vitalEvents) ? state.vitalEvents : [];
  const slowEvents = renderEvents.filter((event) => event.durationMs >= slowThresholdMs);

  const byScreen = new Map();
  for (const event of renderEvents) {
    const bucket = byScreen.get(event.screen) || {
      screen: event.screen,
      eventCount: 0,
      slowCount: 0,
      maxDurationMs: 0,
      durations: [],
      lastOccurredAt: '',
    };
    bucket.eventCount += 1;
    if (event.durationMs >= slowThresholdMs) {
      bucket.slowCount += 1;
    }
    bucket.maxDurationMs = Math.max(bucket.maxDurationMs, event.durationMs);
    bucket.durations.push(event.durationMs);
    if (!bucket.lastOccurredAt || event.occurredAt > bucket.lastOccurredAt) {
      bucket.lastOccurredAt = event.occurredAt;
    }
    byScreen.set(event.screen, bucket);
  }

  const topSlowScreens = [...byScreen.values()]
    .map((entry) => ({
      screen: entry.screen,
      eventCount: entry.eventCount,
      slowCount: entry.slowCount,
      maxDurationMs: round(entry.maxDurationMs),
      avgDurationMs: average(entry.durations),
      p95DurationMs: percentile(entry.durations, 95),
      lastOccurredAt: entry.lastOccurredAt,
    }))
    .filter((entry) => entry.slowCount > 0)
    .sort((left, right) => {
      if (right.slowCount !== left.slowCount) {
        return right.slowCount - left.slowCount;
      }
      if (right.maxDurationMs !== left.maxDurationMs) {
        return right.maxDurationMs - left.maxDurationMs;
      }
      return right.avgDurationMs - left.avgDurationMs;
    })
    .slice(0, 8);

  const recentSlowEvents = [...slowEvents]
    .sort((left, right) => (left.occurredAt > right.occurredAt ? -1 : 1))
    .slice(0, 12);

  const latestVitalByName = new Map();
  for (let index = vitalEvents.length - 1; index >= 0; index -= 1) {
    const vital = vitalEvents[index];
    if (!latestVitalByName.has(vital.name)) {
      latestVitalByName.set(vital.name, vital);
    }
  }

  const renderDurations = renderEvents.map((event) => event.durationMs);

  return {
    updatedAt: state.updatedAt || safeIsoTimestamp(),
    slowThresholdMs,
    totals: {
      renderEvents: renderEvents.length,
      slowEvents: slowEvents.length,
      vitalEvents: vitalEvents.length,
    },
    overallRender: {
      avgDurationMs: average(renderDurations),
      p50DurationMs: percentile(renderDurations, 50),
      p95DurationMs: percentile(renderDurations, 95),
      maxDurationMs: renderDurations.length ? round(Math.max(...renderDurations)) : 0,
    },
    topSlowScreens,
    recentSlowEvents,
    latestVitals: [...latestVitalByName.values()],
  };
}

export function subscribePerformanceTelemetry(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  ensureStorageListener();
  LISTENERS.add(listener);
  try {
    listener(getPerformanceTelemetrySummary());
  } catch {
    // Ignore listener failure and keep subscription alive.
  }
  return () => {
    LISTENERS.delete(listener);
  };
}

function notifyListeners() {
  if (LISTENERS.size === 0) {
    return;
  }
  const summary = getPerformanceTelemetrySummary();
  for (const listener of LISTENERS) {
    try {
      listener(summary);
    } catch {
      // Ignore listener errors so one subscriber does not break the others.
    }
  }
}

export function startWebVitalsCapture(options = {}) {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  const observers = [];
  let clsValue = 0;
  let lcpValue = null;
  let fcpValue = null;
  let inpValue = null;
  let flushed = false;
  const source = trimString(options.source, 80) || 'web_vitals';

  const createObserver = (type, callback) => {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      // Ignore unsupported metric types in older browsers.
    }
  };

  createObserver('paint', (entries) => {
    for (const entry of entries) {
      if (entry?.name === 'first-contentful-paint') {
        fcpValue = entry.startTime;
      }
    }
  });

  createObserver('largest-contentful-paint', (entries) => {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      lcpValue = lastEntry.startTime || lastEntry.renderTime || lastEntry.loadTime || null;
    }
  });

  createObserver('layout-shift', (entries) => {
    for (const entry of entries) {
      if (!entry.hadRecentInput) {
        clsValue += clampNumber(entry.value);
      }
    }
  });

  createObserver('event', (entries) => {
    for (const entry of entries) {
      const interactionId = clampNumber(entry.interactionId);
      if (interactionId > 0) {
        inpValue = Math.max(inpValue || 0, clampNumber(entry.duration));
      }
    }
  });

  const flushVitals = () => {
    if (flushed) {
      return;
    }
    flushed = true;
    if (fcpValue != null) {
      recordWebVitalMetric({ name: 'FCP', value: fcpValue, source });
    }
    if (lcpValue != null) {
      recordWebVitalMetric({ name: 'LCP', value: lcpValue, source });
    }
    if (clsValue > 0) {
      recordWebVitalMetric({ name: 'CLS', value: round(clsValue, 4), source });
    }
    if (inpValue != null) {
      recordWebVitalMetric({ name: 'INP', value: inpValue, source });
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushVitals();
    }
  };

  const handlePageHide = () => {
    flushVitals();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange, true);
  window.addEventListener('pagehide', handlePageHide, true);

  return () => {
    flushVitals();
    for (const observer of observers) {
      try {
        observer.disconnect();
      } catch {
        // Ignore disconnect failures.
      }
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange, true);
    window.removeEventListener('pagehide', handlePageHide, true);
  };
}

export function resetPerformanceTelemetryForTests() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(TELEMETRY_STORAGE_KEY);
    } catch {
      // Ignore test cleanup failures.
    }
  }
  notifyListeners();
}
