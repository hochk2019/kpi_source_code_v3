import { normalizeDeclarationNumber, normalizeStr } from "@/lib/storeCoreHelpers.js";

const TIMESTAMP_FIELD_LABELS = Object.freeze({
  updatedAt: "Cập nhật gần nhất",
  updated_at: "Cập nhật gần nhất",
  reviewed_at: "Rà soát",
  syncedAt: "Đồng bộ ECUS",
  synced_at: "Đồng bộ ECUS",
  importedAt: "Import Excel",
  imported_at: "Import Excel",
  createdAt: "Khởi tạo",
  created_at: "Khởi tạo",
  date: "Ngày tờ khai",
});

const TIMESTAMP_FIELD_ORDER = Object.freeze([
  "updatedAt",
  "updated_at",
  "reviewed_at",
  "syncedAt",
  "synced_at",
  "importedAt",
  "imported_at",
  "createdAt",
  "created_at",
  "date",
]);

export function extractRowTimestampDetail(row) {
  if (!row || typeof row !== "object") {
    return { timestamp: 0, field: null, label: "Không xác định", display: "Không xác định", iso: null };
  }
  let bestTs = 0;
  let bestField = null;
  for (const field of TIMESTAMP_FIELD_ORDER) {
    const value = row[field];
    if (!value) continue;
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) continue;
    if (ts > bestTs) {
      bestTs = ts;
      bestField = field;
    }
  }
  if (!bestTs) {
    return { timestamp: 0, field: bestField, label: "Không xác định", display: "Không xác định", iso: null };
  }
  const formatter = new Intl.DateTimeFormat("vi-VN", { hour12: false });
  return {
    timestamp: bestTs,
    field: bestField,
    label: TIMESTAMP_FIELD_LABELS[bestField] || "Thời gian cập nhật",
    display: formatter.format(new Date(bestTs)),
    iso: new Date(bestTs).toISOString(),
  };
}

export function computeDuplicateWeight(row) {
  if (!row || typeof row !== "object") {
    return { score: 0, timestamp: 0, timestampDetail: extractRowTimestampDetail(row) };
  }
  let score = 0;
  if (row.reviewed) score += 5;
  if (row.nhan_vien) score += 2;
  if (row.team) score += 2;
  if (row.agency || row.dai_ly) score += 1;
  if (Array.isArray(row.licenseCodes) && row.licenseCodes.length) score += 1;
  const manual = Number(row.licenseManualCount);
  if (Number.isFinite(manual) && manual >= 0) score += 3;
  const licenseCount = Number(row.licenses ?? row.so_luong_gp);
  if (Number.isFinite(licenseCount) && licenseCount > 0) score += 1;
  const timestampDetail = extractRowTimestampDetail(row);
  return { score, timestamp: timestampDetail.timestamp, timestampDetail };
}

export function compareDuplicateCandidates(a, b) {
  const weightA = computeDuplicateWeight(a);
  const weightB = computeDuplicateWeight(b);
  if (weightA.timestamp !== weightB.timestamp) {
    return weightB.timestamp - weightA.timestamp;
  }
  if (weightA.score !== weightB.score) {
    return weightB.score - weightA.score;
  }
  const kpiA = Number(a?.kpi);
  const kpiB = Number(b?.kpi);
  if (Number.isFinite(kpiA) && Number.isFinite(kpiB) && kpiA !== kpiB) {
    return kpiB - kpiA;
  }
  return 0;
}

export function applyMergeField(target, source, field) {
  if (!target || typeof target !== "object" || !source || typeof source !== "object") {
    return target;
  }
  switch (field) {
    case "nhan_vien": {
      target.nhan_vien = source.nhan_vien || "";
      return target;
    }
    case "team": {
      target.team = source.team || "";
      return target;
    }
    case "agency": {
      target.agency = source.agency || "";
      return target;
    }
    case "dai_ly": {
      target.dai_ly = source.dai_ly || "";
      return target;
    }
    case "kpi": {
      const parsed = Number(source.kpi);
      if (Number.isFinite(parsed)) {
        target.kpi = parsed;
      }
      return target;
    }
    case "licenses":
    case "so_luong_gp": {
      const parsed = Number(source.licenses ?? source.so_luong_gp);
      if (Number.isFinite(parsed)) {
        target.licenses = parsed;
        target.so_luong_gp = parsed;
      }
      return target;
    }
    case "licenseManualCount": {
      const parsed = Number(source.licenseManualCount);
      if (Number.isFinite(parsed)) {
        target.licenseManualCount = Math.max(0, Math.round(parsed));
      } else {
        delete target.licenseManualCount;
      }
      return target;
    }
    case "reviewed": {
      if (source.reviewed) {
        target.reviewed = true;
        if (source.reviewed_at) target.reviewed_at = source.reviewed_at;
        if (source.reviewed_by) target.reviewed_by = source.reviewed_by;
      } else {
        delete target.reviewed;
        delete target.reviewed_at;
        delete target.reviewed_by;
      }
      return target;
    }
    default: {
      if (Object.prototype.hasOwnProperty.call(source, field)) {
        target[field] = source[field];
      }
      return target;
    }
  }
}

export function clearDuplicateReviewFlags(target) {
  if (!target || typeof target !== "object") return target;
  delete target.duplicate_review_pending;
  delete target.duplicate_review_note;
  delete target.duplicate_review_actor;
  delete target.duplicate_review_updated_at;
  return target;
}

export function extractDuplicatePrefix(row) {
  return normalizeDeclarationNumber(row?.so_tk_full ?? row?.so_tk ?? "", 11);
}

export function inferRowSource(row) {
  if (!row || typeof row !== "object") {
    return { label: "Không xác định", code: "unknown" };
  }
  const direct = [row.origin, row.source, row.sourceLabel, row.dataSource, row.data_source, row.originSource]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find((value) => value.length > 0);
  if (direct) {
    return { label: direct, code: normalizeStr(direct) };
  }
  if (row.syncedAt || row.synced_at || row.ecusId || row.ecus_reference) {
    return { label: "Đồng bộ ECUS", code: "ecus" };
  }
  if (row.importedAt || row.imported_at || row.importBatchId || row.import_batch_id) {
    return { label: "Import Excel", code: "import" };
  }
  if (row.createdAt || row.created_at) {
    return { label: "Nhập thủ công", code: "manual" };
  }
  return { label: "Không xác định", code: "unknown" };
}

export function describeRowStatus(row) {
  if (row?.duplicate_review_pending) {
    return "Cần xem lại trùng";
  }
  const hasStaff = !!(row?.nhan_vien && row.nhan_vien.toString().trim());
  const hasTeam = !!(row?.team && row.team.toString().trim());
  if (row?.reviewed) {
    return "Đã rà soát";
  }
  if (!hasStaff || !hasTeam) {
    const missing = [];
    if (!hasStaff) missing.push("nhân viên");
    if (!hasTeam) missing.push("tổ đội");
    return `Thiếu ${missing.join(" & ")}`;
  }
  return "Đủ thông tin";
}

export function formatHistoryTimestamp(timestamp) {
  if (!timestamp) {
    return "Không xác định";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: undefined,
    hour12: false,
  });
}

export function formatDeclarationLabel(entry) {
  if (!entry || typeof entry !== "object") return "";
  const number = entry.so_tk_full ? String(entry.so_tk_full) : entry.so_tk ? String(entry.so_tk) : "";
  const branch = entry.nhanh || entry.branch || "";
  return branch ? `${number} (${branch})` : number;
}

export function formatDuplicateGroupLabel(entry) {
  if (!entry || typeof entry !== "object") {
    return "Nhóm trùng";
  }
  const prefix = extractDuplicatePrefix(entry) || String(entry?.so_tk || "").slice(0, 11) || "Nhóm trùng";
  const branch = entry.nhanh || entry.branch || "";
  return branch ? `${prefix} - ${branch}` : prefix;
}
