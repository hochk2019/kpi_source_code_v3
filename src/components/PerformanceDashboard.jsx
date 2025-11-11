import React, { useEffect, useMemo, useState } from 'react';

import clsx from 'clsx';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { getPerformanceMetrics, subscribePerformanceMetrics } from '@/lib/perfMonitor.js';

const WEB_VITAL_ORDER = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
const WEB_VITAL_LABELS = {
  LCP: 'Largest Contentful Paint',
  INP: 'Interaction to Next Paint',
  CLS: 'Cumulative Layout Shift',
  FCP: 'First Contentful Paint',
  TTFB: 'Time to First Byte',
};

const ratingStyles = {
  good: 'text-emerald-600 dark:text-emerald-300',
  'needs-improvement': 'text-amber-600 dark:text-amber-300',
  poor: 'text-red-600 dark:text-red-300',
};

function formatDuration(ms) {
  if (!Number.isFinite(ms)) {
    return '—';
  }
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatWebVitalValue(name, value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  if (name === 'CLS') {
    return value.toFixed(value >= 1 ? 2 : 3);
  }
  return formatDuration(value);
}

function computePercentile(values, percentile) {
  if (!values || values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(percentile * (sorted.length - 1))));
  return sorted[index];
}

function summariseWebVitals(metrics) {
  const latest = new Map();
  metrics
    .filter((metric) => metric.source === 'web-vitals' && typeof metric.name === 'string')
    .forEach((metric) => {
      latest.set(metric.name, metric);
    });
  return WEB_VITAL_ORDER.map((name) => latest.get(name)).filter(Boolean);
}

function summariseRenderMetrics(metrics) {
  const buckets = new Map();
  metrics
    .filter((metric) => metric.source === 'render' && typeof metric.name === 'string' && Number.isFinite(metric.value))
    .forEach((metric) => {
      if (!buckets.has(metric.name)) {
        buckets.set(metric.name, []);
      }
      buckets.get(metric.name).push({
        value: metric.value,
        createdAt: metric.createdAt,
        detail: metric.detail,
      });
    });
  return Array.from(buckets.entries())
    .map(([name, samples]) => {
      const values = samples.map((sample) => sample.value);
      return {
        name,
        count: samples.length,
        average: values.reduce((sum, current) => sum + current, 0) / values.length,
        p95: computePercentile(values, 0.95),
        max: Math.max(...values),
        lastDetail: samples[samples.length - 1]?.detail,
        lastAt: samples[samples.length - 1]?.createdAt,
      };
    })
    .sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0));
}

function getRenderSeverity(p95) {
  if (!Number.isFinite(p95)) {
    return 'neutral';
  }
  if (p95 >= 500) {
    return 'critical';
  }
  if (p95 >= 200) {
    return 'warning';
  }
  return 'good';
}

const renderSeverityStyles = {
  critical: 'text-red-600 dark:text-red-300',
  warning: 'text-amber-600 dark:text-amber-300',
  good: 'text-emerald-600 dark:text-emerald-300',
  neutral: 'text-slate-500 dark:text-slate-400',
};

function formatTimestamp(value) {
  if (!Number.isFinite(value)) {
    return '';
  }
  try {
    return new Date(value).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDetail(detail) {
  if (!detail) {
    return '';
  }
  if (typeof detail === 'string') {
    return detail;
  }
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return '';
  }
}

function buildTimeline(metrics) {
  return metrics
    .slice(-20)
    .filter((metric) => metric && metric.name)
    .map((metric) => ({
      id: metric.id,
      at: metric.createdAt,
      label: metric.name,
      source: metric.source,
      value: metric.value,
      unit: metric.unit,
    }))
    .reverse();
}

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState(() => getPerformanceMetrics());

  useEffect(() => {
    const unsubscribe = subscribePerformanceMetrics(setMetrics);
    return () => unsubscribe();
  }, []);

  const webVitals = useMemo(() => summariseWebVitals(metrics), [metrics]);
  const renderStats = useMemo(() => summariseRenderMetrics(metrics).slice(0, 6), [metrics]);
  const timeline = useMemo(() => buildTimeline(metrics), [metrics]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr,1fr]">
      <Card className="border-gray-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Giám sát hiệu năng thời gian thực</CardTitle>
          <CardDescription>
            Theo dõi Web Vitals và thời gian render của các màn hình trọng yếu để phát hiện bottleneck.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-6">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Web Vitals</h3>
            {webVitals.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Chưa có dữ liệu. Web Vitals sẽ xuất hiện sau khi người dùng tương tác vài giây.
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 text-sm dark:border-slate-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-900/60">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Metric
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Giá trị
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Đánh giá
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-900/40">
                    {webVitals.map((metric) => (
                      <tr key={metric.id}>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                          <div>{metric.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{WEB_VITAL_LABELS[metric.name]}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{formatWebVitalValue(metric.name, metric.value)}</td>
                        <td className="px-3 py-2">
                          <span className={clsx('text-xs font-semibold uppercase tracking-wide', ratingStyles[metric.rating] || ratingStyles.good)}>
                            {metric.rating === 'needs-improvement' ? 'Cần cải thiện' : metric.rating === 'poor' ? 'Kém' : 'Tốt'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Render chậm gần đây</h3>
            {renderStats.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Chưa ghi nhận lần render nào để tổng hợp thống kê.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {renderStats.map((stat) => (
                  <div key={stat.name} className="rounded-lg border border-gray-200 p-3 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stat.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {stat.count.toLocaleString('vi-VN')} lần ghi nhận • Lần cuối {formatTimestamp(stat.lastAt)}
                        </p>
                      </div>
                      <div className={clsx('text-right text-sm font-semibold', renderSeverityStyles[getRenderSeverity(stat.p95)])}>
                        <div>P95: {formatDuration(stat.p95)}</div>
                        <div className="text-xs font-normal text-gray-500 dark:text-gray-400">Trung bình: {formatDuration(stat.average)}</div>
                      </div>
                    </div>
                    {stat.lastDetail && (
                      <pre className="mt-3 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-600 dark:bg-slate-900/60 dark:text-gray-300">
                        {formatDetail(stat.lastDetail)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <Card className="border-gray-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Dòng thời gian sự kiện</CardTitle>
          <CardDescription>20 sự kiện hiệu năng gần nhất.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pb-6">
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có sự kiện nào.</p>
          ) : (
            timeline.map((event) => (
              <div key={event.id} className="rounded-lg border border-gray-200 p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <span>{event.source}</span>
                  <span>{formatTimestamp(event.at)}</span>
                </div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{event.label}</div>
                {Number.isFinite(event.value) && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDuration(event.value)} {event.unit === 'ms' ? '' : event.unit || ''}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
