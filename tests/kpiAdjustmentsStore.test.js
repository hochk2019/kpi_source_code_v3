import { describe, expect, it, vi } from 'vitest';

import {
  KPI_ADJUSTMENTS_KEY,
  KPI_ADJUSTMENT_SETTINGS_KEY,
  createKpiAdjustmentStore,
} from '@/lib/kpiAdjustments.js';

function createAdjustmentHarness(initialState = {}) {
  const storage = new Map(Object.entries(initialState));
  const refreshSharedKeys = vi.fn();
  const pushAuditLog = vi.fn();

  const store = createKpiAdjustmentStore({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); return Promise.resolve(); },
    refreshSharedKeys,
    pushAuditLog,
    normalizeStr: (value) => String(value ?? '').trim(),
    normalizeMST: (value) => String(value ?? '').trim(),
    roundAdjustmentPoint: (value, precision = 2) => {
      if (!Number.isFinite(value)) return value;
      const factor = 10 ** precision;
      return Math.round(value * factor) / factor;
    },
  });

  return {
    getStoredJson: (key) => storage.get(key),
    pushAuditLog,
    refreshSharedKeys,
    store,
  };
}

describe('kpiAdjustments store factory', () => {
  it('returns builtin defaults when no settings are stored', () => {
    const { store } = createAdjustmentHarness();

    const settings = store.getKpiAdjustmentSettings();

    expect(settings.autoApprove.enabled).toBe(false);
    expect(settings.categories.tax_refund_customer).toEqual(
      expect.objectContaining({
        extraUnitPoints: 0.5,
      }),
    );
  });

  it('persists normalized settings and refreshes the shared key', async () => {
    const { getStoredJson, pushAuditLog, refreshSharedKeys, store } = createAdjustmentHarness();

    const result = await store.saveKpiAdjustmentSettings(
      {
        categories: {
          support_fixed: {
            defaultUnit: 0.25,
          },
          tax_refund_customer: {
            extraUnitPoints: 0.75,
          },
        },
        autoApprove: {
          enabled: true,
          note: '  Duyet nhanh  ',
        },
      },
      {
        actor: 'lead',
        permissions: { adjustApprove: true },
      },
    );

    expect(result.categories.support_fixed).toEqual(
      expect.objectContaining({
        defaultUnit: 0.25,
      }),
    );
    expect(result.categories.tax_refund_customer).toEqual(
      expect.objectContaining({
        extraUnitPoints: 0.75,
      }),
    );
    expect(result.autoApprove).toEqual(
      expect.objectContaining({
        enabled: true,
        note: 'Duyet nhanh',
        updatedBy: 'lead',
      }),
    );
    expect(JSON.parse(getStoredJson(KPI_ADJUSTMENT_SETTINGS_KEY))).toEqual(
      expect.objectContaining({
        autoApprove: expect.objectContaining({
          enabled: true,
          note: 'Duyet nhanh',
        }),
      }),
    );
    expect(refreshSharedKeys).toHaveBeenCalledWith([KPI_ADJUSTMENT_SETTINGS_KEY]);
    expect(pushAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'kpi.adjustment.defaults',
      }),
    );
  });

  it('auto-approves new adjustments and groups only approved items by month', async () => {
    const { getStoredJson, refreshSharedKeys, store } = createAdjustmentHarness();

    await store.saveKpiAdjustmentSettings(
      {
        autoApprove: {
          enabled: true,
          note: 'Duyet tu dong',
        },
      },
      {
        actor: 'manager',
        permissions: { adjustApprove: true },
      },
    );

    const entry = await store.saveKpiAdjustment(
      {
        month: '2026-03',
        category: 'support_fixed',
        staffCode: 'NV01',
        staffName: 'Lan',
        quantity: 4,
        note: 'Bo sung ho tro',
      },
      {
        actor: 'staff',
        permissions: { adjustSubmit: true },
      },
    );

    expect(entry.status).toBe('approved');
    expect(entry.approvedBy).toBe('manager');
    expect(entry.totalPoints).toBe(0.2);

    const grouped = store.mapAdjustmentsByMonth(store.getKpiAdjustments());
    expect(grouped.get('2026-03')).toEqual([expect.objectContaining({ id: entry.id })]);
    expect(JSON.parse(getStoredJson(KPI_ADJUSTMENTS_KEY))).toHaveLength(1);
    expect(refreshSharedKeys).toHaveBeenCalledWith([KPI_ADJUSTMENT_SETTINGS_KEY]);
  });
});
