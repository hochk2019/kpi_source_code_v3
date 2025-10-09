import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { fetchWithAuth } from '@/auth/localAuth.js';
import { fetchNotificationHistory, subscribeNotificationStream } from '@/lib/notificationClient.js';

function formatDate(value) {
  if (!value) return 'Không xác định';
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

function formatDateOnly(value) {
  if (!value) return 'Không xác định';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('vi-VN');
  } catch {
    return value;
  }
}

const metricPalette = [
  'bg-emerald-500/10 text-emerald-700 border border-emerald-400/60',
  'bg-amber-500/10 text-amber-700 border border-amber-400/60',
  'bg-sky-500/10 text-sky-700 border border-sky-400/60',
  'bg-fuchsia-500/10 text-fuchsia-700 border border-fuchsia-400/60',
];

export default function DataHealthDashboard({ currentUser }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liveNotifications, setLiveNotifications] = useState([]);
  const [historyNotifications, setHistoryNotifications] = useState([]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth('/api/data-health/summary', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload?.ok === false) {
        throw new Error(payload.error || 'Không thể tải sức khỏe dữ liệu');
      }
      setSummary(payload.summary || null);
      if (Array.isArray(payload.summary?.notifications)) {
        setHistoryNotifications(payload.summary.notifications);
      }
    } catch (err) {
      console.error('Không thể tải sức khỏe dữ liệu', err);
      setError(err?.message || 'Không thể tải sức khỏe dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    const interval = setInterval(loadSummary, 60000);
    return () => clearInterval(interval);
  }, [loadSummary]);

  useEffect(() => {
    let cancelled = false;
    fetchNotificationHistory(10)
      .then((events) => {
        if (!cancelled) {
          setHistoryNotifications(events);
        }
      })
      .catch(() => {});
    const unsubscribe = subscribeNotificationStream((event) => {
      if (!event) return;
      setLiveNotifications((prev) => [event, ...prev].slice(0, 10));
      setHistoryNotifications((prev) => {
        const next = [event, ...prev];
        const unique = new Map();
        for (const entry of next) {
          if (entry?.id && !unique.has(entry.id)) {
            unique.set(entry.id, entry);
          }
        }
        return Array.from(unique.values()).slice(0, 20);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const duplicateGroups = summary?.duplicates?.groups || [];
  const alertEntries = summary?.alerts?.recent || [];
  const sqlTimeouts = summary?.sqlServer?.timeoutEvents || [];

  const metrics = useMemo(() => {
    const totals = summary?.totals || {};
    return [
      {
        label: 'Tổng tờ khai',
        value: totals.declarations,
        description: 'Đang lưu trong hệ thống',
      },
      {
        label: 'Nhóm trùng 11 số',
        value: totals.duplicateGroups,
        description: `${totals.duplicateRows || 0} bản ghi cần rà soát`,
      },
      {
        label: 'Cảnh báo thiếu thông tin',
        value: totals.alertsOutstanding,
        description: `${summary?.alerts?.totalTracked || 0} tờ khai đang theo dõi`,
      },
      {
        label: 'Đồng bộ ECUS gần nhất',
        value: summary?.sync?.lastRunAt ? formatDate(summary.sync.lastRunAt) : 'Chưa chạy',
        description: summary?.sync?.lastStatus || 'Chưa có thống kê',
      },
    ];
  }, [summary]);

  const combinedNotifications = useMemo(() => {
    const seen = new Set();
    const merged = [];
    for (const event of [...liveNotifications, ...historyNotifications]) {
      if (!event) continue;
      const key = event.id || `${event.createdAt}_${event.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(event);
    }
    return merged.slice(0, 12);
  }, [liveNotifications, historyNotifications]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Tổng quan sức khỏe dữ liệu</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Theo dõi chất lượng dữ liệu tờ khai, cảnh báo thiếu thông tin và trạng thái đồng bộ theo thời gian thực.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadSummary}
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
            >
              {loading ? 'Đang tải…' : 'Làm mới'}
            </button>
          </div>
        </div>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        )}
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={clsx(
              'rounded p-4 text-sm shadow-sm backdrop-blur transition',
              metricPalette[index % metricPalette.length]
            )}
          >
            <div className="text-xs uppercase tracking-wide opacity-75">{metric.label}</div>
            <div className="mt-2 text-2xl font-semibold">{metric.value ?? '—'}</div>
            <div className="mt-1 text-xs opacity-80">{metric.description}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Nhóm trùng 11 số cần xử lý</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {duplicateGroups.length} nhóm gần nhất
            </span>
          </div>
          <div className="mt-3 space-y-3 text-sm">
            {duplicateGroups.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Không phát hiện nhóm trùng nào.</p>
            ) : (
              duplicateGroups.map((group) => (
                <div key={group.key} className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide">
                    <span>{group.prefix}</span>
                    <span>{group.total} bản ghi</span>
                  </div>
                  <div className="mt-1 text-xs text-amber-700 dark:text-amber-200/80">
                    Tổ/chi nhánh: {group.branch || 'Chưa xác định'}
                  </div>
                  <div className="mt-2 text-xs text-amber-700/80 dark:text-amber-100/70">
                    Giữ lại: {group.keep?.so_tk_full || group.keep?.so_tk} • Cập nhật: {formatDate(group.keep?.updatedAt)}
                  </div>
                  {group.duplicates?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      {group.duplicates.slice(0, 4).map((row, index) => (
                        <li key={`${group.key}_${row.so_tk || index}`}>
                          {row.so_tk_full || row.so_tk} • NV: {row.staff || '—'} • Tổ: {row.team || '—'} • Cập nhật {formatDate(row.updatedAt)}
                        </li>
                      ))}
                      {group.duplicates.length > 4 && (
                        <li className="italic">… {group.duplicates.length - 4} bản ghi khác</li>
                      )}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cảnh báo cần xử lý</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Đánh giá lần cuối: {summary?.alerts?.lastEvaluatedAt ? formatDate(summary.alerts.lastEvaluatedAt) : 'Chưa có'}
            </span>
          </div>
          <div className="mt-3 space-y-3 text-sm">
            {alertEntries.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Không có cảnh báo tồn đọng.</p>
            ) : (
              alertEntries.map((alert) => (
                <div key={alert.key} className="rounded border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide">
                    <span>{alert.so_tk}</span>
                    <span>{formatDateOnly(alert.date)}</span>
                  </div>
                  <div className="mt-1 text-xs">MST: {alert.mst || '—'} • Công ty: {alert.company || '—'}</div>
                  <div className="mt-1 text-xs">Thiếu: {Array.isArray(alert.missing) ? alert.missing.join(', ') : '—'}</div>
                  <div className="mt-1 text-xs">
                    Nhân viên: {alert.staff || 'Chưa gán'} • Tổ đội: {alert.team || 'Chưa gán'}
                  </div>
                  <div className="mt-1 text-xs opacity-80">Cảnh báo lần cuối: {formatDate(alert.lastAlertAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Sự kiện SQL Server gần đây</h3>
          <div className="mt-3 space-y-2 text-sm">
            {sqlTimeouts.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Không ghi nhận timeout trong thời gian gần đây.</p>
            ) : (
              sqlTimeouts.map((event) => (
                <div key={event.at} className="rounded border border-sky-200 bg-sky-50 p-3 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide">
                    <span>Timeout</span>
                    <span>{formatDate(event.at)}</span>
                  </div>
                  <div className="mt-1 text-xs">{event.message || 'Timeout kết nối SQL Server'}</div>
                  {event.context && (
                    <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-[11px] leading-tight text-sky-800 dark:bg-black/40 dark:text-sky-100">
                      {JSON.stringify(event.context, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Thông báo real-time</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{combinedNotifications.length} sự kiện mới</span>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {combinedNotifications.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Chưa có thông báo mới.</p>
            ) : (
              combinedNotifications.map((event) => (
                <div key={event.id || `${event.createdAt}_${event.type}`}
                  className={clsx(
                    'rounded border px-3 py-2 text-xs shadow-sm',
                    event.severity === 'error' && 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',
                    event.severity === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
                    event.severity === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',
                    (!event.severity || event.severity === 'info') && 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-wide">
                    <span>{event.type || 'thông báo'}</span>
                    <span>{formatDate(event.createdAt)}</span>
                  </div>
                  {event.title && <div className="mt-1 text-sm font-semibold">{event.title}</div>}
                  {event.message && <div className="mt-1 whitespace-pre-wrap text-sm">{event.message}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
