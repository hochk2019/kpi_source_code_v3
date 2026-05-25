export const DECL_HISTORY_KEY = 'decl_history_v1';
export const DECL_HISTORY_PER_ROW_LIMIT = 20;
export const DECL_HISTORY_MAX_ROWS = 300;

const DECL_HISTORY_FIELD_GROUP = Object.freeze({
  agency: 'agency',
  dai_ly: 'agency',
  licenses: 'licenses',
  so_luong_gp: 'licenses',
  licenseManualCount: 'licenses',
});

export function createDeclHistoryStore({
  getItem = () => null,
  setItem = () => { },
  normalizeStr = (value) => String(value ?? '').trim(),
  safeParse = (_json, fallback) => fallback,
  historyKey = DECL_HISTORY_KEY,
  perRowLimit = DECL_HISTORY_PER_ROW_LIMIT,
  maxRows = DECL_HISTORY_MAX_ROWS,
} = {}) {
  function normalizeDeclHistoryValue(value) {
    if (value === null || value === undefined) return '';

    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeDeclHistoryValue(item))
        .filter((part) => typeof part === 'string' && part.length > 0)
        .join(', ');
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : '';
    }

    if (typeof value === 'boolean') {
      return value ? 'Có' : 'Không';
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }

    return normalizeStr(value);
  }

  function pickDeclLicenseValue(row) {
    if (!row || typeof row !== 'object') return '';

    const candidates = [row.licenseManualCount, row.licenses, row.so_luong_gp];
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined || candidate === '') {
        continue;
      }

      if (typeof candidate === 'number') {
        if (Number.isFinite(candidate)) {
          return candidate;
        }
        continue;
      }

      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (!trimmed) {
          continue;
        }
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
        return trimmed;
      }

      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
      return candidate;
    }

    return '';
  }

  function extractDeclHistoryValue(row, field) {
    if (!row || typeof row !== 'object') return '';

    switch (field) {
      case 'agency':
        return row.agency ?? row.dai_ly ?? '';
      case 'licenses':
        return pickDeclLicenseValue(row);
      default:
        return row[field];
    }
  }

  function buildDeclHistoryChanges(current, nextRow, changedFields) {
    if (!Array.isArray(changedFields) || changedFields.length === 0) {
      return [];
    }

    const groups = new Map();
    for (const field of changedFields) {
      const resolved = DECL_HISTORY_FIELD_GROUP[field] || field;
      if (!resolved || groups.has(resolved)) {
        continue;
      }

      const before = normalizeDeclHistoryValue(
        extractDeclHistoryValue(current, resolved),
      );
      const after = normalizeDeclHistoryValue(
        extractDeclHistoryValue(nextRow, resolved),
      );
      if (before === after) {
        continue;
      }

      groups.set(resolved, {
        field: resolved,
        before,
        after,
      });
    }

    return Array.from(groups.values());
  }

  function normalizeDeclHistoryEntry(rowKey, entry) {
    if (!entry || typeof entry !== 'object') return null;

    const timestamp = entry.ts || entry.timestamp || new Date().toISOString();
    const actor = normalizeStr(entry.actor) || 'system';
    const rawChanges = Array.isArray(entry.changes) ? entry.changes : [];
    const changes = rawChanges
      .map((change) => {
        if (!change || typeof change !== 'object') return null;

        const fieldKey = (change.field || change.key || change.name || '')
          .toString()
          .trim();
        if (!fieldKey) return null;

        const resolved = DECL_HISTORY_FIELD_GROUP[fieldKey] || fieldKey;
        const before = normalizeDeclHistoryValue(
          change.before ?? change.old ?? change.previous ?? '',
        );
        const after = normalizeDeclHistoryValue(
          change.after ?? change.new ?? change.next ?? '',
        );
        if (before === after) return null;

        return {
          field: resolved,
          before,
          after,
        };
      })
      .filter(Boolean);

    if (!changes.length) return null;

    return {
      id:
        entry.id ||
        `decl-${rowKey}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`,
      ts: new Date(timestamp).toISOString(),
      actor,
      changes,
    };
  }

  function sanitizeDeclHistoryStore(rawStore) {
    const safeRows = {};
    if (!rawStore || typeof rawStore !== 'object') {
      return { rows: safeRows };
    }

    const sourceRows =
      rawStore.rows &&
        typeof rawStore.rows === 'object' &&
        !Array.isArray(rawStore.rows)
        ? rawStore.rows
        : {};

    for (const [key, list] of Object.entries(sourceRows)) {
      const normalizedKey = normalizeStr(key);
      if (!normalizedKey) continue;

      const entries = Array.isArray(list)
        ? list
          .map((entry) => normalizeDeclHistoryEntry(normalizedKey, entry))
          .filter(Boolean)
        : [];

      if (entries.length) {
        safeRows[normalizedKey] = entries.slice(0, perRowLimit);
      }
    }

    return { rows: safeRows };
  }

  function getDeclHistoryStore() {
    const parsed = safeParse(getItem(historyKey), { rows: {} });
    return sanitizeDeclHistoryStore(parsed);
  }

  function persistDeclHistoryStore(store) {
    const payload = sanitizeDeclHistoryStore(store);
    const rows = payload.rows || {};
    const rowEntries = Object.entries(rows)
      .map(([key, list]) => {
        const items = Array.isArray(list) ? list.filter(Boolean) : [];
        if (!items.length) {
          delete rows[key];
          return null;
        }

        rows[key] = items.slice(0, perRowLimit);
        const latestTs = rows[key][0]?.ts || '1970-01-01T00:00:00.000Z';
        return { key, ts: latestTs };
      })
      .filter(Boolean);

    if (rowEntries.length > maxRows) {
      rowEntries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      const keep = new Set(rowEntries.slice(0, maxRows).map((entry) => entry.key));
      for (const key of Object.keys(rows)) {
        if (!keep.has(key)) {
          delete rows[key];
        }
      }
    }

    setItem(historyKey, JSON.stringify({ rows })).catch((e) => console.error('Background persistDeclHistoryStore failed', e));
    return { rows };
  }

  function appendDeclHistoryEntry(rowKey, entry) {
    const key =
      typeof rowKey === 'string' ? rowKey.trim() : String(rowKey || '').trim();
    if (!key) return null;
    if (
      !entry ||
      typeof entry !== 'object' ||
      !Array.isArray(entry.changes) ||
      !entry.changes.length
    ) {
      return null;
    }

    const store = getDeclHistoryStore();
    const actor = normalizeStr(entry.actor) || 'system';
    const timestamp = entry.ts || entry.timestamp || new Date().toISOString();
    const changes = entry.changes
      .map((change) => {
        if (!change || typeof change !== 'object') return null;

        const fieldKey = (change.field || change.key || '').toString().trim();
        if (!fieldKey) return null;

        const resolved = DECL_HISTORY_FIELD_GROUP[fieldKey] || fieldKey;
        const before = normalizeDeclHistoryValue(change.before);
        const after = normalizeDeclHistoryValue(change.after);
        if (before === after) return null;

        return {
          field: resolved,
          before,
          after,
        };
      })
      .filter(Boolean);

    if (!changes.length) {
      return null;
    }

    const normalizedEntry = {
      id:
        entry.id ||
        `decl-${key}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`,
      ts: new Date(timestamp).toISOString(),
      actor,
      changes,
    };
    const existing = Array.isArray(store.rows[key]) ? store.rows[key] : [];
    const nextStore = {
      rows: {
        ...store.rows,
        [key]: [normalizedEntry, ...existing].slice(0, perRowLimit),
      },
    };

    persistDeclHistoryStore(nextStore);
    return normalizedEntry;
  }

  function getDeclHistoryForRow(rowKey, limit = perRowLimit) {
    const key =
      typeof rowKey === 'string' ? rowKey.trim() : String(rowKey || '').trim();
    if (!key) return [];

    const store = getDeclHistoryStore();
    const list = Array.isArray(store.rows[key]) ? store.rows[key] : [];
    if (!Number.isFinite(limit) || limit <= 0) {
      return list.slice();
    }

    return list.slice(0, limit);
  }

  return {
    appendDeclHistoryEntry,
    buildDeclHistoryChanges,
    getDeclHistoryForRow,
  };
}
