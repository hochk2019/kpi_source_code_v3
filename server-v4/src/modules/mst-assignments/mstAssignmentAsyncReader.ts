import type {
  BusinessHotPathKey,
  BusinessSnapshotReader,
  BusinessSnapshotSourceKind,
} from '../../persistence/businessSnapshotReader.js';

export interface MstAssignmentAsyncReader {
  getSourceKind(): BusinessSnapshotSourceKind;
  getHotPathKeys(): readonly BusinessHotPathKey[];
  getLegacyDbFile(): string | null;
  readMstAssignmentRows(): Promise<unknown[]>;
}

export function createMstAssignmentAsyncReader(
  reader: BusinessSnapshotReader,
): MstAssignmentAsyncReader {
  return {
    getSourceKind: () => reader.getSourceKind(),
    getHotPathKeys: () => reader.getHotPathKeys(),
    getLegacyDbFile: () => reader.getLegacyDbFile(),
    readMstAssignmentRows: async () => reader.readMstAssignmentRows(),
  };
}
