export function buildDeletedEntries({
  softDeletedRows = [],
  hardDeletedRows = [],
  keyOfRow,
  formatDateTime,
  formatDisplayDate,
}) {
  const entries = [];

  const pushEntry = (row, type, fallbackIndex) => {
    if (!row || typeof row !== "object") {
      return;
    }

    const deletedRaw =
      row.deleted_at ||
      row.deletedAt ||
      row.deleted_at_tm ||
      row.deletedAtTm ||
      row.deletedTimestamp;

    let deletedTimestamp = Number.NaN;
    let deletedAtLabel = "";

    if (deletedRaw) {
      try {
        const date = new Date(deletedRaw);
        if (!Number.isNaN(date.getTime())) {
          deletedTimestamp = date.getTime();
          deletedAtLabel =
            formatDateTime(date, { withSeconds: true }) ||
            date.toLocaleString("vi-VN");
        } else {
          deletedAtLabel = `${deletedRaw}`;
        }
      } catch {
        deletedAtLabel = `${deletedRaw}`;
      }
    }

    const declarationNumber =
      row.so_tk_full ||
      row.so_tk ||
      row.number ||
      row.declaration_number ||
      row.declarationNumber ||
      "";
    const branch = row.nhanh || row.branch || "";
    const mst = row.mst || row.ma_so_thue || row.tax_code || "";
    const company =
      row.cong_ty ||
      row.company ||
      row.ten_cong_ty ||
      row.doanh_nghiep ||
      row.enterprise ||
      "";
    const rawDate = row.date || row.raw_date || "";
    const deletedByRaw =
      row.deleted_by || row.deletedBy || row.actor || row.deleted_user || "";
    const deletedByLabel = deletedByRaw ? deletedByRaw : "Không rõ";
    const fallbackKey =
      type === "soft"
        ? keyOfRow(row)
        : row.key || row.id || declarationNumber || fallbackIndex;

    entries.push({
      key: `${type}:${fallbackKey}`,
      type,
      typeLabel: type === "soft" ? "Đã xóa tạm thời" : "Đã xóa vĩnh viễn",
      tone: type === "soft" ? "warning" : "danger",
      soTk: declarationNumber,
      branch,
      mst,
      company,
      dateLabel: formatDisplayDate(rawDate),
      deletedAtLabel,
      deletedByLabel,
      deletedTimestamp,
    });
  };

  softDeletedRows.forEach((row, index) => {
    pushEntry(row, "soft", index);
  });
  hardDeletedRows.forEach((row, index) => {
    pushEntry(row, "hard", index);
  });

  return entries.sort((a, b) => {
    const tsA = Number.isFinite(a.deletedTimestamp) ? a.deletedTimestamp : 0;
    const tsB = Number.isFinite(b.deletedTimestamp) ? b.deletedTimestamp : 0;
    if (tsA === tsB) {
      return (a.key || "").localeCompare(b.key || "");
    }
    return tsB - tsA;
  });
}

export function buildDeletedRangeLabel(
  searchRange,
  { formatDateRangeLabel },
) {
  const label = formatDateRangeLabel({
    from: searchRange?.from || "",
    to: searchRange?.to || "",
  });
  return label || "Không giới hạn";
}
