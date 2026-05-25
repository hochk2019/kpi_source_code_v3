import React from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DataHealthFrontendPerformancePanel from '@/components/data-health-dashboard/DataHealthFrontendPerformancePanel.jsx';

function createSummary(overrides = {}) {
  return {
    updatedAt: '2026-03-31T07:30:00.000Z',
    slowThresholdMs: 800,
    totals: {
      renderEvents: 12,
      slowEvents: 3,
      vitalEvents: 4,
    },
    overallRender: {
      avgDurationMs: 233,
      p50DurationMs: 180,
      p95DurationMs: 960,
      maxDurationMs: 1200,
    },
    topSlowScreens: [
      {
        screen: 'reports',
        eventCount: 5,
        slowCount: 2,
        maxDurationMs: 1200,
        avgDurationMs: 640,
        p95DurationMs: 1100,
        lastOccurredAt: '2026-03-31T07:25:00.000Z',
      },
    ],
    recentSlowEvents: [
      {
        id: 'slow-1',
        screen: 'reports',
        durationMs: 1200,
        source: 'tab_panel_render',
        deviceHint: '8C/8GB',
        occurredAt: '2026-03-31T07:25:00.000Z',
      },
    ],
    latestVitals: [
      {
        id: 'v1',
        name: 'LCP',
        value: 3100,
        rating: 'needs-improvement',
        occurredAt: '2026-03-31T07:26:00.000Z',
      },
      {
        id: 'v2',
        name: 'CLS',
        value: 0.08,
        rating: 'good',
        occurredAt: '2026-03-31T07:26:30.000Z',
      },
    ],
    ...overrides,
  };
}

describe('DataHealthFrontendPerformancePanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders telemetry cards, slow-screen breakdown, and latest vitals', () => {
    render(<DataHealthFrontendPerformancePanel summary={createSummary()} />);

    expect(screen.getByText('Hiệu năng frontend')).toBeInTheDocument();
    expect(screen.getByText('Render events')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Top màn hình chậm')).toBeInTheDocument();
    expect(screen.getAllByText('reports').length).toBeGreaterThan(0);
    expect(screen.getByText(/2\/5 lần chậm/i)).toBeInTheDocument();
    expect(screen.getByText('Web Vitals gần nhất')).toBeInTheDocument();
    expect(screen.getByText('LCP')).toBeInTheDocument();
    expect(screen.getByText('CLS')).toBeInTheDocument();
    expect(screen.getByText('Sự kiện chậm gần đây')).toBeInTheDocument();
    expect(screen.getByText(/Nguồn: tab_panel_render/i)).toBeInTheDocument();
  });

  it('shows fallback empty states when no telemetry is available', () => {
    render(
      <DataHealthFrontendPerformancePanel
        summary={createSummary({
          totals: { renderEvents: 0, slowEvents: 0, vitalEvents: 0 },
          topSlowScreens: [],
          recentSlowEvents: [],
          latestVitals: [],
        })}
      />
    );

    expect(screen.getByText('Chưa phát hiện màn hình chậm vượt ngưỡng.')).toBeInTheDocument();
    expect(screen.getByText('Chưa có dữ liệu Web Vitals.')).toBeInTheDocument();
    expect(screen.getByText('Không có sự kiện chậm trong phiên gần đây.')).toBeInTheDocument();
  });
});
