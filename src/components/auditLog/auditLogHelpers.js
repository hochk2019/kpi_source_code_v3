// auditLogHelpers.js
// Utility functions for AuditLog component

import {
  BACKUP_REASON_LABELS,
  translateBackupFailure,
} from '../../../packages/domain/src/backupMessages.js';

export function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("vi-VN", {
      hour12: false,
    });
  } catch {
    return value;
  }
}

export function formatBytes(bytes) {
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

export function inferCategoryFromAction(action) {
  if (typeof action !== "string" || !action) {
    return "khac";
  }
  const lower = action.toLowerCase();
  if (lower.includes("login") || lower.includes("logout")) {
    return "auth";
  }
  if (lower.includes("backup") || lower.includes("restore")) {
    return "backup";
  }
  if (lower.includes("rule") || lower.includes("kpi")) {
    return "kpi";
  }
  if (lower.includes("import") || lower.includes("sync")) {
    return "import";
  }
  if (lower.includes("mst") || lower.includes("assign")) {
    return "mst";
  }
  if (lower.includes("user") || lower.includes("account")) {
    return "account";
  }
  return "khac";
}

export function normalizeNote(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value).trim();
  return str.length > 200 ? `${str.slice(0, 200)}...` : str;
}

export const CONTROL_CLASS =
  "w-full rounded-xl border border-slate-200/60 bg-white/40 px-3 py-2 text-sm text-slate-800 shadow-sm placeholder-slate-400 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800 transition-all";

export const CONTROL_CLASS_COMPACT =
  "w-full rounded-xl border border-slate-200/60 bg-white/40 px-2 py-1.5 text-sm text-slate-800 shadow-sm placeholder-slate-400 focus:border-primary/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-200 dark:focus:bg-slate-800 transition-all";

export { BACKUP_REASON_LABELS, translateBackupFailure };
