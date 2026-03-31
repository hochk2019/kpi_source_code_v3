/* eslint-env node */
/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  createLegacyAlertsDomain,
  DEFAULT_ALERT_CONFIG,
  DEFAULT_ALERT_STATE,
} from '../server-v4/src/modules/alerts/alertsLegacyDomain.js';

function createHarness({ initialRows = [], initialKv = {} } = {}) {
  const kv = new Map(Object.entries(initialKv));
  let rows = initialRows.map((row) => ({ ...row }));

  const pushAuditLog = vi.fn();
  const pushNotification = vi.fn();

  const domain = createLegacyAlertsDomain({
    getJSONValue: (key, fallback) => (kv.has(key) ? kv.get(key) : fallback),
    setJSONValue: (key, value) => {
      kv.set(key, value);
    },
    getDeclRows: () => rows.map((row) => ({ ...row })),
    getDeclarationKey: (row) => `${row.so_tk ?? ''}_${String(row.nhanh ?? '').trim()}`,
    writeDeclRows: (nextRows) => {
      rows = nextRows.map((row) => ({ ...row }));
    },
    pushAuditLog,
    pushNotification,
    normalizeStr: (value) => String(value ?? '').trim(),
  });

  return {
    domain,
    kv,
    getRows: () => rows.map((row) => ({ ...row })),
    pushAuditLog,
    pushNotification,
  };
}

describe('alerts legacy domain', () => {
  it('merges and persists alert config through storage helpers', () => {
    const harness = createHarness();

    expect(harness.domain.getAlertConfig()).toEqual(DEFAULT_ALERT_CONFIG);

    const saved = harness.domain.saveAlertConfig({ thresholdDays: 7, enabled: false });
    expect(saved).toMatchObject({ thresholdDays: 7, enabled: false, channel: 'audit' });
    expect(harness.kv.get('decl_alert_config_v1')).toMatchObject({ thresholdDays: 7, enabled: false });
    expect(harness.domain.getAlertConfig()).toMatchObject({ thresholdDays: 7, enabled: false });
  });

  it('evaluates declaration alerts and builds payload summary', () => {
    const harness = createHarness({
      initialRows: [
        {
          so_tk: 'TK-001',
          nhanh: 'CN1',
          mst: '0101',
          cong_ty: 'Demo Co',
          date: '2025-01-01T00:00:00.000Z',
          nhan_vien: '',
          team: '',
        },
      ],
      initialKv: {
        decl_alert_state_v1: { ...DEFAULT_ALERT_STATE },
      },
    });

    const summary = harness.domain.evaluateDeclarationAlerts({ actor: 'tester', reason: 'manual' });
    expect(summary).toEqual({ total: 1, outstanding: 1, triggered: 1 });

    const payload = harness.domain.buildAlertPayload();
    expect(payload.summary).toMatchObject({ outstanding: 1, totalTracked: 1 });
    expect(payload.alerts[0]).toMatchObject({
      so_tk: 'TK-001',
      missing: ['nhân viên', 'tổ đội'],
      resolved: false,
    });

    expect(harness.pushAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'decl.alert', actor: 'tester' }),
    );
    expect(harness.pushNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'import.alerts.triggered', severity: 'warning' }),
    );
  });

  it('marks and unmarks reviewed declarations while emitting events', () => {
    const harness = createHarness({
      initialRows: [
        {
          so_tk: 'TK-002',
          nhanh: 'CN2',
          mst: '0202',
          cong_ty: 'Review Co',
          date: '2025-01-01T00:00:00.000Z',
          nhan_vien: '',
          team: '',
        },
      ],
    });

    const key = 'TK-002_CN2';
    const marked = harness.domain.markDeclarationsReviewed([key], { actor: 'lead' });
    expect(marked).toBe(1);
    expect(harness.getRows()[0].reviewed).toBe(true);

    const unmarked = harness.domain.unmarkDeclarationsReviewed([key], { actor: 'lead' });
    expect(unmarked).toBe(1);
    expect(harness.getRows()[0].reviewed).toBeUndefined();

    const notificationTypes = harness.pushNotification.mock.calls.map((call) => call[0]?.type);
    expect(notificationTypes).toContain('import.alerts.reviewed');
    expect(notificationTypes).toContain('import.alerts.unreviewed');
  });
});
