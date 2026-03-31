import { fetchWithAuth } from '../auth/localAuth.js';
import { API_V4_ROUTES } from './apiRoutes.js';

function ensureWindow() {

  if (typeof window === "undefined") {

    throw new Error("Tính năng xuất báo cáo chỉ khả dụng trong trình duyệt");

  }

}



let apiBaseCache = null;



function resolveApiBase() {

  if (apiBaseCache !== null) {

    return apiBaseCache;

  }

  let base = "";

  if (typeof import.meta !== "undefined") {

    base = import.meta.env?.VITE_API_BASE ?? "";

  }

  if (typeof base !== "string") {

    base = "";

  }

  base = base.trim();

  apiBaseCache = base.endsWith("/") ? base.slice(0, -1) : base;

  return apiBaseCache;

}



function buildUrl(path) {

  const base = resolveApiBase();

  if (!path) return base || "";

  if (path.startsWith("http://") || path.startsWith("https://")) {

    return path;

  }

  const normalized = path.startsWith("/") ? path : `/${path}`;

  return `${base || ""}${normalized}`;

}



function parseFilename(disposition) {

  if (!disposition) return null;

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utfMatch) {

    try {

      return decodeURIComponent(utfMatch[1]);

    } catch {

      return utfMatch[1];

    }

  }

  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);

  if (asciiMatch) {

    return asciiMatch[1];

  }

  return null;

}



function triggerDownload(blob, filename) {

  ensureWindow();

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = filename || "bao-cao-kpi.xlsx";

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);

}



async function requestExport(kind, payload, fallbackFilename) {

  ensureWindow();

  if (typeof fetch !== "function") {

    throw new Error("Trình duyệt không hỗ trợ fetch");

  }



  const response = await fetchWithAuth(buildUrl(API_V4_ROUTES.reporting.exports), {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ kind, payload }),

  });



  if (!response.ok) {

    let message = "Không thể xuất báo cáo";

    try {

      const data = await response.json();

      message = data?.error || data?.message || message;

    } catch {

      try {

        const text = await response.text();

        if (text) {

          message = text;

        }

      } catch {

        // bỏ qua

      }

    }

    throw new Error(message);

  }



  const blob = await response.blob();

  const disposition = response.headers.get("content-disposition");

  const filename = parseFilename(disposition) || fallbackFilename || "bao-cao-kpi.xlsx";

  triggerDownload(blob, filename);

}

function normalizeText(value) {

  return typeof value === "string" ? value.trim() : "";

}

function buildCompactExportPayload({ range, rules, columns, staff, team }) {

  const payload = {

    source: "reporting-v4",

    query: {

      from: normalizeText(range?.from),

      to: normalizeText(range?.to),

    },

    columns: columns && typeof columns === "object" ? { ...columns } : {},

  };

  const ruleId = normalizeText(rules?.id);

  if (ruleId) {

    payload.ruleId = ruleId;

  }

  const staffKey = normalizeText(staff?.key);

  if (staffKey) {

    payload.staffKey = staffKey;

  }

  const teamKey = normalizeText(team?.key);

  if (teamKey) {

    payload.teamKey = teamKey;

  }

  return payload;

}



export async function exportStaffReport({ staff, range, rules, columns }) {

  const fallback = `bao-cao-kpi-nhan-vien-${(staff?.name || "chua-gan").replace(/\s+/g, "-")}.xlsx`;
  await requestExport(
    "staff",
    buildCompactExportPayload({ staff, range, rules, columns }),
    fallback.toLowerCase()
  );

}



export async function exportTeamReport({ team, range, rules, columns }) {

  const fallback = `bao-cao-kpi-to-doi-${(team?.name || "chua-gan").replace(/\s+/g, "-")}.xlsx`;
  await requestExport(
    "team",
    buildCompactExportPayload({ team, range, rules, columns }),
    fallback.toLowerCase()
  );

}



export async function exportAllStaffReport({ range, rules, columns }) {
  await requestExport(
    "allStaff",
    buildCompactExportPayload({ range, rules, columns }),
    "bao-cao-kpi-nhan-vien-tong-hop.xlsx"
  );

}



export async function exportAllTeamReport({ range, rules, columns }) {
  await requestExport(
    "allTeam",
    buildCompactExportPayload({ range, rules, columns }),
    "bao-cao-kpi-to-doi-tong-hop.xlsx"
  );

}



export default {

  exportStaffReport,

  exportTeamReport,

  exportAllStaffReport,

  exportAllTeamReport,

};



