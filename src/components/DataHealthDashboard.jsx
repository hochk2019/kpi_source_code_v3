import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { fetchWithAuth } from '@/auth/localAuth.js';
import { fetchNotificationHistory, subscribeNotificationStream } from '@/lib/notificationClient.js';
import useAsyncRequest from '@/hooks/useAsyncRequest.js';

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

function formatRelativeTime(value) {
  if (!value) return 'Không xác định';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Không xác định';
    }
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) {
      return 'Vừa cập nhật';
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} phút trước`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      const minutes = diffMinutes % 60;
      if (minutes === 0) {
        return `${diffHours} giờ trước`;
      }
      return `${diffHours} giờ ${minutes} phút trước`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  } catch {
    return 'Không xác định';
  }
}

let numberFormatter;
function formatNumber(value) {
  if (typeof value !== 'number') return value ?? '—';
  try {
    if (!numberFormatter) {
      numberFormatter = new Intl.NumberFormat('vi-VN');
    }
    return numberFormatter.format(value);
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
  const [liveNotifications, setLiveNotifications] = useState([]);
  const [historyNotifications, setHistoryNotifications] = useState([]);
  const [, setPolicyConfig] = useState(null);
  const [policyForm, setPolicyForm] = useState(null);
  const [policyState, setPolicyState] = useState(null);
  const [policyStats, setPolicyStats] = useState(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState('');
  const summaryTask = useCallback(async ({ signal }) => {
    const response = await fetchWithAuth('/api/data-health/summary', { cache: 'no-store', signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload?.ok === false) {
      throw new Error(payload.error || 'Không thể tải sức khỏe dữ liệu');
    }
    return payload.summary || null;
  }, []);

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    execute: reloadSummary,
  } = useAsyncRequest(summaryTask, {
    initialData: null,
    onSuccess: (result) => {
      if (Array.isArray(result?.notifications)) {
        setHistoryNotifications(result.notifications);
      }
    },
  });

  useEffect(() => {
    reloadSummary();
    const interval = setInterval(reloadSummary, 60000);
    return () => clearInterval(interval);
  }, [reloadSummary]);

  const policyTask = useCallback(async ({ signal }) => {
    const response = await fetchWithAuth('/api/duplicate-policy', { cache: 'no-store', signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload?.ok === false) {
      throw new Error(payload.error || 'Không thể tải chính sách trùng 11 số');
    }
    return {
      config: payload.config || null,
      state: payload.state || null,
      summary: payload.summary || null,
    };
  }, []);

  const { execute: reloadPolicy, loading: policyLoading } = useAsyncRequest(policyTask, {
    onSuccess: ({ config, state, summary: stats }) => {
      setPolicyConfig(config || null);
      setPolicyForm(config ? { ...config } : null);
      setPolicyState(state || null);
      setPolicyStats(stats || null);
      setPolicyError('');
    },
    onError: (err) => {
      console.error('Không thể tải chính sách trùng 11 số', err);
      setPolicyError(err?.message || 'Không thể tải chính sách trùng 11 số');
    },
  });

  useEffect(() => {
    reloadPolicy();
  }, [reloadPolicy]);

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
  const operatorName = useMemo(() => {
    if (!currentUser) return '';
    return currentUser.fullName || currentUser.username || '';
  }, [currentUser]);

  const syncIndicator = useMemo(() => {
    const syncInfo = summary?.sync || {};
    const statusText = syncInfo.lastStatus || 'Chưa có thống kê';
    const lastRun = syncInfo.lastRunAt ? new Date(syncInfo.lastRunAt) : null;
    const lastSummary = syncInfo.lastSummary || {};
    const diffMinutes = lastRun ? (Date.now() - lastRun.getTime()) / 60000 : null;

    let tone = 'idle';
    if (statusText?.toLowerCase().startsWith('error')) {
      tone = 'critical';
    } else if (diffMinutes !== null) {
      if (diffMinutes > 180) {
        tone = 'critical';
      } else if (diffMinutes > 90) {
        tone = 'warning';
      } else {
        tone = 'good';
      }
    }

    const toneClasses = {
      good: {
        container:
          'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',
        dot: 'bg-emerald-500 dark:bg-emerald-300',
      },
      warning: {
        container:
          'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
        dot: 'bg-amber-500 dark:bg-amber-300',
      },
      critical: {
        container:
          'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',
        dot: 'bg-red-500 dark:bg-red-300',
      },
      idle: {
        container:
          'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200',
        dot: 'bg-slate-400 dark:bg-slate-500',
      },
    };

    const classes = toneClasses[tone] || toneClasses.idle;
    const lastRunLabel = lastRun ? formatDate(lastRun) : 'Chưa có';
    const relative = lastRun ? formatRelativeTime(lastRun) : 'Không xác định';
    const rowsFetched = formatNumber(lastSummary.rowsFetched);
    const rowsInserted = formatNumber(lastSummary.rowsInserted);
    const rowsUpdated = formatNumber(lastSummary.rowsUpdated);

    let overview = 'Chưa có dữ liệu đồng bộ từ ECUS.';
    if (typeof lastSummary.rowsFetched === 'number') {
      overview = `Tải ${rowsFetched} dòng • Thêm ${rowsInserted || 0} • Cập nhật ${rowsUpdated || 0}`;
    } else if (lastRun) {
      overview = `Trạng thái lần chạy gần nhất: ${statusText}`;
    }

    return {
      tone,
      classes,
      statusText,
      overview,
      lastRunLabel,
      relative,
    };
  }, [summary]);

  const metrics = useMemo(() => {
    const totals = summary?.totals || {};
    const policyOverview = summary?.duplicates?.policy || {};
    const lockedCount = Array.isArray(policyOverview.lockedSources) ? policyOverview.lockedSources.length : 0;
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
        label: 'Nhóm chờ xử lý',
        value: totals.duplicatesAwaiting,
        description: `${totals.duplicatesPendingReview || 0} nhóm đang chờ rà soát`,
      },
      {
        label: 'Nguồn bị khóa',
        value: lockedCount,
        description: `${totals.duplicatesLocked || 0} nhóm thuộc nguồn khóa`,
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

  const policyOverview = summary?.duplicates?.policy || {};
  const policyLockedSources = useMemo(() => {
    if (Array.isArray(policyOverview.lockedSources) && policyOverview.lockedSources.length > 0) {
      return policyOverview.lockedSources;
    }
    if (Array.isArray(policyState?.lockedSources)) {
      return policyState.lockedSources;
    }
    return [];
  }, [policyOverview.lockedSources, policyState]);

  const policySourceBreakdown = useMemo(() => {
    if (Array.isArray(summary?.duplicates?.sourceBreakdown)) {
      return summary.duplicates.sourceBreakdown;
    }
    if (Array.isArray(policyStats?.sourceBreakdown)) {
      return policyStats.sourceBreakdown;
    }
    return [];
  }, [summary, policyStats]);

  const policyStatusCounts = useMemo(() => {
    if (summary?.duplicates?.statusCounts) {
      return summary.duplicates.statusCounts;
    }
    if (policyStats?.statusCounts) {
      return policyStats.statusCounts;
    }
    return { awaitingAction: 0, pendingReview: 0, locked: 0 };
  }, [summary, policyStats]);

  const handleSavePolicy = useCallback(async () => {
    if (!policyForm) {
      alert('Chưa có dữ liệu cấu hình chính sách để lưu.');
      return;
    }
    setPolicySaving(true);
    setPolicyError('');
    try {
      const payload = {
        config: {
          autoNotifyAfterDays:
            policyForm.autoNotifyAfterDays === '' || policyForm.autoNotifyAfterDays === null
              ? 0
              : Number(policyForm.autoNotifyAfterDays),
          notifyCooldownHours:
            policyForm.notifyCooldownHours === '' || policyForm.notifyCooldownHours === null
              ? undefined
              : Number(policyForm.notifyCooldownHours),
          evaluationWindowDays:
            policyForm.evaluationWindowDays === '' || policyForm.evaluationWindowDays === null
              ? undefined
              : Number(policyForm.evaluationWindowDays),
          autoLockEnabled: !!policyForm.autoLockEnabled,
          autoLockAfterGroups:
            policyForm.autoLockAfterGroups === '' || policyForm.autoLockAfterGroups === null
              ? undefined
              : Number(policyForm.autoLockAfterGroups),
          minGroupSizeForLock:
            policyForm.minGroupSizeForLock === '' || policyForm.minGroupSizeForLock === null
              ? undefined
              : Number(policyForm.minGroupSizeForLock),
          autoUnlockAfterDays:
            policyForm.autoUnlockAfterDays === '' || policyForm.autoUnlockAfterDays === null
              ? undefined
              : Number(policyForm.autoUnlockAfterDays),
        },
      };
      const response = await fetchWithAuth('/api/duplicate-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data?.ok === false) {
        throw new Error(data.error || 'Không thể cập nhật chính sách trùng 11 số');
      }
      setPolicyConfig(data.config || null);
      setPolicyForm(data.config ? { ...data.config } : null);
      setPolicyState(data.state || null);
      setPolicyStats(data.summary || null);
      await reloadSummary();
    } catch (err) {
      console.error('Không thể cập nhật chính sách trùng 11 số', err);
      setPolicyError(err?.message || 'Không thể cập nhật chính sách trùng 11 số');
    } finally {
      setPolicySaving(false);
    }
  }, [policyForm, reloadSummary]);

  const handleUnlockSource = useCallback(
    async (source) => {
      if (!source) return;
      setPolicySaving(true);
      setPolicyError('');
      try {
        const response = await fetchWithAuth('/api/duplicate-policy', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unlockSources: [source] }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data?.ok === false) {
          throw new Error(data.error || 'Không thể mở khóa nguồn dữ liệu');
        }
        setPolicyConfig(data.config || null);
        setPolicyForm(data.config ? { ...data.config } : null);
        setPolicyState(data.state || null);
        setPolicyStats(data.summary || null);
        await reloadSummary();
      } catch (err) {
        console.error('Không thể mở khóa nguồn dữ liệu', err);
        setPolicyError(err?.message || 'Không thể mở khóa nguồn dữ liệu');
      } finally {
        setPolicySaving(false);
      }
    },
    [reloadSummary]
  );

  const handleLockSource = useCallback(
    async (source) => {
      if (!source) return;
      let reason = 'Khóa tạm thời để rà soát dữ liệu trùng';
      if (typeof window !== 'undefined') {
        const input = window.prompt(`Nhập lý do khóa nguồn ${source}`, reason);
        if (input === null) {
          return;
        }
        reason = input.trim() || reason;
      }
      setPolicySaving(true);
      setPolicyError('');
      try {
        const response = await fetchWithAuth('/api/duplicate-policy', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lockSources: [{ source, reason }] }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data?.ok === false) {
          throw new Error(data.error || 'Không thể khóa nguồn dữ liệu');
        }
        setPolicyConfig(data.config || null);
        setPolicyForm(data.config ? { ...data.config } : null);
        setPolicyState(data.state || null);
        setPolicyStats(data.summary || null);
        await reloadSummary();
      } catch (err) {
        console.error('Không thể khóa nguồn dữ liệu', err);
        setPolicyError(err?.message || 'Không thể khóa nguồn dữ liệu');
      } finally {
        setPolicySaving(false);
      }
    },
    [reloadSummary]
  );

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
              onClick={reloadSummary}
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
            >
              {summaryLoading ? 'Đang tải…' : 'Làm mới'}
            </button>
          </div>
        </div>
        {summaryError && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-200">
            {summaryError}
          </div>
        )}
      </header>

      <section
        className={clsx(
          'flex flex-col gap-2 rounded border p-4 text-sm shadow-sm transition md:flex-row md:items-center md:justify-between',
          syncIndicator.classes.container
        )}
      >
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className={clsx('h-2.5 w-2.5 rounded-full', syncIndicator.classes.dot)} />
            <span>Trạng thái kết nối ECUS</span>
          </div>
          <p className="mt-1 text-xs opacity-90">{syncIndicator.overview}</p>
        </div>
        <div className="text-xs text-right opacity-80 md:text-left">
          <div>Lần chạy gần nhất: {syncIndicator.lastRunLabel}</div>
          <div>{syncIndicator.relative}</div>
          <div>Trạng thái: {syncIndicator.statusText}</div>
          {operatorName ? <div>Người trực: {operatorName}</div> : null}
        </div>
      </section>

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

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Chính sách tự động trùng 11 số</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tinh chỉnh ngưỡng cảnh báo, trạng thái khóa nguồn và theo dõi lần đánh giá gần nhất.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reloadPolicy}
              className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 transition hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
              disabled={policyLoading || policySaving}
            >
              {policyLoading ? 'Đang tải…' : 'Tải lại'}
            </button>
            <button
              type="button"
              onClick={handleSavePolicy}
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={policySaving}
            >
              {policySaving ? 'Đang lưu…' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>
        {policyError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200">
            {policyError}
          </div>
        )}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Số ngày nhắc nhở tự động
                <input
                  type="number"
                  min="0"
                  value={policyForm?.autoNotifyAfterDays ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setPolicyForm((prev) => ({ ...(prev || {}), autoNotifyAfterDays: raw === '' ? '' : Number(raw) }));
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Thời gian chờ nhắc lại (giờ)
                <input
                  type="number"
                  min="1"
                  value={policyForm?.notifyCooldownHours ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setPolicyForm((prev) => ({ ...(prev || {}), notifyCooldownHours: raw === '' ? '' : Number(raw) }));
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Khoảng đánh giá (ngày)
                <input
                  type="number"
                  min="1"
                  value={policyForm?.evaluationWindowDays ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setPolicyForm((prev) => ({ ...(prev || {}), evaluationWindowDays: raw === '' ? '' : Number(raw) }));
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Số nhóm trùng để khóa nguồn
                <input
                  type="number"
                  min="1"
                  value={policyForm?.autoLockAfterGroups ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setPolicyForm((prev) => ({ ...(prev || {}), autoLockAfterGroups: raw === '' ? '' : Number(raw) }));
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Kích thước nhóm tối thiểu
                <input
                  type="number"
                  min="1"
                  value={policyForm?.minGroupSizeForLock ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setPolicyForm((prev) => ({ ...(prev || {}), minGroupSizeForLock: raw === '' ? '' : Number(raw) }));
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Ngày tự mở khóa
                <input
                  type="number"
                  min="0"
                  value={policyForm?.autoUnlockAfterDays ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setPolicyForm((prev) => ({ ...(prev || {}), autoUnlockAfterDays: raw === '' ? '' : Number(raw) }));
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={!!policyForm?.autoLockEnabled}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setPolicyForm((prev) => ({ ...(prev || {}), autoLockEnabled: checked }));
                }}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
              />
              Bật chế độ khóa nguồn tự động khi vượt ngưỡng
            </label>
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-gray-300">
              <div>• Nhóm chờ xử lý: {policyStatusCounts.awaitingAction || 0}</div>
              <div>• Nhóm chờ rà soát: {policyStatusCounts.pendingReview || 0}</div>
              <div>• Nhóm thuộc nguồn khóa: {policyStatusCounts.locked || 0}</div>
              <div>
                • Lần đánh giá gần nhất:{' '}
                {policyOverview.lastEvaluatedAt
                  ? formatDate(policyOverview.lastEvaluatedAt)
                  : policyState?.lastEvaluatedAt
                  ? formatDate(policyState.lastEvaluatedAt)
                  : 'Chưa có'}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded border border-gray-200 p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-200">
                <span>Nguồn dữ liệu</span>
                <span>Tác vụ</span>
              </div>
              <div className="max-h-64 overflow-auto">
                {policySourceBreakdown.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Chưa có thống kê nguồn dữ liệu.</p>
                ) : (
                  <ul className="space-y-2">
                    {policySourceBreakdown.map((item) => (
                      <li
                        key={item.source}
                        className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900/40"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-gray-700 dark:text-gray-200">{item.source}</div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {item.awaitingActionGroups || 0} nhóm chờ xử lý • {item.pendingReviewGroups || 0} nhóm chờ rà soát
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.locked ? (
                              <button
                                type="button"
                                onClick={() => handleUnlockSource(item.source)}
                                className="rounded border border-emerald-500 px-2 py-1 text-[11px] text-emerald-600 hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
                                disabled={policySaving}
                              >
                                Mở khóa
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleLockSource(item.source)}
                                className="rounded border border-amber-500 px-2 py-1 text-[11px] text-amber-600 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-400/10"
                                disabled={policySaving}
                              >
                                Khóa nguồn
                              </button>
                            )}
                          </div>
                        </div>
                        {item.locked && item.lockedAt && (
                          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            Khóa lúc: {formatDate(item.lockedAt)}
                            {item.lockedReason ? ` • ${item.lockedReason}` : ''}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="rounded border border-gray-200 p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Nguồn đang khóa</div>
              <div className="mt-2 space-y-2">
                {policyLockedSources.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Không có nguồn nào bị khóa.</p>
                ) : (
                  policyLockedSources.map((item) => (
                    <div
                      key={item.source}
                      className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{item.source}</span>
                        <button
                          type="button"
                          className="rounded border border-amber-600 px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-200 dark:hover:bg-amber-400/20"
                          onClick={() => handleUnlockSource(item.source)}
                          disabled={policySaving}
                        >
                          Mở khóa
                        </button>
                      </div>
                      <div className="mt-1 text-[11px]">
                        Khóa bởi: {item.lockedBy || 'Hệ thống'} • {item.lockedAt ? formatDate(item.lockedAt) : 'Không rõ thời gian'}
                      </div>
                      {item.reason && <div className="mt-1 text-[11px] opacity-80">Lý do: {item.reason}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
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
