import type { BusinessSnapshotReader, BusinessSnapshotSourceKind } from './businessSnapshotReader.js';

const EMPTY_OBJECT = Object.freeze({});
const EMPTY_LIST: unknown[] = [];

export class NoopBusinessSnapshotReader implements BusinessSnapshotReader {
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    options: {
      sourceKind?: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;
    } = {},
  ) {
    this.sourceKind = options.sourceKind ?? 'relational-store';
  }

  getSourceKind() {
    return this.sourceKind;
  }

  getHotPathKeys() {
    return [];
  }

  getLegacyDbFile(): null {
    return null;
  }

  readDeclarationRows(): unknown[] {
    return EMPTY_LIST;
  }

  readMstAssignmentRows(): unknown[] {
    return EMPTY_LIST;
  }

  readTeamRoster(): unknown {
    return EMPTY_OBJECT;
  }

  readRuleCollection(): unknown {
    return EMPTY_OBJECT;
  }

  readAdjustmentRows(): unknown[] {
    return EMPTY_LIST;
  }

  readReportSchedules(): unknown[] {
    return EMPTY_LIST;
  }

  readMonthlyAggregateSnapshot(): unknown {
    return null;
  }

  readDefaultMonthlyAggregateSnapshot(): unknown {
    return null;
  }
}
