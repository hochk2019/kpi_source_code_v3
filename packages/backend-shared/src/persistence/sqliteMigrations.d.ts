export const SQLITE_MIGRATION_TABLE: string;

export function ensureSqliteKvStore(database: unknown): void;
export function ensureSqliteAuthTables(database: unknown): void;
export function ensureSqliteExportAuditTables(database: unknown): void;
export function ensureSqliteReportingProjectionTables(database: unknown): void;
export function ensureSqliteBusinessSnapshotTables(database: unknown): void;
export function ensureSqliteTeamRosterTables(database: unknown): void;

export function readAppliedSqliteMigrations(database: unknown): { id: string; applied_at: string }[];
