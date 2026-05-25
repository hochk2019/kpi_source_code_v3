import { makeRowKey } from "./rowIdentity.js";

const METADATA_FIELDS = new Set([
  "person_import",
  "person_export",
  "effective_from",
  "effective_to",
]);

function toTimestampValue(value) {
  const parsed = new Date(value || "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildAssignmentMetadataIndex(historyEntries = []) {
  const index = new Map();

  for (const entry of Array.isArray(historyEntries) ? historyEntries : []) {
    if (!entry?.rowKey || !METADATA_FIELDS.has(entry.field)) {
      continue;
    }

    const nextTimestampValue = toTimestampValue(entry.timestamp);
    const current = index.get(entry.rowKey);
    const currentTimestampValue = toTimestampValue(current?.timestamp);

    if (current && currentTimestampValue > nextTimestampValue) {
      continue;
    }

    index.set(entry.rowKey, {
      actor: String(entry.actor || "").trim(),
      timestamp: String(entry.timestamp || "").trim(),
      field: entry.field,
      type: String(entry.type || "").trim(),
    });
  }

  return index;
}

export function buildMSTAssignmentExportRows({
  rows = [],
  computeStatusDisplay,
  historyEntries = [],
}) {
  const metadataIndex = buildAssignmentMetadataIndex(historyEntries);

  return (Array.isArray(rows) ? rows : []).map((item, index) => {
    const metadata = metadataIndex.get(makeRowKey(item));

    return {
      STT: index + 1,
      MST: item?.mst || "",
      "Công ty": item?.company || "",
      "Người phụ trách Nhập": item?.person_import || "",
      "Người phụ trách Xuất": item?.person_export || "",
      "Tổ đội": item?.team || "",
      "Áp dụng từ ngày": item?.effective_from || "",
      "Đến hết ngày": item?.effective_to || "",
      "Trạng thái": computeStatusDisplay?.(item) || item?.status || "",
      "Người gán gần nhất": metadata?.actor || "",
      "Cập nhật gần nhất": metadata?.timestamp || "",
    };
  });
}
