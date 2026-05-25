import type { BusinessSnapshotReader } from '../../persistence/businessSnapshotReader.js';

export interface KpiRulesAsyncReader {
  getSourceKind(): ReturnType<BusinessSnapshotReader['getSourceKind']>;
  getHotPathKeys(): ReturnType<BusinessSnapshotReader['getHotPathKeys']>;
  getLegacyDbFile(): string | null;
  readRuleCollection(): Promise<unknown>;
}

export function createKpiRulesAsyncReader(reader: BusinessSnapshotReader): KpiRulesAsyncReader {
  return {
    getSourceKind: () => reader.getSourceKind(),
    getHotPathKeys: () => reader.getHotPathKeys(),
    getLegacyDbFile: () => reader.getLegacyDbFile(),
    readRuleCollection: async () => reader.readRuleCollection(),
  };
}
