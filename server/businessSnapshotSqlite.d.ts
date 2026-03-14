export const BUSINESS_SNAPSHOT_STATE_TABLE: string;
export const DECLARATION_SNAPSHOT_ROW_TABLE: string;
export const MST_ASSIGNMENT_SNAPSHOT_ROW_TABLE: string;
export const ADJUSTMENT_SNAPSHOT_ROW_TABLE: string;
export const ACTIVE_BUSINESS_SNAPSHOT_KEY: string;

export const DECLARATION_SNAPSHOT_DOMAIN_KEY: string;
export const MST_ASSIGNMENT_SNAPSHOT_DOMAIN_KEY: string;
export const RULE_COLLECTION_SNAPSHOT_DOMAIN_KEY: string;
export const ADJUSTMENT_SNAPSHOT_DOMAIN_KEY: string;

type SqliteStatementLike = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
};

type SqliteDatabaseLike = {
  exec(sql: string): unknown;
  prepare(sql: string): SqliteStatementLike;
  transaction?<T extends (...args: never[]) => unknown>(fn: T): T;
};

export type SnapshotRow = Record<string, unknown>;
export type RuleCollectionSnapshot = Record<string, unknown>;

export function ensureBusinessSnapshotTables(database: SqliteDatabaseLike | null | undefined): void;

export function readDeclarationRowsSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): SnapshotRow[] | null;

export function writeDeclarationRowsSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  rows: unknown,
  options?: {
    snapshotKey?: string;
    updatedAt?: string;
  }
): void;

export function deleteDeclarationRowsSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): void;

export function readMstAssignmentRowsSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): SnapshotRow[] | null;

export function writeMstAssignmentRowsSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  rows: unknown,
  options?: {
    snapshotKey?: string;
    updatedAt?: string;
  }
): void;

export function deleteMstAssignmentRowsSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): void;

export function readRuleCollectionSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): RuleCollectionSnapshot | null;

export function writeRuleCollectionSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  collection: unknown,
  options?: {
    snapshotKey?: string;
    updatedAt?: string;
  }
): void;

export function deleteRuleCollectionSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): void;

export function readAdjustmentRowsSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): SnapshotRow[] | null;

export function writeAdjustmentRowsSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  rows: unknown,
  options?: {
    snapshotKey?: string;
    updatedAt?: string;
  }
): void;

export function deleteAdjustmentRowsSnapshot(
  database: SqliteDatabaseLike | null | undefined,
  snapshotKey?: string
): void;
