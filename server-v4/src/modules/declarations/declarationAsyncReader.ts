import type { BusinessSnapshotReader } from '../../persistence/businessSnapshotReader.js';

export interface DeclarationAsyncReader {
  getSourceKind(): ReturnType<BusinessSnapshotReader['getSourceKind']>;
  getHotPathKeys(): ReturnType<BusinessSnapshotReader['getHotPathKeys']>;
  getLegacyDbFile(): string | null;
  readDeclarationRows(): Promise<unknown[]>;
  readDeclarationRowsByKeys?(keys: string[]): Promise<unknown[]>;
}

export function createDeclarationAsyncReader(reader: BusinessSnapshotReader): DeclarationAsyncReader {
  return {
    getSourceKind: () => reader.getSourceKind(),
    getHotPathKeys: () => reader.getHotPathKeys(),
    getLegacyDbFile: () => reader.getLegacyDbFile(),
    readDeclarationRows: async () => reader.readDeclarationRows(),
  };
}
