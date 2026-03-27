import clsx from 'clsx';

import { translateBackupFailure, translateBackupReason } from '../../../packages/domain/src/backupMessages.js';

export function buildDataHealthDashboardViewModels({
  alertEntries = [],
  alertLastEvaluatedAt = null,
  backupSummary = {},
  backupHealth = {},
  combinedNotifications = [],
  databaseStorage = {},
  describeDiskWarning,
  diskInfo = {},
  duplicateGroups = [],
  formatBytes,
  formatDate,
  formatDateOnly,
  formatPercent,
  formatRelativeTime,
  infrastructureAlerts = [],
  metrics = [],
  metricPalette = [],
  operatorName = '',
  policyActionsDisabled = false,
  policyLastEvaluatedAtLabel = 'Chưa có',
  policyLockedSources = [],
  policySourceBreakdown = [],
  policyStatusCounts = {},
  severityLabels = {},
  severityStyles = {},
  sqlHealth = null,
  sqlHealthIndicator = {},
  sqlTimeouts = [],
  storageHealth = {},
  syncIndicator = {},
  handleLockSource,
  handleUnlockSource,
}) {
  const backupSchedule = backupSummary.schedule || {};
  const backupSeverity = severityStyles[backupHealth.severity] || severityStyles.info;
  const backupSeverityLabel = severityLabels[backupHealth.severity] || 'Thông tin';
  const lastBackupAt = backupSummary.lastSuccess?.ts ? formatDate(backupSummary.lastSuccess.ts) : 'Chưa có';
  const lastBackupRelative = backupHealth.lastSuccessAt ? formatRelativeTime(backupHealth.lastSuccessAt) : 'Không xác định';
  const lastBackupFile = backupSummary.lastSuccess?.meta?.file || '—';
  const lastFailureAt = backupSummary.lastFailure?.ts ? formatDate(backupSummary.lastFailure.ts) : null;
  const lastFailureReason = backupSummary.lastFailure?.meta?.reason
    ? translateBackupFailure(backupSummary.lastFailure.meta.reason)
    : '';
  const nextBackupRun = backupSchedule.active === false ? 'Đang tắt' : backupSchedule.nextRunHuman || 'Không xác định';
  const scheduleReasons = Array.isArray(backupSchedule.reasons) ? backupSchedule.reasons : [];

  const databaseSizeLabel = databaseStorage.sizeLabel || formatBytes(databaseStorage.sizeBytes);
  const databaseUpdatedAt = databaseStorage.lastModifiedAt ? formatDate(databaseStorage.lastModifiedAt) : 'Không rõ';
  const sqliteStats = databaseStorage.sqliteStats || {};
  const sqliteStatsAvailable = typeof sqliteStats.pageCount === 'number' && sqliteStats.pageCount >= 0;
  const sqliteTotalPages = sqliteStatsAvailable ? sqliteStats.pageCount : null;
  const sqliteFreePages = sqliteStatsAvailable ? sqliteStats.freelistCount ?? 0 : null;
  const sqliteUsedPages = sqliteStatsAvailable && sqliteTotalPages !== null ? Math.max(0, sqliteTotalPages - (sqliteFreePages ?? 0)) : null;
  const sqlitePageSizeLabel = Number.isFinite(sqliteStats.pageSizeBytes) ? formatBytes(sqliteStats.pageSizeBytes) : '—';
  const sqliteUsedLabel = Number.isFinite(sqliteStats.usedBytes) ? formatBytes(sqliteStats.usedBytes) : '—';
  const sqliteHasFreeBytes = Number.isFinite(sqliteStats.freeBytes);
  const sqliteFreeLabel = sqliteHasFreeBytes ? formatBytes(sqliteStats.freeBytes) : '—';
  const sqliteUsedPercentLabel = Number.isFinite(sqliteStats.usedPercent) ? formatPercent(sqliteStats.usedPercent) : null;
  const sqliteFreePercentLabel = Number.isFinite(sqliteStats.freePercent) ? formatPercent(sqliteStats.freePercent) : null;
  const diskUsedPercent = typeof diskInfo.usedPercent === 'number' ? Math.max(0, Math.min(100, diskInfo.usedPercent)) : null;
  const diskUsedLabel = diskInfo.usedLabel || formatBytes(diskInfo.usedBytes);
  const diskFreeLabel = diskInfo.freeLabel || formatBytes(diskInfo.freeBytes);
  const diskTotalLabel = diskInfo.totalLabel || formatBytes(diskInfo.totalBytes);
  const diskSeverity = severityStyles[storageHealth.severity] || severityStyles.info;
  const diskWarningMessage = describeDiskWarning(diskInfo);
  const backupRecentEntries = (backupSummary.recent || []).slice(0, 4).map((entry) => {
    const status = entry?.meta?.status || 'unknown';
    const statusTone =
      status === 'success'
        ? severityStyles.good
        : status === 'failure'
        ? severityStyles.critical
        : severityStyles.info;

    return {
      id: entry.ts || `${entry.action}_${entry.detail}`,
      statusLabel: status === 'success' ? 'Thành công' : status === 'failure' ? 'Thất bại' : 'Khác',
      toneClass: statusTone.container,
      timestampLabel: formatDate(entry.ts),
      detail: entry.detail || '—',
      reasonLabel: entry.meta?.reason
        ? status === 'failure'
          ? translateBackupFailure(entry.meta.reason)
          : translateBackupReason(entry.meta.reason)
        : '',
    };
  });

  const diskMethodLabel = !diskInfo.method
    ? ''
    : diskInfo.method === 'statfs'
    ? 'Hệ điều hành (statfs)'
    : diskInfo.method === 'df'
    ? 'Lệnh df'
    : 'PowerShell';

  const backupCard = {
    badgeClass: backupSeverity.badge,
    severityLabel: backupSeverityLabel,
    lastSuccessAtLabel: lastBackupAt,
    relativeLabel: lastBackupRelative,
    directory: backupSchedule.directory || '—',
    fileLabel: lastBackupFile,
    nextRunLabel: nextBackupRun,
    lastFailureAtLabel: lastFailureAt,
    lastFailureReason,
    scheduleReasons: scheduleReasons.map((reason) => translateBackupReason(reason) || reason),
    recentEntries: backupRecentEntries,
  };

  const databaseCard = {
    badgeClass: diskSeverity.badge,
    severityLabel: severityLabels[storageHealth.severity] || 'Thông tin',
    file: databaseStorage.file || '—',
    sizeLabel: databaseSizeLabel,
    updatedAtLabel: databaseUpdatedAt,
    sqliteStatsAvailable,
    sqliteUsedPages,
    sqliteTotalPages,
    sqliteUsedPercentLabel,
    sqliteFreePages,
    sqliteFreePercentLabel,
    sqliteHasFreeBytes,
    sqliteFreeLabel,
    sqlitePageSizeLabel,
    sqliteUsedLabel,
    isMemoryDb: databaseStorage.warningCode === 'memory_db',
    sqliteStatsError: databaseStorage.sqliteStatsError || '',
    diskUsedLabel,
    diskUsedPercentLabel: diskUsedPercent !== null ? formatPercent(diskUsedPercent) : '—',
    diskUsedPercentWidth: diskUsedPercent !== null ? Math.min(100, Math.max(0, diskUsedPercent)) : 0,
    diskFreeLabel,
    diskTotalLabel,
    methodLabel: diskMethodLabel,
    warningMessage: diskWarningMessage,
  };

  const sqlCard = {
    badgeClass: (severityStyles[sqlHealthIndicator.severity] || severityStyles.info).badge,
    severityLabel: severityLabels[sqlHealthIndicator.severity] || 'Thông tin',
    title: sqlHealthIndicator.title,
    message: sqlHealthIndicator.message,
    checkedAtLabel: sqlHealthIndicator.checkedAt,
    code: sqlHealth?.code || '',
    number: sqlHealth?.number || '',
  };

  const metricCards = metrics.map((metric, index) => ({
    ...metric,
    toneClass: metricPalette[index % metricPalette.length],
  }));

  const duplicateSummaryCard = {
    countLabel: `${duplicateGroups.length} nhóm gần nhất`,
    groups: duplicateGroups.map((group) => ({
      key: group.key,
      prefix: group.prefix,
      totalLabel: `${group.total} bản ghi`,
      branch: group.branch || '',
      keepLabel: `${group.keep?.so_tk_full || group.keep?.so_tk || '—'} • Cập nhật: ${formatDate(group.keep?.updatedAt)}`,
      duplicates: (group.duplicates || []).slice(0, 4).map((row, index) => ({
        key: `${group.key}_${row.so_tk || index}`,
        label: `${row.so_tk_full || row.so_tk} • NV: ${row.staff || '—'} • Tổ: ${row.team || '—'} • Cập nhật ${formatDate(row.updatedAt)}`,
      })),
      remainingLabel:
        (group.duplicates || []).length > 4 ? `… ${(group.duplicates || []).length - 4} bản ghi khác` : '',
    })),
  };

  const alertSummaryCard = {
    lastEvaluatedAtLabel: alertLastEvaluatedAt ? formatDate(alertLastEvaluatedAt) : 'Chưa có',
    entries: alertEntries.map((alert) => ({
      key: alert.key,
      soTkLabel: alert.so_tk,
      dateLabel: formatDateOnly(alert.date),
      mstLabel: alert.mst || '—',
      companyLabel: alert.company || '—',
      missingLabel: Array.isArray(alert.missing) ? alert.missing.join(', ') : '—',
      staffLabel: alert.staff || 'Chưa gán',
      teamLabel: alert.team || 'Chưa gán',
      lastAlertAtLabel: formatDate(alert.lastAlertAt),
    })),
  };

  const infrastructureStatusAlerts = infrastructureAlerts.map((alert) => {
    const tone = severityStyles[alert.severity] || severityStyles.info;
    return {
      key: alert.key,
      containerClass: tone.container,
      dotClass: tone.dot,
      severityLabel: severityLabels[alert.severity] || 'Thông tin',
      message: alert.message,
    };
  });

  const infrastructureSyncStatus = {
    containerClass: syncIndicator.classes?.container,
    dotClass: syncIndicator.classes?.dot,
    overview: syncIndicator.overview,
    lastRunLabel: syncIndicator.lastRunLabel,
    relative: syncIndicator.relative,
    statusText: syncIndicator.statusText,
    operatorName,
  };

  const activityFeedsPanel = {
    sqlEvents: sqlTimeouts.map((event, index) => ({
      key: event.at || `${event.message || 'timeout'}_${index}`,
      atLabel: formatDate(event.at),
      message: event.message || 'Timeout kết nối SQL Server',
      contextLabel: event.context ? JSON.stringify(event.context, null, 2) : '',
    })),
    notifications: {
      countLabel: `${combinedNotifications.length} sự kiện mới`,
      entries: combinedNotifications.map((event, index) => ({
        key: event.id || `${event.createdAt || 'unknown'}_${event.type || 'notification'}_${index}`,
        containerClass: clsx(
          event.severity === 'error' && 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',
          event.severity === 'warning' &&
            'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
          event.severity === 'success' &&
            'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',
          (!event.severity || event.severity === 'info') &&
            'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
        ),
        typeLabel: event.type || 'thông báo',
        createdAtLabel: formatDate(event.createdAt),
        title: event.title || '',
        message: event.message || '',
      })),
    },
  };

  const policySourcesPanel = {
    statusSummary: {
      awaitingActionLabel: policyStatusCounts.awaitingAction || 0,
      pendingReviewLabel: policyStatusCounts.pendingReview || 0,
      lockedLabel: policyStatusCounts.locked || 0,
      lastEvaluatedAtLabel: policyLastEvaluatedAtLabel,
    },
    sources: policySourceBreakdown.map((item) => ({
      key: item.source,
      source: item.source,
      awaitingActionLabel: item.awaitingActionGroups || 0,
      pendingReviewLabel: item.pendingReviewGroups || 0,
      locked: !!item.locked,
      actionLabel: item.locked ? 'Mở khóa' : 'Khóa nguồn',
      actionToneClass: item.locked
        ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-400/10'
        : 'border-amber-500 text-amber-600 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-400/10',
      lockedAtLabel: item.locked && item.lockedAt ? formatDate(item.lockedAt) : '',
      lockedReasonLabel: item.lockedReason || '',
    })),
    lockedSources: policyLockedSources.map((item) => ({
      key: item.source,
      source: item.source,
      lockedByLabel: item.lockedBy || 'Hệ thống',
      lockedAtLabel: item.lockedAt ? formatDate(item.lockedAt) : 'Không rõ thời gian',
      reasonLabel: item.reason || '',
    })),
    actionsDisabled: policyActionsDisabled,
    onLockSource: handleLockSource,
    onUnlockSource: handleUnlockSource,
  };

  return {
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
  };
}
