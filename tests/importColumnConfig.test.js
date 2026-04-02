import { describe, expect, it, vi } from 'vitest';

import {
  IMPORT_COLUMN_IDS,
  IMPORT_SENSITIVE_COLUMNS,
  createImportColumnConfigStore,
} from '@/lib/importColumnConfig.js';

function createImportConfigHarness(initialLayout = {}) {
  let layoutState = initialLayout;
  const subscribers = new Set();
  const pushAuditLog = vi.fn();

  const readUILayoutConfig = () => ({ ...layoutState });
  const writeUILayoutConfig = (next) => {
    layoutState = next && typeof next === 'object' ? { ...next } : {};
    return layoutState;
  };
  const subscribeKey = vi.fn((_key, listener) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  });

  const store = createImportColumnConfigStore({
    readUILayoutConfig,
    writeUILayoutConfig,
    subscribeKey,
    pushAuditLog,
    uiLayoutKey: 'ui_layout_config_v1',
  });

  return {
    getLayoutState: () => layoutState,
    notifySubscribers: () => {
      for (const listener of subscribers) {
        listener();
      }
    },
    pushAuditLog,
    store,
    subscribeKey,
  };
}

describe('importColumnConfig', () => {
  it('defaults to hiding sensitive columns when no config is stored', () => {
    const { store } = createImportConfigHarness();

    const config = store.getImportColumnConfig();

    expect(Array.isArray(config.hidden)).toBe(true);
    expect(config.hidden.slice().sort()).toEqual([...IMPORT_SENSITIVE_COLUMNS].sort());
    expect(config.version).toBeGreaterThanOrEqual(2);
    expect(config.widths).toEqual({});
  });

  it('upgrades legacy configs by adding sensitive columns', () => {
    const { store } = createImportConfigHarness({
      importData: {
        columns: {
          hidden: [IMPORT_COLUMN_IDS[0]],
        },
      },
    });

    const config = store.getImportColumnConfig();

    expect(config.hidden.slice().sort()).toEqual(
      [...new Set([...IMPORT_SENSITIVE_COLUMNS, IMPORT_COLUMN_IDS[0]])].sort(),
    );
    expect(config.version).toBeGreaterThanOrEqual(2);
  });

  it('normalizes hidden columns and widths when saving', () => {
    const { getLayoutState, pushAuditLog, store } = createImportConfigHarness();

    const result = store.saveImportColumnConfig(
      {
        hidden: [
          IMPORT_COLUMN_IDS[0],
          'khong_ton_tai',
          IMPORT_COLUMN_IDS[0],
          IMPORT_COLUMN_IDS[1],
          'history',
          'update',
          'status',
        ],
        widths: { date: 150.6, declaration: 60, khong_hop_le: 200 },
      },
      { actor: 'admin' },
    );

    expect(result.hidden.slice().sort()).toEqual(
      [...new Set([IMPORT_COLUMN_IDS[0], IMPORT_COLUMN_IDS[1], 'history', 'update', 'status'])].sort(),
    );
    expect(result.widths.date).toBe(151);
    expect(result.widths.declaration).toBe(80);
    expect(result.widths.khong_hop_le).toBeUndefined();
    expect(getLayoutState().importData.columns.hidden.slice().sort()).toEqual(result.hidden.slice().sort());
    expect(pushAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'import.columns.update',
      }),
    );
  });

  it('refuses to hide every base column', () => {
    const { getLayoutState, store } = createImportConfigHarness();

    const result = store.saveImportColumnConfig({
      hidden: [...IMPORT_COLUMN_IDS, 'history', 'update'],
    });

    const hiddenBaseColumns = result.hidden.filter((key) => IMPORT_COLUMN_IDS.includes(key));
    expect(hiddenBaseColumns.length).toBeLessThan(IMPORT_COLUMN_IDS.length);
    expect(getLayoutState().importData).toBeUndefined();
  });

  it('subscribes to layout updates and emits normalized config', () => {
    const { notifySubscribers, store, subscribeKey } = createImportConfigHarness();
    const listener = vi.fn();

    const unsubscribe = store.subscribeImportColumnConfig(listener);

    expect(subscribeKey).toHaveBeenCalledWith('ui_layout_config_v1', expect.any(Function));
    expect(listener).toHaveBeenCalledTimes(1);

    store.saveImportColumnConfig({ hidden: [IMPORT_COLUMN_IDS[0]] });
    notifySubscribers();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hidden: expect.arrayContaining([IMPORT_COLUMN_IDS[0]]),
      }),
    );

    unsubscribe();
  });
});
