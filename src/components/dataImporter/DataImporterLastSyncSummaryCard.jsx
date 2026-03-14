import React from "react";

export default function DataImporterLastSyncSummaryCard({
  visible = false,
  rangeLabel = "",
  runAtLabel = "",
  fetched = 0,
  inserted = 0,
  updated = 0,
  skipped = 0,
  total = 0,
}) {
  if (!visible) {
    return null;
  }

  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
      <div className="font-medium text-emerald-800">Ket qua dong bo gan nhat</div>
      <div className="mt-1 flex flex-wrap gap-3">
        {rangeLabel ? <span>Khoang: {rangeLabel}</span> : null}
        {runAtLabel ? <span>Run: {runAtLabel}</span> : null}
        <span>Thu thap: {fetched.toLocaleString("vi-VN")}</span>
        <span>Them moi: {inserted.toLocaleString("vi-VN")}</span>
        <span>Cap nhat: {updated.toLocaleString("vi-VN")}</span>
        <span>Bo qua: {skipped.toLocaleString("vi-VN")}</span>
        <span>Tong: {total.toLocaleString("vi-VN")}</span>
      </div>
    </div>
  );
}
