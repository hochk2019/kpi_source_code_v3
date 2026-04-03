export const DECL_DELETED_LOG_KEY = 'decl_deleted_log_v1';
export const DECL_DELETED_LOG_LIMIT = 500;

export function createDeclDeletedLogStore({
  getItem = () => null,
  setItem = () => {},
  normalizeStr = (value) => String(value ?? '').trim(),
  normalizeDeclarationNumber = (value) =>
    String(value ?? '')
      .replace(/\D/g, '')
      .trim(),
  normalizeDateInput = () => null,
  safeParse = (_json, fallback) => fallback,
  deletedLogKey = DECL_DELETED_LOG_KEY,
  deletedLogLimit = DECL_DELETED_LOG_LIMIT,
} = {}) {
  function normalizeDeletedLogString(value) {
    const text = normalizeStr(value);
    if (!text) {
      return '';
    }
    try {
      return text.normalize('NFC');
    } catch {
      return text;
    }
  }

  function normalizeDeletedDeclLogEntry(entry, defaults = {}) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const soTk = normalizeDeclarationNumber(
      entry.so_tk ?? entry.number ?? defaults.so_tk ?? '',
    );
    if (!soTk) {
      return null;
    }

    const nhanh = normalizeDeletedLogString(
      entry.nhanh ?? entry.branch ?? defaults.nhanh ?? '',
    );
    const mst = normalizeDeletedLogString(
      entry.mst ??
        entry.ma_so_thue ??
        entry.tax_code ??
        entry.ma_so_thue_dn ??
        entry.mst_dn ??
        defaults.mst ??
        '',
    );
    const company = normalizeDeletedLogString(
      entry.company ??
        entry.cong_ty ??
        entry.ten_cong_ty ??
        entry.ten_dn ??
        entry.doanh_nghiep ??
        entry.ten_doanh_nghiep ??
        defaults.company ??
        '',
    );
    const deletedBy = normalizeDeletedLogString(
      entry.deleted_by ?? entry.actor ?? defaults.deleted_by ?? '',
    );
    const typeInput = entry.type ?? defaults.type;
    const type = typeInput === 'hard' ? 'hard' : 'soft';
    const deletedAtSource =
      entry.deleted_at ??
      entry.ts ??
      defaults.deleted_at ??
      defaults.timestamp ??
      '';
    const deletedAt =
      normalizeStr(deletedAtSource) || new Date().toISOString();

    return {
      so_tk: soTk,
      nhanh: nhanh || null,
      mst: mst || null,
      company: company || null,
      type,
      deleted_at: deletedAt,
      deleted_by: deletedBy || null,
    };
  }

  function buildDeletedDeclLogEntryFromRow(
    row,
    {
      actor = 'system',
      type = 'soft',
      timestamp = new Date().toISOString(),
    } = {},
  ) {
    if (!row || typeof row !== 'object') {
      return null;
    }

    return normalizeDeletedDeclLogEntry(
      {
        so_tk: row.so_tk ?? row.so_tk_full ?? row.number ?? '',
        nhanh: row.nhanh ?? row.branch ?? row.nhanh_kd ?? row.nhanh_hq ?? '',
        mst:
          row.mst ??
          row.ma_so_thue ??
          row.ma_so_thue_dn ??
          row.mst_dn ??
          row.tax_code ??
          '',
        company:
          row.ten_dn ??
          row.company ??
          row.cong_ty ??
          row.ten_cong_ty ??
          row.doanh_nghiep ??
          row.ten_doanh_nghiep ??
          '',
        deleted_at: timestamp,
        deleted_by: actor,
        type,
      },
      { deleted_at: timestamp, type },
    );
  }

  function readDeletedDeclLogRaw() {
    const serialized = getItem(deletedLogKey);
    const parsed = safeParse(serialized, []);

    return {
      entries: Array.isArray(parsed) ? parsed : [],
      serialized: typeof serialized === 'string' ? serialized : null,
    };
  }

  function writeDeletedDeclLog(entries, previousSerialized = null) {
    const list = Array.isArray(entries) ? entries : [];
    const normalized = [];

    for (const entry of list) {
      if (normalized.length >= deletedLogLimit) {
        break;
      }

      const sanitized = normalizeDeletedDeclLogEntry(entry);
      if (!sanitized) {
        continue;
      }
      normalized.push(sanitized);
    }

    const serialized = JSON.stringify(normalized);
    if (serialized !== previousSerialized) {
      setItem(deletedLogKey, serialized);
    }

    return normalized;
  }

  function readDeletedDeclLog() {
    const { entries, serialized } = readDeletedDeclLogRaw();
    return writeDeletedDeclLog(entries, serialized);
  }

  function appendDeletedDeclLogEntries(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length === 0) {
      return readDeletedDeclLog();
    }

    const { entries: existing, serialized } = readDeletedDeclLogRaw();
    return writeDeletedDeclLog([...list, ...existing], serialized);
  }

  function getDeletedDeclLog({ from, to, type } = {}) {
    const list = readDeletedDeclLog();
    const normalizedType =
      type === 'hard' ? 'hard' : type === 'soft' ? 'soft' : null;
    const rangeFrom = normalizeDateInput(from);
    const rangeTo = normalizeDateInput(to);

    if (!normalizedType && !rangeFrom && !rangeTo) {
      return list.map((entry) => ({ ...entry }));
    }

    const filtered = [];
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      if (normalizedType && entry.type !== normalizedType) {
        continue;
      }
      if (rangeFrom || rangeTo) {
        const entryDate = normalizeDateInput(entry.deleted_at ?? entry.ts ?? '');
        if (rangeFrom && (!entryDate || entryDate < rangeFrom)) {
          continue;
        }
        if (rangeTo && (!entryDate || entryDate > rangeTo)) {
          continue;
        }
      }
      filtered.push({ ...entry });
    }

    return filtered;
  }

  return {
    appendDeletedDeclLogEntries,
    buildDeletedDeclLogEntryFromRow,
    getDeletedDeclLog,
  };
}
