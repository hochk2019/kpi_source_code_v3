import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from '@/lib/i18n.js';
import { fetchWithAuth } from '@/auth/localAuth.js';
import { API_V4_ROUTES } from '@/lib/apiRoutes.js';
import { getAuditLogs, clearAuditLogs } from "@/lib/store.js";
import type { AuthAccountView } from '@/types';
import type { AuditLogEntry, BackupFile, BackupSummary } from "./types";

export function useAuditLogData(currentUser: AuthAccountView | null | undefined) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => getAuditLogs(200));
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [backupNote, setBackupNote] = useState("");
  const [manualDirectory, setManualDirectory] = useState("");
  const [schedule, setSchedule] = useState<Record<string, unknown> | null>(null);
  const [scheduleError, setScheduleError] = useState("");

  const canManageBackups = useMemo(
    () => currentUser?.role === "admin" && currentUser?.permissions?.accountManage,
    [currentUser]
  );

  const refreshLogs = useCallback(() => {
    setLogs(getAuditLogs(200));
  }, []);

  const loadSummary = useCallback(async () => {
    if (typeof fetch !== "function") {
      setSummary(null);
      setSummaryError(t('backup.browserNotSupported'));
      return;
    }
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const res = await fetchWithAuth(API_V4_ROUTES.backups.summary, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || t('backup.summaryLoadFailed'));
      }
      const data = await res.json();
      setSummary(data ?? null);
    } catch (e) {
      setSummary(null);
      setSummaryError((e as Error).message || t('backup.summaryLoadFailed'));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchBackupFiles = useCallback(async () => {
    if (!canManageBackups || typeof fetch !== "function") {
      return;
    }
    try {
      const res = await fetchWithAuth(API_V4_ROUTES.backups.files, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || t('backup.listLoadFailed'));
      }
      const data = await res.json();
      setBackupFiles(Array.isArray(data?.files) ? data.files : []);
    } catch (_e) {
      setBackupFiles([]);
    }
  }, [canManageBackups]);

  const refresh = useCallback(() => {
    refreshLogs();
    void loadSummary();
    void fetchBackupFiles();
  }, [refreshLogs, loadSummary, fetchBackupFiles]);

  const clearLogs = useCallback(() => {
    clearAuditLogs();
    refreshLogs();
  }, [refreshLogs]);

  const filteredLogs = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    const typeValue = (typeFilter || "all").toLowerCase();
    const fromMs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : Number.NaN;
    const toMs = toDate ? Date.parse(`${toDate}T23:59:59`) : Number.NaN;

    return logs.filter((entry) => {
      if (!entry) return false;
      const text = `${entry.actor ?? ""} ${entry.action ?? ""} ${entry.detail ?? ""}`.toLowerCase();
      const matchesKeyword = !keyword || text.includes(keyword);
      const entryTs = entry.ts ? Date.parse(entry.ts) : Number.NaN;
      const matchesFrom = Number.isNaN(fromMs) || Number.isNaN(entryTs) || entryTs >= fromMs;
      const matchesTo = Number.isNaN(toMs) || Number.isNaN(entryTs) || entryTs <= toMs;
      const category = (entry.category ?? inferCategoryFromAction(entry.action)).toLowerCase();
      const matchesType = typeValue === "all" || category === typeValue;
      return matchesKeyword && matchesFrom && matchesTo && matchesType;
    });
  }, [logs, filter, typeFilter, fromDate, toDate]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const entry of logs) {
      if (!entry) continue;
      const cat = entry.category ?? inferCategoryFromAction(entry.action);
      if (cat) set.add(cat);
    }
    return ["all", ...Array.from(set).sort()];
  }, [logs]);

  const handleResetFilters = useCallback(() => {
    setFilter("");
    setTypeFilter("all");
    setFromDate("");
    setToDate("");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    logs,
    filteredLogs,
    filter,
    setFilter,
    typeFilter,
    setTypeFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    summary,
    summaryError,
    summaryLoading,
    backupFiles,
    backupNote,
    setBackupNote,
    manualDirectory,
    setManualDirectory,
    schedule,
    setSchedule,
    scheduleError,
    setScheduleError,
    canManageBackups,
    availableCategories,
    refresh,
    refreshLogs,
    loadSummary,
    fetchBackupFiles,
    clearLogs,
    handleResetFilters,
  };
}

function inferCategoryFromAction(action: unknown): string {
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
