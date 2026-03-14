import type {
  BusinessHotPathKey,
  BusinessSnapshotSourceKind,
} from '../../persistence/businessSnapshotReader.js';
import type { HqAgenciesAsyncReader } from './hqAgenciesAsyncReader.js';

const EMPTY_HOT_PATH_KEYS: readonly BusinessHotPathKey[] = Object.freeze([]);

export class NoopHqAgenciesAsyncReader implements HqAgenciesAsyncReader {
  private readonly legacyDbFile: string | null;
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    options: {
      legacyDbFile?: string | null;
      sourceKind?: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;
    } = {},
  ) {
    this.legacyDbFile = options.legacyDbFile ?? null;
    this.sourceKind = options.sourceKind ?? 'relational-store';
  }

  getSourceKind() {
    return this.sourceKind;
  }

  getHotPathKeys() {
    return EMPTY_HOT_PATH_KEYS;
  }

  getLegacyDbFile(): string | null {
    return this.legacyDbFile;
  }

  async readBindings(): Promise<unknown[]> {
    return [];
  }

  async readHistoryEntries(): Promise<unknown[]> {
    return [];
  }
}
