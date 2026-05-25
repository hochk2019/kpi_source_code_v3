import type { KpiRulesStore } from './kpiRulesStore.js';
import { cloneKpiRuleCollection } from './kpiRulesStore.js';

const STORE_NOT_CONFIGURED_ERROR = 'KPI rules write store is not configured.';

export function createNoopKpiRulesStore(): KpiRulesStore {
  return {
    async writeRuleCollection(collection) {
      if (!collection?.sets?.length) {
        throw new Error(STORE_NOT_CONFIGURED_ERROR);
      }

      return cloneKpiRuleCollection(collection);
    },
  };
}
