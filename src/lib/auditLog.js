const DEFAULT_AUDIT_LOG_LIMIT = 200;

function inferAuditCategory(action) {
  if (typeof action !== "string" || !action) {
    return "khac";
  }

  const normalized = action.trim();
  const separatorIndex = normalized.indexOf(".");
  if (separatorIndex <= 0) {
    return normalized;
  }

  return normalized.slice(0, separatorIndex);
}

function normalizeAuditNote(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = `${value}`.trim();
  if (!text) {
    return null;
  }

  return text.normalize("NFC");
}

export function createAuditLogStore({
  getItem = () => null,
  setItem = () => { },
  safeParse = (_json, fallback) => fallback,
  shallowClone = (value) => value,
  auditKey = "audit_logs_v1",
  auditLimit = DEFAULT_AUDIT_LOG_LIMIT,
} = {}) {
  function readAuditLogs() {
    const stored = safeParse(getItem(auditKey), []);
    return Array.isArray(stored) ? stored : [];
  }

  function writeAuditLogs(list) {
    const payload = Array.isArray(list) ? list : [];
    Promise.resolve(setItem(auditKey, JSON.stringify(payload))).catch((e) => console.error('Background writeAuditLogs failed', e));
    return payload;
  }

  return {
    pushAuditLog({
      actor = "system",
      action = "unknown",
      detail = "",
      meta = null,
      category,
      result = null,
      note = null,
    } = {}) {
      const entry = {
        ts: new Date().toISOString(),
        actor,
        action,
        category: category || inferAuditCategory(action),
        detail,
        result: result === null || result === undefined ? null : `${result}`.trim() || null,
        note: normalizeAuditNote(note),
        meta: meta == null ? null : shallowClone(meta),
      };

      const logs = readAuditLogs();
      logs.unshift(entry);
      const limited = logs.slice(0, auditLimit);
      writeAuditLogs(limited);
      return entry;
    },

    getAuditLogs(limit = 100) {
      const logs = readAuditLogs();
      if (!Number.isFinite(limit) || limit <= 0) {
        return logs;
      }
      return logs.slice(0, limit);
    },

    clearAuditLogs({ actor = "system", note = "Xóa toàn bộ nhật ký" } = {}) {
      const entry = {
        ts: new Date().toISOString(),
        actor,
        action: "audit.clear",
        category: "audit",
        detail: note,
        result: "success",
        note: normalizeAuditNote(note),
        meta: null,
      };

      writeAuditLogs([entry]);
      return entry;
    },
  };
}
