import { beforeEach, describe, expect, it } from 'vitest';

import {
  getKpiAdjustmentFilterState,
  saveKpiAdjustmentFilterState,
  UI_LAYOUT_KEY,
} from '@/lib/store.js';
import {
  clearStorageCache,
  getItem as sharedGetItem,
  setItem as sharedSetItem,
} from '@/lib/storageClient.js';

function readLayout() {
  const raw = sharedGetItem(UI_LAYOUT_KEY);
  return raw ? JSON.parse(raw) : {};
}

describe('KPI adjustment filter persistence', () => {
  beforeEach(() => {
    clearStorageCache();
    sharedSetItem(UI_LAYOUT_KEY, JSON.stringify({}));
  });

  it('stores normalized filters per user identity and keeps them across reads', () => {
    const initial = getKpiAdjustmentFilterState('linh.nguyen', {
      allowStaffFilter: true,
      staffKeyAvailable: true,
    });
    expect(initial).toEqual({
      month: 'all',
      status: 'all',
      mineOnly: false,
      staff: 'all',
      pageSize: 25,
    });

    const saved = saveKpiAdjustmentFilterState(
      'linh.nguyen',
      {
        month: '2025-04',
        status: 'Approved',
        mineOnly: false,
        staff: ' Anh Lê ',
        pageSize: 100,
      },
      {
        allowStaffFilter: true,
        staffKeyAvailable: true,
      }
    );

    expect(saved).toEqual({
      month: '2025-04',
      status: 'approved',
      mineOnly: false,
      staff: 'Anh Lê',
      pageSize: 100,
    });

    const layout = readLayout();
    expect(layout?.kpiAdjustments?.filters?.['linh.nguyen']).toEqual(saved);

    const reread = getKpiAdjustmentFilterState('linh.nguyen', {
      allowStaffFilter: true,
      staffKeyAvailable: true,
    });
    expect(reread).toEqual(saved);
  });

  it('rejects invalid values and resets staff filter when mineOnly is active', () => {
    const normalized = saveKpiAdjustmentFilterState(
      'thanh.pham',
      {
        month: '2025-13',
        status: 'unknown',
        pageSize: 999,
        staff: 'huong',
      },
      {
        allowStaffFilter: true,
        staffKeyAvailable: true,
      }
    );

    expect(normalized).toEqual({
      month: 'all',
      status: 'all',
      mineOnly: false,
      staff: 'huong',
      pageSize: 25,
    });

    const mineOnly = saveKpiAdjustmentFilterState(
      'thanh.pham',
      {
        mineOnly: true,
        staff: 'ngoc',
      },
      {
        allowStaffFilter: true,
        staffKeyAvailable: true,
      }
    );

    expect(mineOnly).toEqual({
      month: 'all',
      status: 'all',
      mineOnly: true,
      staff: 'all',
      pageSize: 25,
    });

    const layout = readLayout();
    expect(layout?.kpiAdjustments?.filters?.['thanh.pham']).toEqual(mineOnly);
  });
});
