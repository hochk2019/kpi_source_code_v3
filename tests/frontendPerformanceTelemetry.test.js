import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPerformanceTelemetrySummary,
  recordScreenRenderMetric,
  recordWebVitalMetric,
  resetPerformanceTelemetryForTests,
  resolveVitalRating,
  startWebVitalsCapture,
  subscribePerformanceTelemetry,
} from '@/lib/frontendPerformanceTelemetry.js';

describe('frontendPerformanceTelemetry', () => {
  beforeEach(() => {
    resetPerformanceTelemetryForTests();
  });

  it('records render metrics and surfaces slow-screen summary', () => {
    recordScreenRenderMetric({
      screen: 'reports',
      durationMs: 320,
      source: 'tab_panel_render',
      slowThresholdMs: 400,
    });
    recordScreenRenderMetric({
      screen: 'reports',
      durationMs: 620,
      source: 'tab_panel_render',
      slowThresholdMs: 400,
    });
    recordScreenRenderMetric({
      screen: 'import',
      durationMs: 910,
      source: 'tab_panel_render',
      slowThresholdMs: 400,
    });

    const summary = getPerformanceTelemetrySummary({ slowThresholdMs: 400 });
    expect(summary.totals.renderEvents).toBe(3);
    expect(summary.totals.slowEvents).toBe(2);
    expect(summary.topSlowScreens[0]).toEqual(
      expect.objectContaining({
        screen: 'import',
        slowCount: 1,
      }),
    );
    expect(summary.topSlowScreens.map((item) => item.screen)).toContain('reports');
    expect(summary.recentSlowEvents.length).toBe(2);
  });

  it('records web vitals and keeps the latest metric by name', () => {
    const firstVital = recordWebVitalMetric({ name: 'LCP', value: 2450 });
    const secondVital = recordWebVitalMetric({ name: 'LCP', value: 4220 });
    const inpVital = recordWebVitalMetric({ name: 'INP', value: 280 });

    expect(firstVital.rating).toBe('good');
    expect(secondVital.rating).toBe('poor');
    expect(inpVital.rating).toBe('needs-improvement');

    const summary = getPerformanceTelemetrySummary();
    const lcpVital = summary.latestVitals.find((item) => item.name === 'LCP');
    const inp = summary.latestVitals.find((item) => item.name === 'INP');
    expect(lcpVital).toEqual(expect.objectContaining({ value: 4220, rating: 'poor' }));
    expect(inp).toEqual(expect.objectContaining({ value: 280 }));
    expect(resolveVitalRating('CLS', 0.2)).toBe('needs-improvement');
  });

  it('notifies subscribers after telemetry mutations', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePerformanceTelemetry(listener);

    recordScreenRenderMetric({
      screen: 'health',
      durationMs: 550,
      source: 'tab_panel_render',
      slowThresholdMs: 500,
    });

    expect(listener).toHaveBeenCalled();
    const latestSummary = listener.mock.calls.at(-1)?.[0];
    expect(latestSummary.totals.renderEvents).toBe(1);
    expect(latestSummary.totals.slowEvents).toBe(0);

    unsubscribe();
  });

  it('starts and stops web vitals capture without crashing when observer is unavailable', () => {
    const originalObserver = globalThis.PerformanceObserver;
    Reflect.deleteProperty(globalThis, 'PerformanceObserver');

    const stopCapture = startWebVitalsCapture({ source: 'test_suite' });
    expect(typeof stopCapture).toBe('function');
    stopCapture();

    if (originalObserver) {
      globalThis.PerformanceObserver = originalObserver;
    }
  });
});
