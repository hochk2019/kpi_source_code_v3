export const BUSINESS_SNAPSHOT_STATE_TABLE: string;
export const DECLARATION_SNAPSHOT_ROW_TABLE: string;
export const MST_ASSIGNMENT_SNAPSHOT_ROW_TABLE: string;
export const ADJUSTMENT_SNAPSHOT_ROW_TABLE: string;
export const ACTIVE_BUSINESS_SNAPSHOT_KEY: string;

export const DECLARATION_SNAPSHOT_DOMAIN_KEY: string;
export const MST_ASSIGNMENT_SNAPSHOT_DOMAIN_KEY: string;
export const RULE_COLLECTION_SNAPSHOT_DOMAIN_KEY: string;
export const ADJUSTMENT_SNAPSHOT_DOMAIN_KEY: string;
export const DECLARATION_SNAPSHOT_SCHEMA_VERSION: number;

export function ensureBusinessSnapshotTables(database: unknown): void;

export function readDeclarationRowsSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown>[] | null;

export function readDeclarationRowsSnapshotState(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown> | null;

export function writeDeclarationRowsSnapshot(
  database: unknown,
  rows: readonly Record<string, unknown>[],
  options?: { snapshotKey?: string; updatedAt?: string },
): void;

export function deleteDeclarationRowsSnapshot(
  database: unknown,
  snapshotKey?: string,
): void;

export function readMstAssignmentRowsSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown>[] | null;

export function writeMstAssignmentRowsSnapshot(
  database: unknown,
  rows: readonly Record<string, unknown>[],
  options?: { snapshotKey?: string; updatedAt?: string },
): void;

export function deleteMstAssignmentRowsSnapshot(
  database: unknown,
  snapshotKey?: string,
): void;

export function readRuleCollectionSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown> | null;

export function writeRuleCollectionSnapshot(
  database: unknown,
  collection: Record<string, unknown>,
  options?: { snapshotKey?: string; updatedAt?: string },
): void;

export function deleteRuleCollectionSnapshot(
  database: unknown,
  snapshotKey?: string,
): void;

export function readAdjustmentRowsSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown>[] | null;

export function writeAdjustmentRowsSnapshot(
  database: unknown,
  rows: readonly Record<string, unknown>[],
  options?: { snapshotKey?: string; updatedAt?: string },
): void;

export function deleteAdjustmentRowsSnapshot(
  database: unknown,
  snapshotKey?: string,
): void;
