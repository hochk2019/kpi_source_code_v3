import type { AuthAccountView } from '@/types';

export interface AuditLogEntry {
  ts?: string;
  actor?: string;
  action?: string;
  category?: string;
  detail?: string;
  note?: string | null;
  result?: string;
  meta?: Record<string, unknown> | null;
}

export interface BackupFile {
  filename: string;
  modifiedAt?: string;
}

export interface BackupSchedule {
  cron?: string;
  cronDescription?: string;
  active?: boolean;
  nextRun?: string;
  nextRunHuman?: string;
  retentionCopies?: number | null;
  directory?: string;
  directoryRaw?: string;
  reasons?: string[];
  refreshedAt?: string;
}

export interface BackupSummary {
  schedule?: BackupSchedule;
  lastSuccess?: { ts?: string; actor?: string; meta?: Record<string, unknown> };
  lastFailure?: { ts?: string; actor?: string; meta?: Record<string, unknown> };
}

export interface AuditLogProps {
  currentUser?: AuthAccountView | null;
}

export function formatTime(value: unknown): string {
  if (!value) return "";
  try {
    return new Date(value as string).toLocaleString("vi-VN", {
      hour12: false,
    });
  } catch {
    return String(value);
  }
}

export function formatBytes(bytes: unknown): string {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const display = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${display} ${units[unitIndex]}`;
}

export function inferCategoryFromAction(action: unknown): string {
  if (typeof action !== "string" || !action) {
    return "khac";
  }
  const normalized = action.trim();
  const index = normalized.indexOf(".");
  if (index <= 0) {
    return normalized || "khac";
  }
  return normalized.slice(0, index);
}

export function normalizeNote(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
