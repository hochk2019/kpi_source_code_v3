import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDialog } from '@/hooks/useAppDialog';
import { t } from '@/lib/i18n.js';

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
import type { AuthAccountView } from '@/types';
import { PageHeader } from "@/components/designSystem/PageHeader";
import { PermissionBanner } from "@/components/designSystem/primitives";
import { LayoutDashboard, AlertTriangle, Database, Server, Bell } from "lucide-react";

interface DataHealthDashboardProps {
  currentUser?: AuthAccountView | null;
  canManage?: boolean;
}

function formatDate(value: unknown): string {
  if (!value) return t('health.date.unknown');

  try {

    const date = new Date(value as string | number | Date);

    if (Number.isNaN(date.getTime())) {

      return String(value);

    }

    return date.toLocaleString('vi-VN');

  } catch {

    return String(value);

  }

}



function formatDateOnly(value: unknown): string {
  if (!value) return t('health.date.unknown');

  try {

    const date = new Date(value as string | number | Date);

    if (Number.isNaN(date.getTime())) {

      return String(value);

    }

    return date.toLocaleDateString('vi-VN');

  } catch {

    return String(value);

  }

}



function formatRelativeTime(value: unknown): string {

  if (!value) return 'Không xác định';

  try {

    const date = new Date(value as string | number | Date);

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



let numberFormatter: Intl.NumberFormat | undefined;

const EMPTY_OBJECT = Object.freeze({});

function formatNumber(value: unknown): string | number {

  if (typeof value !== 'number') return (value as string) ?? '—';

  try {

    if (!numberFormatter) {

      numberFormatter = new Intl.NumberFormat('vi-VN');

    }

    return numberFormatter.format(value);

  } catch {

    return value;

  }

}



function formatBytes(value: unknown): string {

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



function formatPercent(value: unknown): string {

  const num = Number(value);

  if (!Number.isFinite(num)) {

    return '—';

  }

  return `${num.toFixed(num >= 100 || num === 0 ? 0 : 1)}%`;

}



interface SeverityStyle {
  container: string;
  dot: string;
  badge: string;
}

const severityStyles: Record<string, SeverityStyle> = {

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

      'border-amber-200 bg-ds-warning/10 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',

    dot: 'bg-amber-500 dark:bg-amber-300',

    badge: 'bg-amber-100 text-ds-warning dark:bg-amber-500/20 dark:text-amber-200',

  },

  critical: {

    container:

      'border-red-200 bg-ds-destructive/10 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',

    dot: 'bg-red-500 dark:bg-red-300',

    badge: 'bg-red-100 text-ds-destructive dark:bg-red-500/20 dark:text-red-200',

  },

};



const severityLabels: Record<string, string> = {

  good: 'Ổn định',

  info: 'Thông tin',

  warning: 'Cảnh báo',

  critical: 'Nguy cấp',

};



const metricPalette = [

  'bg-emerald-500/10 text-emerald-700 border border-emerald-400/60',

  'bg-amber-500/10 text-ds-warning border border-amber-400/60',

  'bg-sky-500/10 text-sky-700 border border-sky-400/60',

  'bg-fuchsia-500/10 text-fuchsia-700 border border-fuchsia-400/60',

];



interface DiskWarningInfo {
  warningCode?: string;
  error?: string;
}

function describeDiskWarning(info: DiskWarningInfo | null | undefined): string {

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



export default function DataHealthDashboard({ currentUser, canManage = false }: DataHealthDashboardProps) {
  const { alert } = useAppDialog();

  const [liveNotifications, setLiveNotifications] = useState<unknown[]>([]);

  const [historyNotifications, setHistoryNotifications] = useState<unknown[]>([]);

  const [, setPolicyConfig] = useState<Record<string, unknown> | null>(null);

  const [policyForm, setPolicyForm] = useState<Record<string, unknown> | null>(null);

  const [policyState, setPolicyState] = useState<Record<string, unknown> | null>(null);

  const [policyStats, setPolicyStats] = useState<Record<string, unknown> | null>(null);

  const [policySaving, setPolicySaving] = useState(false);

  const [policyError, setPolicyError] = useState('');
  const [frontendPerformanceSummary, setFrontendPerformanceSummary] = useState(() =>
    getPerformanceTelemetrySummary()
  );

  // Main tabs for health categories
  const [activeTab, setActiveTab] = useState<"all" | "duplicates" | "missing" | "ecus" | "alerts">("all");

  const canEditPolicy = Boolean(canManage);

  const handleSummarySuccess = useCallback((result: unknown) => {

    const res = result as Record<string, unknown> | null;
    if (Array.isArray(res?.notifications)) {

      setHistoryNotifications(res.notifications as unknown[]);

    }

  }, []);

  const handlePolicySuccess = useCallback((result: { config?: Record<string, unknown> | null; state?: Record<string, unknown> | null; summary?: Record<string, unknown> | null }) => {

    const { config, state, summary: stats } = result;

    setPolicyConfig(config || null);

    setPolicyForm(config ? { ...config } : null);

    setPolicyState(state || null);

    setPolicyStats(stats || null);

    setPolicyError('');

  }, []);

  const handlePolicyError = useCallback((err: unknown) => {

    console.error('Không thể tải chính sách trùng 11 số', err);

    const error = err as Error | undefined;
    setPolicyError(error?.message || 'Không thể tải chính sách trùng 11 số');

  }, []);

  useEffect(() => {
    const unsubscribe = subscribePerformanceTelemetry((summary: unknown) => {
      setFrontendPerformanceSummary(summary as ReturnType<typeof getPerformanceTelemetrySummary>);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const summaryTask = useCallback(async ({ signal }: { signal: AbortSignal }) => {

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



  const rolloutTask = useCallback(async ({ signal }: { signal: AbortSignal }) => {

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



  const policyTask = useCallback(async ({ signal }: { signal: AbortSignal }) => {

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

      .then((events: unknown) => {

        if (!cancelled) {

          setHistoryNotifications(events as unknown[]);

        }

      })

      .catch(() => {});

    const unsubscribe = subscribeNotificationStream((event: unknown) => {

      if (!event) return;

      setLiveNotifications((prev) => [(event as Record<string, unknown>), ...prev].slice(0, 10));

      setHistoryNotifications((prev) => {

        const next = [(event as Record<string, unknown>), ...prev];

        const unique = new Map();

        for (const entry of next) {

          const e = entry as Record<string, unknown>;
          if (e?.id && !unique.has(e.id)) {

            unique.set(e.id, entry);

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



  const summaryData = summary as Record<string, unknown> | null;
  const duplicateGroups = ((summaryData?.duplicates as Record<string, unknown>)?.groups || []) as Record<string, unknown>[];

  const alertEntries = ((summaryData?.alerts as Record<string, unknown>)?.recent || []) as Record<string, unknown>[];

  const sqlTimeouts = ((summaryData?.sqlServer as Record<string, unknown>)?.timeoutEvents || []) as Record<string, unknown>[];

  const sqlHealth = (summaryData?.sqlServer as Record<string, unknown>)?.health || null;

  const storageInfo = (summaryData?.storage as Record<string, unknown>) || EMPTY_OBJECT;

  const backupSummary = (storageInfo as Record<string, unknown>).backup || EMPTY_OBJECT;

  const backupHealth = (backupSummary as Record<string, unknown>).health || EMPTY_OBJECT;

  const databaseStorage = (storageInfo as Record<string, unknown>).database || EMPTY_OBJECT;

  const diskInfo = (storageInfo as Record<string, unknown>).disk || EMPTY_OBJECT;

  const storageHealth = (storageInfo as Record<string, unknown>).health || EMPTY_OBJECT;

  const operatorName = useMemo(() => {

    if (!currentUser) return '';

    return ((currentUser as unknown as Record<string, unknown>).fullName as string) || currentUser.username || '';

  }, [currentUser]);



  const syncIndicator = useMemo(() => {

    const syncInfo = (summaryData?.sync as Record<string, unknown>) || {};

    const statusText = (syncInfo.lastStatus as string) || 'Chưa có thống kê';

    const lastRun = syncInfo.lastRunAt ? new Date(syncInfo.lastRunAt as string) : null;

    const lastSummary = (syncInfo.lastSummary as Record<string, unknown>) || {};

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



    const toneClasses: Record<string, { container: string; dot: string }> = {

      good: {

        container:

          'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',

        dot: 'bg-emerald-500 dark:bg-emerald-300',

      },

      warning: {

        container:

          'border-amber-200 bg-ds-warning/10 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',

        dot: 'bg-amber-500 dark:bg-amber-300',

      },

      critical: {

        container:

          'border-red-200 bg-ds-destructive/10 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);



  const infrastructureAlerts = useMemo(() => {

    const items: { key: string; severity: string; message: string }[] = [];

    const seen = new Set<string>();

    const storageHealthData = storageHealth as Record<string, unknown>;
    if (Array.isArray(storageHealthData?.issues)) {

      for (const issue of storageHealthData.issues as Record<string, unknown>[]) {

        if (!issue || !issue.message) continue;

        const key = (issue.code as string) || (issue.message as string);

        if (seen.has(key)) continue;

        seen.add(key);

        items.push({

          key,

          severity: (issue.severity as string) || 'info',

          message: issue.message as string,

        });

      }

    }

    const sqlHealthData = sqlHealth as Record<string, unknown> | null;
    if (sqlHealthData) {

      if (sqlHealthData.ok === false) {

        const severity = sqlHealthData.state === 'timeout' ? 'critical' : 'warning';

        const key = `sql-${sqlHealthData.state || 'error'}`;

        if (!seen.has(key)) {

          seen.add(key);

          items.push({

            key,

            severity,

            message: (sqlHealthData.message as string) || 'Không thể kết nối SQL Server.',

          });

        }

      } else if (sqlHealthData.state === 'not_configured') {

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

    const sqlHealthData = sqlHealth as Record<string, unknown> | null;
    if (!sqlHealthData) {

      return {

        severity: 'info',

        title: 'Chưa có thống kê',

        message: 'Chưa ghi nhận lần kiểm tra kết nối SQL Server nào.',

      };

    }

    if (sqlHealthData.ok) {

      return {

        severity: 'good',

        title: 'Kết nối ổn định',

        message: `Đã kết nối tới ${sqlHealthData.server || 'máy chủ'} / ${sqlHealthData.database || 'CSDL'}.`,

        checkedAt: sqlHealthData.checkedAt ? formatDate(sqlHealthData.checkedAt) : null,

      };

    }

    if (sqlHealthData.state === 'not_configured') {

      return {

        severity: 'info',

        title: 'Chưa cấu hình',

        message: (sqlHealthData.message as string) || 'Chưa cấu hình thông tin SQL Server trong hệ thống.',

      };

    }

    if (sqlHealthData.state === 'timeout') {

      return {

        severity: 'critical',

        title: 'Timeout kết nối',

        message: (sqlHealthData.message as string) || 'Kết nối SQL Server bị hết thời gian phản hồi.',

        checkedAt: sqlHealthData.checkedAt ? formatDate(sqlHealthData.checkedAt) : null,

      };

    }

    return {

      severity: 'warning',

      title: 'Lỗi kết nối',

      message: (sqlHealthData.message as string) || 'Không thể kiểm tra SQL Server.',

      checkedAt: sqlHealthData.checkedAt ? formatDate(sqlHealthData.checkedAt) : null,

    };

  }, [sqlHealth]);



  const metrics = useMemo(() => {

    const totals = (summaryData?.totals as Record<string, unknown>) || {};

    const policyOverview = ((summaryData?.duplicates as Record<string, unknown>)?.policy as Record<string, unknown>) || {};

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

        description: `${(summaryData?.alerts as Record<string, unknown>)?.totalTracked || 0} tờ khai đang theo dõi`,

      },

      {

        label: 'Đồng bộ ECUS gần nhất',

        value: (summaryData?.sync as Record<string, unknown>)?.lastRunAt ? formatDate((summaryData?.sync as Record<string, unknown>).lastRunAt) : 'Chưa chạy',

        description: (summaryData?.sync as Record<string, unknown>)?.lastStatus || 'Chưa có thống kê',

      },

    ];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);



  const policyOverview = ((summaryData?.duplicates as Record<string, unknown>)?.policy as Record<string, unknown>) || {};

  const policyLockedSources = useMemo(() => {

    if (Array.isArray(policyOverview.lockedSources) && policyOverview.lockedSources.length > 0) {

      return policyOverview.lockedSources;

    }

    const policyStateData = policyState as Record<string, unknown> | null;
    if (Array.isArray(policyStateData?.lockedSources)) {

      return policyStateData.lockedSources;

    }

    return [];

  }, [policyOverview.lockedSources, policyState]);



  const policySourceBreakdown = useMemo(() => {

    const sourceBreakdown = ((summaryData?.duplicates as Record<string, unknown>)?.sourceBreakdown);
    if (Array.isArray(sourceBreakdown)) {

      return sourceBreakdown;

    }

    const policyStatsData = policyStats as Record<string, unknown> | null;
    if (Array.isArray(policyStatsData?.sourceBreakdown)) {

      return policyStatsData.sourceBreakdown;

    }

    return [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, policyStats]);



  const policyStatusCounts = useMemo(() => {

    const statusCounts = (summaryData?.duplicates as Record<string, unknown>)?.statusCounts;
    if (statusCounts) {

      return statusCounts;

    }

    const policyStatsData = policyStats as Record<string, unknown> | null;
    if (policyStatsData?.statusCounts) {

      return policyStatsData.statusCounts;

    }

    return { awaitingAction: 0, pendingReview: 0, locked: 0 };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, policyStats]);

  const handlePolicyFieldChange = useCallback((field: string, value: unknown) => {
    setPolicyForm((prev) => ({ ...(prev || {}), [field]: value }));
  }, []);



  const handleSavePolicy = useCallback(async () => {

    if (!canEditPolicy) {

      await alert('Tài khoản hiện không có quyền cấu hình sức khỏe dữ liệu.');

      return;

    }

    if (!policyForm) {

      await alert('Chưa có dữ liệu cấu hình chính sách để lưu.');

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

      const error = err as Error | undefined;
      setPolicyError(error?.message || 'Không thể cập nhật chính sách trùng 11 số');

    } finally {

      setPolicySaving(false);

    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditPolicy, policyForm, reloadSummary]);



  const handleUnlockSource = useCallback(

    async (source: string) => {

      if (!canEditPolicy) {

        await alert('Tài khoản hiện không có quyền chỉnh sửa chính sách dữ liệu.');

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

        const error = err as Error | undefined;
        setPolicyError(error?.message || 'Không thể mở khóa nguồn dữ liệu');

      } finally {

        setPolicySaving(false);

      }

    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEditPolicy, reloadSummary]

  );



  const handleLockSource = useCallback(

    async (source: string) => {

      if (!canEditPolicy) {

        await alert('Tài khoản hiện không có quyền chỉnh sửa chính sách dữ liệu.');

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

        const error = err as Error | undefined;
        setPolicyError(error?.message || 'Không thể khóa nguồn dữ liệu');

      } finally {

        setPolicySaving(false);

      }

    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEditPolicy, reloadSummary]

  );



  const combinedNotifications = useMemo(() => {

    const seen = new Set<string>();

    const merged: unknown[] = [];

    for (const event of [...liveNotifications, ...historyNotifications]) {

      if (!event) continue;

      const e = event as Record<string, unknown>;
      const key = (e.id as string) || `${e.createdAt}_${e.type}`;

      if (seen.has(key)) continue;

      seen.add(key);

      merged.push(event);

    }

    return merged.slice(0, 12);

  }, [liveNotifications, historyNotifications]);

  const policyLastEvaluatedAtLabel = (policyOverview as Record<string, unknown>).lastEvaluatedAt
    ? formatDate((policyOverview as Record<string, unknown>).lastEvaluatedAt)
    : (policyState as Record<string, unknown>)?.lastEvaluatedAt
    ? formatDate((policyState as Record<string, unknown>).lastEvaluatedAt)
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
    alertLastEvaluatedAt: (summaryData?.alerts as Record<string, unknown>)?.lastEvaluatedAt || null,
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



  const healthTabs = [
    { id: "all", label: "Tổng quan", icon: LayoutDashboard },
    { id: "duplicates", label: "Trùng lặp", icon: Database },
    { id: "missing", label: "Thiếu dữ liệu", icon: AlertTriangle },
    { id: "ecus", label: "ECUS", icon: Server },
    { id: "alerts", label: "Cảnh báo", icon: Bell },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Page Header */}
      <PageHeader
        eyebrow="GIÁM SÁT"
        title="Sức khỏe Dữ liệu"
        info="Theo dõi chất lượng dữ liệu tờ khai và trạng thái đồng bộ hệ thống"
        meta={[
          summaryLoading || rolloutLoading ? "Đang tải..." : "Đã cập nhật",
        ]}
        actions={
          <button
            onClick={handleRefresh}
            disabled={summaryLoading || rolloutLoading}
            className="px-3 py-1.5 text-sm font-medium bg-ds-surface-card border border-ds-border-subtle rounded-md hover:bg-ds-surface-muted disabled:opacity-50 transition-colors"
          >
            {summaryLoading || rolloutLoading ? 'Đang tải…' : 'Làm mới'}
          </button>
        }
      />

      {/* Permission Banner */}
      {!canManage && (
        <PermissionBanner
          level="info"
          title={t('health.readOnly.title') || "Chế độ xem"}
          description={t('health.readOnly.desc') || "Bạn chỉ có thể xem thông tin sức khỏe dữ liệu, không thể chỉnh sửa cấu hình."}
        />
      )}

      {/* Error Banner */}
      {(summaryError || rolloutError) && (
        <PermissionBanner
          level="error"
          title={t('health.error.title') || "Lỗi tải dữ liệu"}
          description={summaryError || rolloutError || "Không thể tải thông tin sức khỏe dữ liệu"}
        />
      )}

      {/* Page Tabs */}
      <div className="border-b border-ds-border-subtle">
        <div className="flex gap-1">
          {healthTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-ds-accent text-ds-accent'
                    : 'border-transparent text-ds-text-secondary hover:text-ds-text-primary'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Overview Tab - All panels */}
        {activeTab === "all" && (
          <>
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
          </>
        )}

        {/* Duplicates Tab */}
        {activeTab === "duplicates" && (
          <>
            <DataHealthMetricsAlertsPanel
              metrics={metricCards}
              duplicateSummary={duplicateSummaryCard}
              alertSummary={null}
            />
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
          </>
        )}

        {/* Missing Data Tab */}
        {activeTab === "missing" && (
          <DataHealthMetricsAlertsPanel
            metrics={metricCards}
            duplicateSummary={null}
            alertSummary={null}
          />
        )}

        {/* ECUS Tab */}
        {activeTab === "ecus" && (
          <>
            <DataHealthInfrastructureStatusPanel alerts={infrastructureStatusAlerts} sync={infrastructureSyncStatus} />
            <DataHealthRolloutStatusPanel
              rollout={rolloutSummary}
              loading={rolloutLoading}
              error={rolloutError}
            />
            <DataHealthActivityFeedsPanel sqlEvents={activityFeedsPanel.sqlEvents} notifications={[]} />
          </>
        )}

        {/* Alerts Tab */}
        {activeTab === "alerts" && (
          <>
            <DataHealthMetricsAlertsPanel
              metrics={[]}
              duplicateSummary={null}
              alertSummary={alertSummaryCard}
            />
            <DataHealthActivityFeedsPanel sqlEvents={[]} notifications={activityFeedsPanel.notifications} />
          </>
        )}
      </div>
    </div>

  );

}
