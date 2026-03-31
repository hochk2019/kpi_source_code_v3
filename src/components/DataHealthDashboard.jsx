import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchWithAuth } from '@/auth/localAuth.js';
import { API_V4_ROUTES } from '@/lib/apiRoutes.js';

import { fetchNotificationHistory, subscribeNotificationStream } from '@/lib/notificationClient.js';

import useAsyncRequest from '@/hooks/useAsyncRequest.js';
import DataHealthActivityFeedsPanel from '@/components/data-health-dashboard/DataHealthActivityFeedsPanel.jsx';
import DataHealthFrontendPerformancePanel from '@/components/data-health-dashboard/DataHealthFrontendPerformancePanel.jsx';
import DataHealthInfrastructureStatusPanel from '@/components/data-health-dashboard/DataHealthInfrastructureStatusPanel.jsx';
import DataHealthMetricsAlertsPanel from '@/components/data-health-dashboard/DataHealthMetricsAlertsPanel.jsx';
import DataHealthPolicyConfigSection from '@/components/data-health-dashboard/DataHealthPolicyConfigSection.jsx';
import DataHealthRolloutStatusPanel from '@/components/data-health-dashboard/DataHealthRolloutStatusPanel.jsx';
import DataHealthStorageOverviewPanel from '@/components/data-health-dashboard/DataHealthStorageOverviewPanel.jsx';
import { buildDataHealthDashboardViewModels } from '@/components/data-health-dashboard/dataHealthDashboardViewModels.js';
import {
  getPerformanceTelemetrySummary,
  subscribePerformanceTelemetry,
} from '@/lib/frontendPerformanceTelemetry.js';

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

const EMPTY_OBJECT = Object.freeze({});

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



function formatBytes(value) {

  const num = Number(value);

  if (!Number.isFinite(num) || num <= 0) {

    return '—';

  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  let size = num;

  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {

    size /= 1024;

    unitIndex += 1;

  }

  const digits = size >= 10 || unitIndex === 0 ? 0 : 1;

  return `${size.toFixed(digits)} ${units[unitIndex]}`;

}



function formatPercent(value) {

  const num = Number(value);

  if (!Number.isFinite(num)) {

    return '—';

  }

  return `${num.toFixed(num >= 100 || num === 0 ? 0 : 1)}%`;

}



const severityStyles = {

  good: {

    container:

      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',

    dot: 'bg-emerald-500 dark:bg-emerald-300',

    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',

  },

  info: {

    container:

      'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200',

    dot: 'bg-sky-500 dark:bg-sky-300',

    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',

  },

  warning: {

    container:

      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',

    dot: 'bg-amber-500 dark:bg-amber-300',

    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',

  },

  critical: {

    container:

      'border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',

    dot: 'bg-red-500 dark:bg-red-300',

    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',

  },

};



const severityLabels = {

  good: 'Ổn định',

  info: 'Thông tin',

  warning: 'Cảnh báo',

  critical: 'Nguy cấp',

};



const metricPalette = [

  'bg-emerald-500/10 text-emerald-700 border border-emerald-400/60',

  'bg-amber-500/10 text-amber-700 border border-amber-400/60',

  'bg-sky-500/10 text-sky-700 border border-sky-400/60',

  'bg-fuchsia-500/10 text-fuchsia-700 border border-fuchsia-400/60',

];



function describeDiskWarning(info) {

  if (!info) return '';

  if (info.warningCode === 'statfs_not_supported') {

    return 'Không thể thống kê dung lượng ổ đĩa trên nền tảng hiện tại.';

  }

  if (info.warningCode === 'windows_ps_error') {

    return info.error

      ? `Không thể đọc dung lượng ổ đĩa từ PowerShell: ${info.error}`

      : 'PowerShell không trả về dung lượng ổ đĩa.';

  }

  if (info.warningCode === 'disk_command_error') {

    return info.error

      ? `Không thể chạy lệnh kiểm tra dung lượng ổ đĩa: ${info.error}`

      : 'Không thể chạy lệnh kiểm tra dung lượng ổ đĩa.';

  }

  if (info.warningCode === 'statfs_error') {

    return info.error

      ? `Không thể lấy thông tin dung lượng ổ đĩa: ${info.error}`

      : 'Không thể lấy thông tin dung lượng ổ đĩa từ hệ điều hành.';

  }

  if (info.error && info.error !== 'statfs_not_supported') {

    return `Lỗi đọc dung lượng ổ đĩa: ${info.error}`;

  }

  return '';

}



export default function DataHealthDashboard({ currentUser, canManage = false }) {

  const [liveNotifications, setLiveNotifications] = useState([]);

  const [historyNotifications, setHistoryNotifications] = useState([]);

  const [, setPolicyConfig] = useState(null);

  const [policyForm, setPolicyForm] = useState(null);

  const [policyState, setPolicyState] = useState(null);

  const [policyStats, setPolicyStats] = useState(null);

  const [policySaving, setPolicySaving] = useState(false);

  const [policyError, setPolicyError] = useState('');
  const [frontendPerformanceSummary, setFrontendPerformanceSummary] = useState(() =>
    getPerformanceTelemetrySummary()
  );

  const canEditPolicy = Boolean(canManage);

  const handleSummarySuccess = useCallback((result) => {

    if (Array.isArray(result?.notifications)) {

      setHistoryNotifications(result.notifications);

    }

  }, []);

  const handlePolicySuccess = useCallback(({ config, state, summary: stats }) => {

    setPolicyConfig(config || null);

    setPolicyForm(config ? { ...config } : null);

    setPolicyState(state || null);

    setPolicyStats(stats || null);

    setPolicyError('');

  }, []);

  const handlePolicyError = useCallback((err) => {

    console.error('Không thể tải chính sách trùng 11 số', err);

    setPolicyError(err?.message || 'Không thể tải chính sách trùng 11 số');

  }, []);

  useEffect(() => {
    const unsubscribe = subscribePerformanceTelemetry((summary) => {
      setFrontendPerformanceSummary(summary);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const summaryTask = useCallback(async ({ signal }) => {

    const response = await fetchWithAuth(API_V4_ROUTES.dataHealth.summary, { cache: 'no-store', signal });

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

    onSuccess: handleSummarySuccess,

  });



  const rolloutTask = useCallback(async ({ signal }) => {

    const response = await fetchWithAuth(API_V4_ROUTES.meta.rollout, { cache: 'no-store', signal });

    if (!response.ok) {

      throw new Error(`HTTP ${response.status}`);

    }

    const payload = await response.json();

    if (payload?.ok === false) {

      throw new Error(payload.error || 'Không thể tải metadata rollout server-v4');

    }

    return payload || null;

  }, []);



  const {

    data: rolloutSummary,

    loading: rolloutLoading,

    error: rolloutError,

    execute: reloadRollout,

  } = useAsyncRequest(rolloutTask, {

    initialData: null,

  });



  useEffect(() => {

    reloadSummary();
    reloadRollout();

    const interval = setInterval(() => {

      reloadSummary();
      reloadRollout();

    }, 60000);

    return () => clearInterval(interval);

  }, [reloadRollout, reloadSummary]);



  const policyTask = useCallback(async ({ signal }) => {

    const response = await fetchWithAuth(API_V4_ROUTES.duplicatePolicy.base, { cache: 'no-store', signal });

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

    onSuccess: handlePolicySuccess,

    onError: handlePolicyError,

  });



  const policyInputsDisabled = !canEditPolicy || policySaving || policyLoading;

  const policyActionsDisabled = !canEditPolicy || policySaving;

  const handleRefresh = useCallback(() => {

    reloadSummary();
    reloadRollout();

  }, [reloadRollout, reloadSummary]);



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

  const sqlHealth = summary?.sqlServer?.health || null;

  const storageInfo = summary?.storage || EMPTY_OBJECT;

  const backupSummary = storageInfo.backup || EMPTY_OBJECT;

  const backupHealth = backupSummary.health || EMPTY_OBJECT;

  const databaseStorage = storageInfo.database || EMPTY_OBJECT;

  const diskInfo = storageInfo.disk || EMPTY_OBJECT;

  const storageHealth = storageInfo.health || EMPTY_OBJECT;

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



  const infrastructureAlerts = useMemo(() => {

    const items = [];

    const seen = new Set();

    if (Array.isArray(storageHealth?.issues)) {

      for (const issue of storageHealth.issues) {

        if (!issue || !issue.message) continue;

        const key = issue.code || issue.message;

        if (seen.has(key)) continue;

        seen.add(key);

        items.push({

          key,

          severity: issue.severity || 'info',

          message: issue.message,

        });

      }

    }

    if (sqlHealth) {

      if (sqlHealth.ok === false) {

        const severity = sqlHealth.state === 'timeout' ? 'critical' : 'warning';

        const key = `sql-${sqlHealth.state || 'error'}`;

        if (!seen.has(key)) {

          seen.add(key);

          items.push({

            key,

            severity,

            message: sqlHealth.message || 'Không thể kết nối SQL Server.',

          });

        }

      } else if (sqlHealth.state === 'not_configured') {

        const key = 'sql-not-configured';

        if (!seen.has(key)) {

          seen.add(key);

          items.push({

            key,

            severity: 'info',

            message: 'Chưa cấu hình máy chủ hoặc CSDL SQL Server, cần bổ sung để đồng bộ tự động.',

          });

        }

      }

    }

    return items;

  }, [sqlHealth, storageHealth]);



  const sqlHealthIndicator = useMemo(() => {

    if (!sqlHealth) {

      return {

        severity: 'info',

        title: 'Chưa có thống kê',

        message: 'Chưa ghi nhận lần kiểm tra kết nối SQL Server nào.',

      };

    }

    if (sqlHealth.ok) {

      return {

        severity: 'good',

        title: 'Kết nối ổn định',

        message: `Đã kết nối tới ${sqlHealth.server || 'máy chủ'} / ${sqlHealth.database || 'CSDL'}.`,

        checkedAt: sqlHealth.checkedAt ? formatDate(sqlHealth.checkedAt) : null,

      };

    }

    if (sqlHealth.state === 'not_configured') {

      return {

        severity: 'info',

        title: 'Chưa cấu hình',

        message: sqlHealth.message || 'Chưa cấu hình thông tin SQL Server trong hệ thống.',

      };

    }

    if (sqlHealth.state === 'timeout') {

      return {

        severity: 'critical',

        title: 'Timeout kết nối',

        message: sqlHealth.message || 'Kết nối SQL Server bị hết thời gian phản hồi.',

        checkedAt: sqlHealth.checkedAt ? formatDate(sqlHealth.checkedAt) : null,

      };

    }

    return {

      severity: 'warning',

      title: 'Lỗi kết nối',

      message: sqlHealth.message || 'Không thể kiểm tra SQL Server.',

      checkedAt: sqlHealth.checkedAt ? formatDate(sqlHealth.checkedAt) : null,

    };

  }, [sqlHealth]);



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

  const handlePolicyFieldChange = useCallback((field, value) => {
    setPolicyForm((prev) => ({ ...(prev || {}), [field]: value }));
  }, []);



  const handleSavePolicy = useCallback(async () => {

    if (!canEditPolicy) {

      alert('Tài khoản hiện không có quyền cấu hình sức khỏe dữ liệu.');

      return;

    }

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

      const response = await fetchWithAuth(API_V4_ROUTES.duplicatePolicy.base, {

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

  }, [canEditPolicy, policyForm, reloadSummary]);



  const handleUnlockSource = useCallback(

    async (source) => {

      if (!canEditPolicy) {

        alert('Tài khoản hiện không có quyền chỉnh sửa chính sách dữ liệu.');

        return;

      }

      if (!source) return;

      setPolicySaving(true);

      setPolicyError('');

      try {

        const response = await fetchWithAuth(API_V4_ROUTES.duplicatePolicy.base, {

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

    [canEditPolicy, reloadSummary]

  );



  const handleLockSource = useCallback(

    async (source) => {

      if (!canEditPolicy) {

        alert('Tài khoản hiện không có quyền chỉnh sửa chính sách dữ liệu.');

        return;

      }

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

        const response = await fetchWithAuth(API_V4_ROUTES.duplicatePolicy.base, {

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

    [canEditPolicy, reloadSummary]

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

  const policyLastEvaluatedAtLabel = policyOverview.lastEvaluatedAt
    ? formatDate(policyOverview.lastEvaluatedAt)
    : policyState?.lastEvaluatedAt
    ? formatDate(policyState.lastEvaluatedAt)
    : 'Chưa có';

  const {
    activityFeedsPanel,
    alertSummaryCard,
    backupCard,
    databaseCard,
    duplicateSummaryCard,
    infrastructureStatusAlerts,
    infrastructureSyncStatus,
    metricCards,
    policySourcesPanel,
    sqlCard,
  } = buildDataHealthDashboardViewModels({
    alertEntries,
    alertLastEvaluatedAt: summary?.alerts?.lastEvaluatedAt || null,
    backupSummary,
    backupHealth,
    combinedNotifications,
    databaseStorage,
    describeDiskWarning,
    diskInfo,
    duplicateGroups,
    formatBytes,
    formatDate,
    formatDateOnly,
    formatPercent,
    formatRelativeTime,
    infrastructureAlerts,
    metrics,
    metricPalette,
    operatorName,
    policyActionsDisabled,
    policyLastEvaluatedAtLabel,
    policyLockedSources,
    policySourceBreakdown,
    policyStatusCounts,
    severityLabels,
    severityStyles,
    sqlHealth,
    sqlHealthIndicator,
    sqlTimeouts,
    storageHealth,
    syncIndicator,
    handleLockSource,
    handleUnlockSource,
  });



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

              onClick={handleRefresh}

              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"

            >

              {summaryLoading || rolloutLoading ? 'Đang tải…' : 'Làm mới'}

            </button>

          </div>

        </div>

        {summaryError && (

          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-200">

            {summaryError}

          </div>

        )}
        {rolloutError && (

          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200">

            {rolloutSummary
              ? `Không thể làm mới rollout metadata: ${rolloutError}`
              : `Không thể tải rollout metadata: ${rolloutError}`}

          </div>

        )}

      </header>



      <DataHealthInfrastructureStatusPanel alerts={infrastructureStatusAlerts} sync={infrastructureSyncStatus} />



      <DataHealthRolloutStatusPanel
        rollout={rolloutSummary}
        loading={rolloutLoading}
        error={rolloutError}
      />



      <DataHealthStorageOverviewPanel backup={backupCard} database={databaseCard} sql={sqlCard} />



      <DataHealthMetricsAlertsPanel
        metrics={metricCards}
        duplicateSummary={duplicateSummaryCard}
        alertSummary={alertSummaryCard}
      />

      <DataHealthFrontendPerformancePanel summary={frontendPerformanceSummary} />



      <DataHealthPolicyConfigSection
        canEditPolicy={canEditPolicy}
        policyLoading={policyLoading}
        policySaving={policySaving}
        policyError={policyError}
        policyActionsDisabled={policyActionsDisabled}
        policyInputsDisabled={policyInputsDisabled}
        policyForm={policyForm}
        policySourcesPanel={policySourcesPanel}
        onReloadPolicy={reloadPolicy}
        onSavePolicy={handleSavePolicy}
        onPolicyFieldChange={handlePolicyFieldChange}
      />



      <DataHealthActivityFeedsPanel sqlEvents={activityFeedsPanel.sqlEvents} notifications={activityFeedsPanel.notifications} />

    </div>

  );

}

