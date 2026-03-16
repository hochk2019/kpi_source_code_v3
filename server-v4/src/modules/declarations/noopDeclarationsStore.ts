import type {
  CoCodeConfigDocument,
  CoDiscrepancyConfigDocument,
  CoDiscrepancyStateDocument,
} from './declarationCoMonitoring.js';
import {
  normalizeDeclarationAlertState,
  type DeclarationAlertConfigDocument,
  type DeclarationAlertStateDocument,
} from './declarationAlerts.js';
import type { EcusSyncConfigDocument } from './ecusSyncConfig.js';
import type { DeclarationsStore } from './declarationsStore.js';

const STORE_NOT_CONFIGURED_ERROR = 'Declarations write store is not configured.';

export function createNoopDeclarationsStore(): DeclarationsStore {
  return {
    async patchDeclaration() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async commitImportedDeclarations() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async listDeclarationEvents() {
      return [];
    },
    async readEcusSyncConfig() {
      return null;
    },
    async writeEcusSyncConfig(_config: EcusSyncConfigDocument) {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async readCoCodeConfig() {
      return null;
    },
    async writeCoCodeConfig(_config: CoCodeConfigDocument) {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async readCoDiscrepancyConfig() {
      return null;
    },
    async writeCoDiscrepancyConfig(_config: CoDiscrepancyConfigDocument) {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async readCoDiscrepancyState() {
      return null;
    },
    async writeCoDiscrepancyState(_state: CoDiscrepancyStateDocument) {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async readDeclarationAlertConfig() {
      return null;
    },
    async writeDeclarationAlertConfig(_config: DeclarationAlertConfigDocument) {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async readDeclarationAlertState() {
      return null;
    },
    async writeDeclarationAlertState(state: DeclarationAlertStateDocument) {
      return normalizeDeclarationAlertState(state);
    },
    async markDeclarationsReviewed() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
    async unmarkDeclarationsReviewed() {
      throw new Error(STORE_NOT_CONFIGURED_ERROR);
    },
  };
}
