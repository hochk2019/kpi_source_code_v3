import type { HqAgenciesStore } from './hqAgenciesStore.js';

const STORE_NOT_CONFIGURED_ERROR = 'HQ agencies write store is not configured.';

export function createNoopHqAgenciesStore(): HqAgenciesStore {
  return {
    async upsertBinding() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async deleteBinding() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
  };
}
