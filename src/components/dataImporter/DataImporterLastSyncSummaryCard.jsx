import React, { useMemo } from "react";

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function isStale(runAt) {
  if (!runAt) return false;
  const timestamp = new Date(runAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp > STALE_THRESHOLD_MS;
}

function formatStaleDuration(runAt) {
  const timestamp = new Date(runAt).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const hours = Math.floor((Date.now() - timestamp) / (60 * 60 * 1000));
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  return `${days} ngày`;
}

export default function DataImporterLastSyncSummaryCard({
  visible = false,
  rangeLabel = "",
  runAtLabel = "",
  runAt = "",
  fetched = 0,
  inserted = 0,
  updated = 0,
  skipped = 0,
  total = 0,
}) {
  const stale = useMemo(() => isStale(runAt), [runAt]);
  const staleDuration = useMemo(() => formatStaleDuration(runAt), [runAt]);

  if (!visible) {
    return null;
  }

  const borderColor = stale ? "border-amber-300" : "border-emerald-200";
  const bgColor = stale ? "bg-amber-50" : "bg-emerald-50";
  const textColor = stale ? "text-amber-700" : "text-emerald-700";
  const headingColor = stale ? "text-amber-800" : "text-emerald-800";

  return (
    <div className={`rounded border p-2 text-xs ${borderColor} ${bgColor} ${textColor}`}>
      <div className={`font-medium ${headingColor}`}>
        {stale ? "Cảnh báo: dữ liệu đồng bộ đã cũ" : "Kết quả đồng bộ gần nhất"}
      </div>
      {stale && (
        <div className="mt-1 text-amber-600">
          Dữ liệu được đồng bộ cách đây {staleDuration}. Hãy đồng bộ lại để đảm bảo dữ liệu mới nhất.
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-3">
        {rangeLabel ? <span>Khoảng: {rangeLabel}</span> : null}
        {runAtLabel ? <span>Run: {runAtLabel}</span> : null}
        <span>Thu thập: {fetched.toLocaleString("vi-VN")}</span>
        <span>Thêm mới: {inserted.toLocaleString("vi-VN")}</span>
        <span>Cập nhật: {updated.toLocaleString("vi-VN")}</span>
        <span>Bỏ qua: {skipped.toLocaleString("vi-VN")}</span>
        <span>Tổng: {total.toLocaleString("vi-VN")}</span>
      </div>
    </div>
  );
}
