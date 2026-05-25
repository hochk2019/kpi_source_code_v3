import { normalizeStr } from "@/lib/storeCoreHelpers.js";
import { deriveCOStatus } from "../../../packages/domain/src/co.js";

const CODE_INPUT_SPLIT = /[\s,;]+/;

export function coerceLicenseValue(value) {
  if (value === "" || value === null || value === undefined) return "";

  const str = String(value).trim();
  if (str === "") return "";

  const num = Number(str);
  if (!Number.isFinite(num)) return "";

  return Math.max(0, Math.round(num));
}

export function ensureLicenseFields(row) {
  if (!row || typeof row !== "object") return row;

  let next = row;
  const ensureClone = () => {
    if (next === row) {
      next = { ...row };
    }
  };

  const source = row.licenses ?? row.so_luong_gp;
  if (source !== undefined) {
    const normalized = coerceLicenseValue(source);

    if (normalized === "") {
      if (row.licenses !== "" || row.so_luong_gp !== "") {
        ensureClone();
        next.licenses = "";
        next.so_luong_gp = "";
      }
    } else if (row.licenses !== normalized || row.so_luong_gp !== normalized) {
      ensureClone();
      next.licenses = normalized;
      next.so_luong_gp = normalized;
    }
  }

  if (Object.prototype.hasOwnProperty.call(row, "licenseManualCount")) {
    const manualNormalized = coerceLicenseValue(row.licenseManualCount);

    if (manualNormalized === "") {
      if (row.licenseManualCount !== null && row.licenseManualCount !== undefined) {
        ensureClone();
        next.licenseManualCount = null;
      }
    } else if (row.licenseManualCount !== manualNormalized) {
      ensureClone();
      next.licenseManualCount = manualNormalized;
    }

    if (manualNormalized !== "") {
      if (next.licenses !== manualNormalized || next.so_luong_gp !== manualNormalized) {
        ensureClone();
        next.licenses = manualNormalized;
        next.so_luong_gp = manualNormalized;
      }
    }
  }

  return next;
}

export function normalizeLicenseCode(value) {
  const normalized = normalizeStr(value);
  if (!normalized) return "";
  return normalized.toUpperCase();
}

export function normalizeAgencyKey(value) {
  let normalized = normalizeStr(value);
  if (!normalized) return "";

  let previous = null;
  while (normalized && normalized !== previous) {
    previous = normalized;
    normalized = normalized.replace(/^[\s"'([{<]+|[\s"'(){}\]}>]+$/g, "");
    normalized = normalizeStr(normalized);
  }

  if (!normalized) return "";
  return normalized.toUpperCase();
}

export function parseCodeListInput(text) {
  if (!text) return [];

  return Array.from(
    new Set(
      text
        .split(CODE_INPUT_SPLIT)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export function joinCodeList(list) {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list.join("\n");
}

export function extractAgencyKeys(row) {
  const keys = new Set();

  const addKey = (value) => {
    if (value === undefined || value === null) return;

    const normalized = normalizeAgencyKey(value);
    if (normalized) {
      keys.add(normalized);
    }

    const parentMatches = String(value).match(/\(([^)]+)\)/g);
    if (parentMatches) {
      parentMatches.forEach((segment) => {
        const inner = segment.replace(/^\(|\)$/g, "");
        const normalizedInner = normalizeAgencyKey(inner);
        if (normalizedInner) {
          keys.add(normalizedInner);
        }
      });
    }
  };

  if (Array.isArray(row?.agents)) {
    for (const agent of row.agents) {
      addKey(agent);
    }
  }

  const raw = row?.agency ?? row?.dai_ly ?? row?.hq_agency ?? "";
  if (Array.isArray(raw)) {
    for (const value of raw) {
      addKey(value);
    }
  } else if (typeof raw === "string") {
    raw
      .split(/[\n,;|]/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach(addKey);
  } else if (raw) {
    addKey(raw);
  }

  return Array.from(keys);
}

export function ensureCOFields(row) {
  if (!row || typeof row !== "object") return row;

  const status = deriveCOStatus(row, row);
  if (
    status.co === row.co &&
    status.has_co === row.has_co &&
    status.co_line_count === row.co_line_count
  ) {
    return row;
  }

  return status;
}
