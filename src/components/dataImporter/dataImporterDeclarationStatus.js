import { normalizeStr } from "@/lib/store.js";

const DECLARATION_STATUS_META = Object.freeze({
  NEW: { key: "new", label: "Mới import", tone: "info" },
  PENDING_ASSIGNMENT: { key: "pending-assignment", label: "Chờ gán", tone: "warning" },
  REVIEWED: { key: "reviewed", label: "Đã rà soát", tone: "success" },
  NEEDS_REVIEW: { key: "needs-review", label: "Cần xem lại", tone: "danger" },
});

function formatDateTimeLabel(value) {
  if (!value) return "";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString("vi-VN");
  } catch (error) {
    console.warn("Không thể định dạng thời gian trạng thái tờ khai", error);
    return "";
  }
}

export function resolveDeclarationStatus(row) {
  if (!row || typeof row !== "object") {
    return { ...DECLARATION_STATUS_META.NEW };
  }

  const staffValue = (row.nhan_vien ?? row.staff ?? "").toString();
  const teamValue = (row.team ?? "").toString();
  const hasStaff = staffValue.trim().length > 0;
  const hasTeam = teamValue.trim().length > 0;

  if (row.duplicate_review_pending) {
    const note = normalizeStr(row.duplicate_review_note || "");
    const actor = normalizeStr(row.duplicate_review_actor || "");
    const timestamp = formatDateTimeLabel(row.duplicate_review_updated_at);
    const detailParts = [];

    if (note) {
      detailParts.push(note);
    }
    if (actor) {
      detailParts.push(`Bởi ${actor}`);
    }
    if (timestamp) {
      detailParts.push(timestamp);
    }

    return {
      ...DECLARATION_STATUS_META.NEEDS_REVIEW,
      detail: detailParts.join(" • ") || null,
    };
  }

  if (row.reviewed) {
    const reviewer = normalizeStr(row.reviewed_by || row.duplicate_review_actor || "");
    const timestamp = formatDateTimeLabel(row.reviewed_at || row.duplicate_review_updated_at);
    const detailParts = [];

    if (reviewer) {
      detailParts.push(`Bởi ${reviewer}`);
    }
    if (timestamp) {
      detailParts.push(timestamp);
    }

    return {
      ...DECLARATION_STATUS_META.REVIEWED,
      detail: detailParts.join(" • ") || null,
    };
  }

  if (!hasStaff || !hasTeam) {
    const missing = [];

    if (!hasStaff) {
      missing.push("nhân viên");
    }
    if (!hasTeam) {
      missing.push("tổ đội");
    }

    return {
      ...DECLARATION_STATUS_META.PENDING_ASSIGNMENT,
      detail: missing.length ? `Thiếu ${missing.join(" & ")}` : null,
    };
  }

  const timestamp = formatDateTimeLabel(
    row.imported_at || row.created_at || row.synced_at || row.updated_at || row.last_sync_at,
  );

  return {
    ...DECLARATION_STATUS_META.NEW,
    detail: timestamp ? `Cập nhật ${timestamp}` : null,
  };
}
