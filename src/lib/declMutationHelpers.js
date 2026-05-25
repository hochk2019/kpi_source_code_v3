import { normalizeStr } from "./storeCoreHelpers.js";

export function getDeclRowSimpleKey(row) {
  if (!row || typeof row !== "object") return "";

  const soTk = (row.so_tk ?? "").toString();
  const nhanh = (row.nhanh ?? "").toString();
  return `${soTk}_${nhanh}`.trim();
}

export function sanitizePartialDeclUpdates(updates = {}) {
  if (!updates || typeof updates !== "object") {
    return {};
  }

  const safe = {};
  const assign = (key, value) => {
    safe[key] = value;
  };

  for (const [field, value] of Object.entries(updates)) {
    switch (field) {
      case "nhan_vien":
        assign("nhan_vien", normalizeStr(value));
        break;
      case "team":
        assign("team", normalizeStr(value));
        break;
      case "agency":
        assign("agency", normalizeStr(value));
        break;
      case "dai_ly":
        assign("dai_ly", normalizeStr(value));
        break;
      case "licenses":
      case "so_luong_gp":
      case "licenseManualCount": {
        if (value === "" || value === null || value === undefined) {
          assign("licenses", "");
          assign("so_luong_gp", "");
          assign("licenseManualCount", null);
          break;
        }

        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          const normalized = Math.max(0, Math.round(parsed));
          assign("licenses", normalized);
          assign("so_luong_gp", normalized);
          assign("licenseManualCount", normalized);
        }
        break;
      }
      default:
        assign(field, value);
        break;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(safe, "agency") &&
    !Object.prototype.hasOwnProperty.call(safe, "dai_ly")
  ) {
    assign("dai_ly", safe.agency);
  }
  if (
    Object.prototype.hasOwnProperty.call(safe, "dai_ly") &&
    !Object.prototype.hasOwnProperty.call(safe, "agency")
  ) {
    assign("agency", safe.dai_ly);
  }

  return safe;
}

export function applyPartialUpdatesToRow(row, updates, { sanitized = false } = {}) {
  if (!row || typeof row !== "object") {
    return { changed: false, nextRow: row };
  }

  const safeUpdates =
    sanitized && updates && typeof updates === "object"
      ? updates
      : sanitizePartialDeclUpdates(updates);
  const entries = Object.entries(safeUpdates);
  if (!entries.length) {
    return { changed: false, nextRow: row };
  }

  let changed = false;
  const nextRow = { ...row };

  for (const [field, value] of entries) {
    if (value === null) {
      if (Object.prototype.hasOwnProperty.call(nextRow, field)) {
        delete nextRow[field];
        changed = true;
      }
      continue;
    }

    if (value === undefined) {
      continue;
    }

    if (field === "licenses" || field === "so_luong_gp") {
      const normalized = value === "" ? "" : Number(value);
      if (nextRow[field] !== normalized) {
        nextRow[field] = normalized;
        changed = true;
      }
      continue;
    }

    if (nextRow[field] !== value) {
      nextRow[field] = value;
      changed = true;
    }
  }

  if (changed) {
    nextRow.updatedAt = new Date().toISOString();
  }

  return { changed, nextRow };
}
