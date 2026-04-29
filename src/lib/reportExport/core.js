// reportExport/core.js
// Core utilities for report export

import { fetchWithAuth } from '../auth/localAuth.js';
import { API_V4_ROUTES } from '../apiRoutes.js';

export function ensureWindow() {
  if (typeof window === "undefined") {
    throw new Error("Tính năng xuất báo cáo chỉ khả dụng trong trình duyệt");
  }
}

export function parseFilename(disposition) {
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

export function triggerDownload(blob, filename) {
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

export async function requestExport(kind, payload, fallbackFilename) {
  ensureWindow();

  if (typeof fetch !== "function") {
    throw new Error("Trình duyệt không hỗ trợ fetch");
  }

  const response = await fetchWithAuth(API_V4_ROUTES.reporting.exports, {
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
        if (text) message = text;
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

export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildCompactExportPayload({ range, rules, columns, staff, team }) {
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
