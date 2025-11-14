import React from "react";

export default function SyncSection({ context }) {
  if (!context) {
    return null;
  }

  const {
    toneClassMap,
    backendMeta,
    databaseMeta,
    statusCheckedLabel,
    statusError,
    lastSyncSummaryCard,
  } = context;

  const backendTone = toneClassMap[backendMeta?.tone] || toneClassMap.muted;
  const databaseTone = toneClassMap[databaseMeta?.tone] || toneClassMap.muted;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
        <span className={`rounded px-2 py-1 ${backendTone}`}>
          Backend: {backendMeta?.label || "Chưa kiểm tra"}
        </span>
        <span className={`rounded px-2 py-1 ${databaseTone}`}>
          SQL Server: {databaseMeta?.label || "Chưa kiểm tra"}
        </span>
      </div>
      <div className="text-xs text-gray-500">Lần kiểm tra: {statusCheckedLabel}</div>
      {(backendMeta?.detail || databaseMeta?.detail) ? (
        <div className="text-xs text-gray-500">
          {[backendMeta?.detail, databaseMeta?.detail].filter(Boolean).join(" • ")}
        </div>
      ) : null}
      {statusError ? <div className="text-xs text-red-600">{statusError}</div> : null}
      {lastSyncSummaryCard}
    </div>
  );
}
