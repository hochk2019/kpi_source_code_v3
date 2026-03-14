import type { TeamsStore } from './teamsStore.js';

const STORE_NOT_CONFIGURED_ERROR = 'Teams write store is not configured.';

export function createNoopTeamsStore(): TeamsStore {
  return {
    async writeRoster() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
  };
}
