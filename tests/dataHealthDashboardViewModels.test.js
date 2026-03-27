import { describe, expect, it, vi } from 'vitest';

import { buildDataHealthDashboardViewModels } from '@/components/data-health-dashboard/dataHealthDashboardViewModels.js';

function createSubject(overrides = {}) {
  return buildDataHealthDashboardViewModels({
    alertEntries: [
      {
        key: 'alert-1',
        so_tk: '102030',
        date: '2026-03-27T00:00:00.000Z',
        mst: '0101',
        company: 'Cong ty A',
        missing: ['MST', 'Nhan vien'],
        staff: '',
        team: '',
        lastAlertAt: '2026-03-27T10:00:00.000Z',
      },
    ],
    alertLastEvaluatedAt: '2026-03-27T11:00:00.000Z',
    backupSummary: {
      schedule: { directory: 'D:/backup', nextRunHuman: '28/03/2026 00:00' },
      lastSuccess: { ts: '2026-03-27T09:00:00.000Z', meta: { file: 'backup.sqlite' } },
      lastFailure: { ts: '2026-03-27T08:00:00.000Z', meta: { reason: 'disk_full' } },
      recent: [{ ts: '2026-03-27T09:00:00.000Z', action: 'backup', detail: 'done', meta: { status: 'success' } }],
    },
    backupHealth: { severity: 'warning', lastSuccessAt: '2026-03-27T09:00:00.000Z' },
    combinedNotifications: [{ id: 'n1', type: 'info', createdAt: '2026-03-27T09:00:00.000Z', title: 'Sync', message: 'Done' }],
    databaseStorage: {
      file: 'db.sqlite',
      sizeBytes: 1024,
      lastModifiedAt: '2026-03-27T09:00:00.000Z',
      sqliteStats: { pageCount: 10, freelistCount: 2, pageSizeBytes: 4096, usedBytes: 32768, freeBytes: 8192, usedPercent: 80, freePercent: 20 },
    },
    describeDiskWarning: vi.fn(() => 'Canh bao dung luong'),
    diskInfo: { usedPercent: 75, usedBytes: 750, freeBytes: 250, totalBytes: 1000, method: 'powershell' },
    duplicateGroups: [{ key: 'dup-1', prefix: '010', total: 2, keep: { so_tk_full: 'TK1', updatedAt: '2026-03-27T09:00:00.000Z' }, duplicates: [{ so_tk_full: 'TK2', updatedAt: '2026-03-27T08:00:00.000Z' }] }],
    formatBytes: (value) => `${value}B`,
    formatDate: (value) => `DATE:${value}`,
    formatDateOnly: (value) => `DAY:${value}`,
    formatPercent: (value) => `${value}%`,
    formatRelativeTime: (value) => `REL:${value}`,
    infrastructureAlerts: [{ key: 'disk', severity: 'warning', message: 'Disk warning' }],
    metrics: [{ label: 'Tong to khai', value: 5, description: 'Dang luu' }],
    metricPalette: ['bg-slate-100'],
    operatorName: 'sam',
    policyActionsDisabled: false,
    policyLastEvaluatedAtLabel: '27/03/2026 11:00',
    policyLockedSources: [{ source: 'ECUS-HCM', lockedBy: 'sam', lockedAt: '2026-03-27T10:00:00.000Z', reason: 'Review' }],
    policySourceBreakdown: [{ source: 'ECUS-HCM', awaitingActionGroups: 3, pendingReviewGroups: 1, locked: true, lockedAt: '2026-03-27T10:00:00.000Z', lockedReason: 'Review' }],
    policyStatusCounts: { awaitingAction: 3, pendingReview: 1, locked: 1 },
    severityLabels: { info: 'Thong tin', warning: 'Canh bao' },
    severityStyles: {
      info: { badge: 'info-badge', container: 'info-box', dot: 'info-dot' },
      warning: { badge: 'warn-badge', container: 'warn-box', dot: 'warn-dot' },
      good: { badge: 'good-badge', container: 'good-box', dot: 'good-dot' },
      critical: { badge: 'critical-badge', container: 'critical-box', dot: 'critical-dot' },
    },
    sqlHealth: { code: 'ETIMEOUT', number: '1234' },
    sqlHealthIndicator: { severity: 'warning', title: 'Timeout', message: 'Mat ket noi', checkedAt: 'DATE:2026-03-27T09:00:00.000Z' },
    sqlTimeouts: [{ at: '2026-03-27T09:00:00.000Z', message: 'Timeout', context: { server: 'sql-1' } }],
    storageHealth: { severity: 'warning' },
    syncIndicator: {
      classes: { container: 'sync-box', dot: 'sync-dot' },
      overview: 'Dong bo on dinh',
      lastRunLabel: 'DATE:2026-03-27T09:00:00.000Z',
      relative: '5 phut truoc',
      statusText: 'OK',
    },
    handleLockSource: vi.fn(),
    handleUnlockSource: vi.fn(),
    ...overrides,
  });
}

describe('buildDataHealthDashboardViewModels', () => {
  it('xay dung cac card va panel model tu du lieu thô', () => {
    const subject = createSubject();

    expect(subject.backupCard.severityLabel).toBe('Canh bao');
    expect(subject.backupCard.directory).toBe('D:/backup');
    expect(subject.databaseCard.methodLabel).toBe('PowerShell');
    expect(subject.sqlCard.code).toBe('ETIMEOUT');
    expect(subject.metricCards[0].toneClass).toBe('bg-slate-100');
    expect(subject.duplicateSummaryCard.groups[0].duplicates[0].label).toContain('TK2');
    expect(subject.alertSummaryCard.entries[0].missingLabel).toBe('MST, Nhan vien');
    expect(subject.alertSummaryCard.lastEvaluatedAtLabel).toBe('DATE:2026-03-27T11:00:00.000Z');
    expect(subject.infrastructureStatusAlerts[0].containerClass).toBe('warn-box');
    expect(subject.infrastructureSyncStatus.operatorName).toBe('sam');
    expect(subject.activityFeedsPanel.notifications.countLabel).toBe('1 sự kiện mới');
    expect(subject.policySourcesPanel.sources[0].actionLabel).toBe('Mở khóa');
    expect(subject.policySourcesPanel.lockedSources[0].lockedByLabel).toBe('sam');
  });

  it('fallback ve gia tri mac dinh khi du lieu thieu', () => {
    const subject = createSubject({
      backupSummary: {},
      backupHealth: {},
      combinedNotifications: [],
      duplicateGroups: [],
      infrastructureAlerts: [],
      policyLockedSources: [],
      policySourceBreakdown: [],
      sqlTimeouts: [],
    });

    expect(subject.backupCard.lastSuccessAtLabel).toBe('Chưa có');
    expect(subject.backupCard.recentEntries).toEqual([]);
    expect(subject.duplicateSummaryCard.countLabel).toBe('0 nhóm gần nhất');
    expect(subject.activityFeedsPanel.notifications.entries).toEqual([]);
    expect(subject.policySourcesPanel.lockedSources).toEqual([]);
  });
});
