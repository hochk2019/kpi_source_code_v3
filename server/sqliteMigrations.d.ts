import type Database from 'better-sqlite3';

export const SQLITE_MIGRATION_TABLE: 'schema_migrations';

export function ensureSqliteKvStore(database: Database): void;
export function ensureSqliteAuthTables(database: Database): void;
export function ensureSqliteExportAuditTables(database: Database): void;
export function ensureSqliteReportingProjectionTables(database: Database): void;
export function ensureSqliteBusinessSnapshotTables(database: Database): void;
export function ensureSqliteTeamRosterTables(database: Database): void;
export function readAppliedSqliteMigrations(database: Database): string[];
