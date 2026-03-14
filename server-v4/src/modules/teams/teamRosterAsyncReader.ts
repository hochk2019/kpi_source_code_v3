import type {
  BusinessHotPathKey,
  BusinessSnapshotReader,
  BusinessSnapshotSourceKind,
} from '../../persistence/businessSnapshotReader.js';

export interface TeamRosterAsyncReader {
  getSourceKind(): BusinessSnapshotSourceKind;
  getHotPathKeys(): readonly BusinessHotPathKey[];
  getLegacyDbFile(): string | null;
  readTeamRoster(): Promise<unknown>;
}

export function createTeamRosterAsyncReader(reader: BusinessSnapshotReader): TeamRosterAsyncReader {
  return {
    getSourceKind: () => reader.getSourceKind(),
    getHotPathKeys: () => reader.getHotPathKeys(),
    getLegacyDbFile: () => reader.getLegacyDbFile(),
    readTeamRoster: async () => reader.readTeamRoster(),
  };
}
