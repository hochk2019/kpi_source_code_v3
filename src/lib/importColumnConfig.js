export const IMPORT_COLUMN_IDS = Object.freeze([
  "date",
  "declaration",
  "mst",
  "company",
  "type",
  "co",
  "items",
  "staff",
  "team",
  "agency",
  "status",
  "licenses",
  "kpi",
]);

export const IMPORT_AUX_COLUMN_IDS = Object.freeze(["history", "update"]);
export const IMPORT_SENSITIVE_COLUMNS = Object.freeze(["status", "history", "update"]);

const IMPORT_CONFIG_COLUMN_IDS = Object.freeze([
  ...IMPORT_COLUMN_IDS,
  ...IMPORT_AUX_COLUMN_IDS,
]);

const BASE_IMPORT_COLUMN_ID_SET = new Set(IMPORT_COLUMN_IDS);
const IMPORT_COLUMN_ID_SET = new Set(IMPORT_CONFIG_COLUMN_IDS);
const DEFAULT_IMPORT_COLUMN_VERSION = 2;
const DEFAULT_IMPORT_COLUMN_CONFIG = Object.freeze({
  hidden: [...new Set([...IMPORT_AUX_COLUMN_IDS, "status"])],
  version: DEFAULT_IMPORT_COLUMN_VERSION,
  widths: Object.freeze({}),
});
const MIN_IMPORT_COLUMN_WIDTH = 80;

function normalizeColumnWidths(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof key !== "string" || !IMPORT_COLUMN_ID_SET.has(key)) {
      continue;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      continue;
    }
    result[key] = Math.max(MIN_IMPORT_COLUMN_WIDTH, Math.round(numeric));
  }

  return result;
}

function normalizeImportColumnConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      hidden: DEFAULT_IMPORT_COLUMN_CONFIG.hidden.slice(),
      version: DEFAULT_IMPORT_COLUMN_CONFIG.version,
      widths: {},
    };
  }

  const rawHidden = Array.isArray(input.hidden) ? input.hidden : [];
  const seen = new Set();
  const sanitized = [];
  let baseHiddenCount = 0;

  for (const key of rawHidden) {
    if (typeof key !== "string") {
      continue;
    }
    const trimmed = key.trim();
    if (!trimmed || !IMPORT_COLUMN_ID_SET.has(trimmed) || seen.has(trimmed)) {
      continue;
    }
    sanitized.push(trimmed);
    seen.add(trimmed);
    if (BASE_IMPORT_COLUMN_ID_SET.has(trimmed)) {
      baseHiddenCount += 1;
    }
  }

  let version = Number.isFinite(input.version) ? Number(input.version) : 1;
  if (version < DEFAULT_IMPORT_COLUMN_VERSION) {
    for (const key of DEFAULT_IMPORT_COLUMN_CONFIG.hidden) {
      if (!seen.has(key) && IMPORT_COLUMN_ID_SET.has(key)) {
        sanitized.push(key);
        seen.add(key);
        if (BASE_IMPORT_COLUMN_ID_SET.has(key)) {
          baseHiddenCount += 1;
        }
      }
    }
    version = DEFAULT_IMPORT_COLUMN_VERSION;
  }

  if (baseHiddenCount >= IMPORT_COLUMN_IDS.length) {
    return {
      hidden: DEFAULT_IMPORT_COLUMN_CONFIG.hidden.filter((key) => IMPORT_COLUMN_ID_SET.has(key)),
      version: DEFAULT_IMPORT_COLUMN_VERSION,
      widths: normalizeColumnWidths(input.widths),
    };
  }

  return {
    hidden: sanitized,
    version: Math.max(version, DEFAULT_IMPORT_COLUMN_VERSION),
    widths: normalizeColumnWidths(input.widths),
  };
}

function isSameColumnConfig(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;

  const hiddenA = Array.isArray(a.hidden) ? a.hidden : [];
  const hiddenB = Array.isArray(b.hidden) ? b.hidden : [];
  if (hiddenA.length !== hiddenB.length) {
    return false;
  }

  const setB = new Set(hiddenB);
  for (const key of hiddenA) {
    if (!setB.has(key)) {
      return false;
    }
  }

  const versionA = Number.isFinite(a.version) ? Number(a.version) : 0;
  const versionB = Number.isFinite(b.version) ? Number(b.version) : 0;
  if (versionA !== versionB) {
    return false;
  }

  const widthsA = a.widths && typeof a.widths === "object" && !Array.isArray(a.widths) ? a.widths : {};
  const widthsB = b.widths && typeof b.widths === "object" && !Array.isArray(b.widths) ? b.widths : {};
  const keysA = Object.keys(widthsA);
  const keysB = Object.keys(widthsB);
  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key)) {
      return false;
    }
    const valueA = Number(widthsA[key]);
    const valueB = Number(widthsB[key]);
    if (!Number.isFinite(valueA) || !Number.isFinite(valueB)) {
      if (valueA === valueB) {
        continue;
      }
      return false;
    }
    if (valueA !== valueB) {
      return false;
    }
  }

  return true;
}

export function createImportColumnConfigStore({
  readUILayoutConfig = () => ({}),
  writeUILayoutConfig = (config) => config,
  subscribeKey = () => () => {},
  pushAuditLog = null,
  uiLayoutKey = "",
} = {}) {
  function getImportColumnConfig() {
    const layout = readUILayoutConfig();
    const importData = layout && typeof layout.importData === "object" ? layout.importData : {};
    const current = normalizeImportColumnConfig(importData.columns);
    const hiddenBaseCount = current.hidden.filter((key) => BASE_IMPORT_COLUMN_ID_SET.has(key)).length;

    if (hiddenBaseCount >= IMPORT_COLUMN_IDS.length) {
      return {
        hidden: DEFAULT_IMPORT_COLUMN_CONFIG.hidden.slice(),
        version: DEFAULT_IMPORT_COLUMN_CONFIG.version,
        widths: {},
      };
    }

    return current;
  }

  function saveImportColumnConfig({ hidden, widths } = {}, { actor = "system" } = {}) {
    const layout = readUILayoutConfig();
    const importSection = layout && typeof layout.importData === "object" ? layout.importData : {};
    const current = normalizeImportColumnConfig(importSection.columns);
    const targetHidden = Array.isArray(hidden) ? hidden : current.hidden;
    const targetWidths = widths && typeof widths === "object" && !Array.isArray(widths) ? widths : current.widths;
    const next = normalizeImportColumnConfig({
      hidden: targetHidden,
      version: DEFAULT_IMPORT_COLUMN_VERSION,
      widths: targetWidths,
    });

    const hiddenBaseCount = next.hidden.filter((key) => BASE_IMPORT_COLUMN_ID_SET.has(key)).length;
    if (hiddenBaseCount >= IMPORT_COLUMN_IDS.length || isSameColumnConfig(current, next)) {
      return current;
    }

    const nextLayout = {
      ...layout,
      importData: {
        ...importSection,
        columns: next,
      },
    };

    writeUILayoutConfig(nextLayout);

    if (typeof pushAuditLog === "function") {
      const visibleBaseColumns = IMPORT_COLUMN_IDS.length - hiddenBaseCount;
      pushAuditLog({
        actor,
        action: "import.columns.update",
        detail: `Cập nhật cột Import Data (${visibleBaseColumns}/${IMPORT_COLUMN_IDS.length} cột dữ liệu hiển thị)`,
        meta: {
          hidden: next.hidden.slice(),
          version: next.version,
          widths: { ...next.widths },
        },
      });
    }

    return next;
  }

  function subscribeImportColumnConfig(listener) {
    const fn = typeof listener === "function" ? listener : null;
    if (!fn) {
      return () => {};
    }

    const emit = () => {
      try {
        fn(getImportColumnConfig());
      } catch (err) {
        console.error("Không thể đọc cấu hình cột Import Data", err);
      }
    };

    const unsubscribe = subscribeKey(uiLayoutKey, emit);
    emit();

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }

  return {
    getImportColumnConfig,
    saveImportColumnConfig,
    subscribeImportColumnConfig,
  };
}
