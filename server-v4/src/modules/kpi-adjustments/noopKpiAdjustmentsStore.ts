import {
  cloneAdjustmentSettings,
  createDefaultAdjustmentSettings,
  type KpiAdjustmentsStore,
} from './kpiAdjustmentsStore.js';

const STORE_NOT_CONFIGURED_ERROR = 'KPI adjustments write store is not configured.';

export function createNoopKpiAdjustmentsStore(): KpiAdjustmentsStore {
  return {
    async readAdjustmentById() {
      return null;
    },
    async createAdjustment() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async updateAdjustment() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async readSettings() {
      return cloneAdjustmentSettings(createDefaultAdjustmentSettings());
    },
    async writeSettings(settings) {
      return cloneAdjustmentSettings(settings);
    },
  };
}
