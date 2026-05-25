export const BACKUP_REASON_LABELS: Readonly<Record<string, string>>;
export const BACKUP_FAILURE_LABELS: Readonly<Record<string, string>>;

export function translateBackupReason(code: unknown): string;
export function translateBackupFailure(code: unknown): string;
