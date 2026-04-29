// Domain barrel: KPI Adjustments Store
// Re-exports KPI adjustment operations

export {
  // Keys & Config
  KPI_ADJUSTMENTS_KEY,
  KPI_ADJUSTMENT_SETTINGS_KEY,
  KPI_ADJUSTMENT_STATUS_SET,
  KPI_ADJUSTMENT_CATEGORY_CONFIG,
} from '../storeRuntime.js';

export {
  // Store factory
  createKpiAdjustmentStore,
  // Helpers
  roundAdjustmentPoint,
} from '../storeRuntime.js';

// Re-export from kpiAdjustments module
export {
  getKpiAdjustments,
  saveKpiAdjustment,
  updateKpiAdjustmentStatus,
  removeKpiAdjustment,
  getKpiAdjustmentSettings,
  saveKpiAdjustmentSettings,
} from '../kpiAdjustments.js';
