import type { BusinessSnapshotReader } from '../../persistence/businessSnapshotReader.js';

export interface AdjustmentAsyncReader {
  getSourceKind(): ReturnType<BusinessSnapshotReader['getSourceKind']>;
  getHotPathKeys(): ReturnType<BusinessSnapshotReader['getHotPathKeys']>;
  getLegacyDbFile(): string | null;
  readAdjustmentRows(): Promise<unknown[]>;
}

export function createAdjustmentAsyncReader(reader: BusinessSnapshotReader): AdjustmentAsyncReader {
  return {
    getSourceKind: () => reader.getSourceKind(),
    getHotPathKeys: () => reader.getHotPathKeys(),
    getLegacyDbFile: () => reader.getLegacyDbFile(),
    readAdjustmentRows: async () => reader.readAdjustmentRows(),
  };
}
