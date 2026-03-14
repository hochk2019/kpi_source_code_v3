import type {
  BusinessHotPathKey,
  BusinessSnapshotSourceKind,
} from '../../persistence/businessSnapshotReader.js';

export interface HqAgenciesAsyncReader {
  getSourceKind(): BusinessSnapshotSourceKind;
  getHotPathKeys(): readonly BusinessHotPathKey[];
  getLegacyDbFile(): string | null;
  readBindings(): Promise<unknown[]>;
  readHistoryEntries(): Promise<unknown[]>;
}
