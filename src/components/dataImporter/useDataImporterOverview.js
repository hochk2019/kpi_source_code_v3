import { useMemo } from "react";

function formatLocaleDateTime(value, fallbackLabel) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return fallbackLabel;
  }
  return parsedDate.toLocaleString("vi-VN");
}

export default function useDataImporterOverview({
  rawRows,
  mode,
  showDeletedRows,
  alertSummary,
  alertEntries,
  syncConfig,
  formatDateRangeLabel,
  formatDisplayDate,
}) {
  const summaryStats = useMemo(() => {
    const rows = Array.isArray(rawRows) ? rawRows : [];

    if (rows.length === 0 || mode !== "saved") {
      return { total: rows.length, missingStaff: 0, missingTeam: 0, reviewed: 0 };
    }

    let totalCount = 0;
    let missingStaff = 0;
    let missingTeam = 0;
    let reviewed = 0;

    for (const row of rows) {
      if (!row) continue;
      if (!showDeletedRows && row.deleted_at) continue;

      totalCount += 1;

      const hasStaff = !!(row.nhan_vien && row.nhan_vien.toString().trim());
      const hasTeam = !!(row.team && row.team.toString().trim());

      if (!hasStaff) missingStaff += 1;
      if (!hasTeam) missingTeam += 1;
      if (row.reviewed) reviewed += 1;
    }

    return { total: totalCount, missingStaff, missingTeam, reviewed };
  }, [mode, rawRows, showDeletedRows]);

  const outstandingAlerts = useMemo(
    () => (Array.isArray(alertEntries) ? alertEntries : []).filter((entry) => !entry?.resolved).slice(0, 5),
    [alertEntries],
  );

  const outstandingCount = alertSummary?.outstanding || 0;

  const summaryCards = useMemo(
    () => [
      { label: "Tổng tờ khai (đang xem)", value: summaryStats.total },
      { label: "Chưa gán nhân viên", value: summaryStats.missingStaff },
      { label: "Chưa gán tổ đội", value: summaryStats.missingTeam },
      { label: "Đã rà soát", value: summaryStats.reviewed },
      { label: "Cảnh báo chờ xử lý", value: outstandingCount },
    ],
    [outstandingCount, summaryStats],
  );

  const lastAlertEvaluated = useMemo(() => {
    if (!alertSummary?.lastEvaluatedAt) return "Chưa tính";
    return formatLocaleDateTime(alertSummary.lastEvaluatedAt, alertSummary.lastEvaluatedAt);
  }, [alertSummary?.lastEvaluatedAt]);

  const syncLastRunLabel = useMemo(() => {
    if (!syncConfig?.lastRun) return "Chưa chạy";
    return formatLocaleDateTime(syncConfig.lastRun, syncConfig.lastRun);
  }, [syncConfig?.lastRun]);

  const lastSyncSummary = syncConfig?.lastSummary || null;

  const lastSyncRangeLabel = useMemo(
    () => formatDateRangeLabel(lastSyncSummary?.range ?? null),
    [formatDateRangeLabel, lastSyncSummary?.range],
  );

  const lastSyncRunAtLabel = useMemo(
    () => (lastSyncSummary?.runAt ? formatDisplayDate(lastSyncSummary.runAt) : ""),
    [formatDisplayDate, lastSyncSummary?.runAt],
  );

  return {
    summaryStats,
    outstandingAlerts,
    summaryCards,
    lastAlertEvaluated,
    syncLastRunLabel,
    lastSyncSummary,
    lastSyncRangeLabel,
    lastSyncRunAtLabel,
  };
}
