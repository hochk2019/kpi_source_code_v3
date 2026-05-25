export type BackupDomainResult = {
  ok?: boolean;
  reason?: string;
  error?: string;
  [key: string]: unknown;
};

export interface BackupDomainApi {
  buildBackupSummary(options?: { limit?: number }): unknown;
  ensureBackupDirectory(backupDir: string): Promise<void>;
  listBackupFiles(options?: { backupDir?: string; limit?: number }): Promise<unknown[]>;
  performDatabaseBackup(options?: {
    actor?: string;
    backupDir?: string;
    dbFile?: string;
    note?: string | null;
    reason?: string;
    retention?: number | null;
  }): Promise<BackupDomainResult>;
  refreshDatabaseBackupSchedule(): void;
  restoreDatabaseBackup(options?: {
    actor?: string;
    backupDir?: string;
    dbFile?: string;
    filename?: string;
    note?: string | null;
  }): Promise<BackupDomainResult>;
  rotateBackups(backupDir: string, retention: number | null): Promise<void>;
}

export function createBackupDomain(options: Record<string, unknown>): BackupDomainApi;
