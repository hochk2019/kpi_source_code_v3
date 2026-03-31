import React from 'react';

function formatDateTime(value) {
  if (!value) {
    return '—';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('vi-VN');
  } catch {
    return value;
  }
}

function formatDuration(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '—';
  }
  return `${number.toFixed(number >= 100 ? 0 : 1)} ms`;
}

function renderVitalTone(rating) {
  if (rating === 'good') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200';
  }
  if (rating === 'needs-improvement') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200';
  }
  if (rating === 'poor') {
    return 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';
}

export default function DataHealthFrontendPerformancePanel({ summary = {} }) {
  const totals = summary?.totals || {};
  const overallRender = summary?.overallRender || {};
  const topSlowScreens = Array.isArray(summary?.topSlowScreens) ? summary.topSlowScreens : [];
  const recentSlowEvents = Array.isArray(summary?.recentSlowEvents) ? summary.recentSlowEvents : [];
  const latestVitals = Array.isArray(summary?.latestVitals) ? summary.latestVitals : [];

  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Hiệu năng frontend</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Theo dõi Web Vitals và các màn hình có thời gian render vượt ngưỡng {summary?.slowThresholdMs ?? '—'} ms.
          </p>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Cập nhật: {formatDateTime(summary?.updatedAt)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <article className="rounded border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-600 dark:bg-slate-800/80">
          <div className="uppercase tracking-wide text-slate-500 dark:text-slate-300">Render events</div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {totals.renderEvents ?? 0}
          </div>
          <div className="text-slate-600 dark:text-slate-300">
            Slow events: {totals.slowEvents ?? 0}
          </div>
        </article>
        <article className="rounded border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-600 dark:bg-slate-800/80">
          <div className="uppercase tracking-wide text-slate-500 dark:text-slate-300">P95 render</div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatDuration(overallRender.p95DurationMs)}
          </div>
          <div className="text-slate-600 dark:text-slate-300">
            Max: {formatDuration(overallRender.maxDurationMs)}
          </div>
        </article>
        <article className="rounded border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-600 dark:bg-slate-800/80">
          <div className="uppercase tracking-wide text-slate-500 dark:text-slate-300">Web Vitals events</div>
          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {totals.vitalEvents ?? 0}
          </div>
          <div className="text-slate-600 dark:text-slate-300">
            P50: {formatDuration(overallRender.p50DurationMs)}
          </div>
        </article>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top màn hình chậm</h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">{topSlowScreens.length} mục</span>
          </div>
          <div className="mt-2 space-y-2 text-xs">
            {topSlowScreens.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">Chưa phát hiện màn hình chậm vượt ngưỡng.</p>
            ) : (
              topSlowScreens.map((item) => (
                <div
                  key={item.screen}
                  className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.screen}</span>
                    <span>{item.slowCount}/{item.eventCount} lần chậm</span>
                  </div>
                  <div className="mt-1 opacity-80">
                    Avg: {formatDuration(item.avgDurationMs)} • P95: {formatDuration(item.p95DurationMs)} • Max:{' '}
                    {formatDuration(item.maxDurationMs)}
                  </div>
                  <div className="mt-1 opacity-70">Lần cuối: {formatDateTime(item.lastOccurredAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Web Vitals gần nhất</h4>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            {latestVitals.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">Chưa có dữ liệu Web Vitals.</p>
            ) : (
              latestVitals.map((vital) => (
                <div key={vital.name} className={`rounded border p-2 ${renderVitalTone(vital.rating)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{vital.name}</span>
                    <span className="uppercase">{vital.rating || 'info'}</span>
                  </div>
                  <div className="mt-1">{formatDuration(vital.value)}</div>
                  <div className="mt-1 opacity-80">Ghi nhận: {formatDateTime(vital.occurredAt)}</div>
                </div>
              ))
            )}
          </div>

          <h4 className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Sự kiện chậm gần đây</h4>
          <div className="mt-2 space-y-2 text-xs">
            {recentSlowEvents.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">Không có sự kiện chậm trong phiên gần đây.</p>
            ) : (
              recentSlowEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded border border-red-200 bg-red-50 p-2 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{event.screen}</span>
                    <span>{formatDuration(event.durationMs)}</span>
                  </div>
                  <div className="mt-1 opacity-80">
                    Nguồn: {event.source || 'unknown'} • Thiết bị: {event.deviceHint || 'N/A'}
                  </div>
                  <div className="mt-1 opacity-70">Thời gian: {formatDateTime(event.occurredAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
