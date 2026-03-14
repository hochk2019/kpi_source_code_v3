import type { DeclarationsStore } from './declarationsStore.js';

const STORE_NOT_CONFIGURED_ERROR = 'Declarations write store is not configured.';

export function createNoopDeclarationsStore(): DeclarationsStore {
  return {
    async patchDeclaration() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async listDeclarationEvents() {
      return [];
    },
  };
}
