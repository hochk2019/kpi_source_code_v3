import { MST_ASSIGNMENT_STATUS } from "@/lib/mstAssignments.js";
import { normalizeStr } from "@/lib/storeCoreHelpers.js";

const normalize = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const STATUS_LABELS = Object.values(MST_ASSIGNMENT_STATUS);

export const formatISODate = (value) => {
  if (!value) return "";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("vi-VN");
  } catch (error) {
    console.warn("formatISODate", error);
    return value;
  }
};

export const normalizeStatusLabel = (value) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "";

  const normalized = normalize(raw);
  const matched = STATUS_LABELS.find((label) => normalize(label) === normalized);

  return matched || raw;
};

export const computeStoredStatus = (row) => {
  const hasImport = Boolean(normalizeStr(row?.person_import || ""));
  const hasExport = Boolean(normalizeStr(row?.person_export || ""));

  if (hasImport && hasExport) {
    return MST_ASSIGNMENT_STATUS.ASSIGNED;
  }

  return MST_ASSIGNMENT_STATUS.PENDING;
};

export const computeStatusDisplay = (row) => {
  const hasImport = Boolean(normalizeStr(row?.person_import || ""));
  const hasExport = Boolean(normalizeStr(row?.person_export || ""));

  if (hasImport && hasExport) {
    return MST_ASSIGNMENT_STATUS.ASSIGNED;
  }

  if (!hasImport && !hasExport) {
    return MST_ASSIGNMENT_STATUS.PENDING;
  }

  if (!hasImport) {
    return "Thiếu người phụ trách nhập";
  }

  if (!hasExport) {
    return "Thiếu người phụ trách xuất";
  }

  return normalizeStatusLabel(row?.status);
};
