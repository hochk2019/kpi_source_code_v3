import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const COLUMN_OPTIONS = Object.freeze([
  { key: "mst", label: "MST", required: true },
  { key: "company", label: "Công ty" },
  { key: "person_import", label: "Người phụ trách Nhập" },
  { key: "person_export", label: "Người phụ trách Xuất" },
  { key: "agency", label: "Đại lý HQ" },
  { key: "status", label: "Trạng thái" },
  { key: "effective_from", label: "Áp dụng từ ngày" },
  { key: "effective_to", label: "Đến hết ngày" },
  { key: "actions", label: "Hành động" },
]);

const createDefaultVisibleColumns = () => {
  const defaults = {};
  COLUMN_OPTIONS.forEach((option) => {
    defaults[option.key] = true;
  });
  return defaults;
};

export const DEFAULT_VISIBLE_COLUMNS = Object.freeze(createDefaultVisibleColumns());
export const COLUMN_VISIBILITY_STORAGE_PREFIX = "mstAssignment.visibleColumns";
export const COLUMN_WIDTH_STORAGE_KEY = "mstAssignment.columnWidths";

export const DEFAULT_COLUMN_WIDTHS = Object.freeze({
  mst: 136,
  company: 320,
  person_import: 224,
  person_export: 224,
  agency: 280,
  status: 180,
  effective_from: 188,
  effective_to: 188,
  actions: 168,
});

export const COLUMN_MIN_WIDTH = 120;

export const COLUMN_MIN_WIDTHS = Object.freeze({
  mst: 120,
  company: 240,
  person_import: 180,
  person_export: 180,
  agency: 200,
  status: 150,
  effective_from: 160,
  effective_to: 160,
  actions: 150,
});

export const COLUMN_MAX_WIDTH = 640;

const getColumnFallbackWidth = (key, fallback = DEFAULT_COLUMN_WIDTHS) => {
  const width = fallback?.[key];
  if (Number.isFinite(width)) {
    return width;
  }
  const defaultWidth = DEFAULT_COLUMN_WIDTHS[key];
  if (Number.isFinite(defaultWidth)) {
    return defaultWidth;
  }
  return Math.max(COLUMN_MIN_WIDTHS[key] ?? COLUMN_MIN_WIDTH, COLUMN_MIN_WIDTH);
};

export function sanitizeColumnWidths(raw, fallback = DEFAULT_COLUMN_WIDTHS) {
  const result = {};
  COLUMN_OPTIONS.forEach((option) => {
    const { key } = option;
    const baseWidth = getColumnFallbackWidth(key, fallback);
    const minWidth = COLUMN_MIN_WIDTHS[key] ?? COLUMN_MIN_WIDTH;

    let width = raw?.[key];
    if (typeof width === "string" && width.trim() !== "") {
      width = Number.parseFloat(width);
    }
    if (!Number.isFinite(width)) {
      width = baseWidth;
    }
    width = Math.round(width);
    if (!Number.isFinite(width) || width <= 0) {
      width = baseWidth;
    }
    if (width < minWidth) {
      width = minWidth;
    }
    if (width > COLUMN_MAX_WIDTH) {
      width = COLUMN_MAX_WIDTH;
    }
    result[key] = width;
  });
  return result;
}

export function readStoredColumnWidths(storage, fallback = DEFAULT_COLUMN_WIDTHS) {
  if (!storage) {
    return sanitizeColumnWidths({}, fallback);
  }
  try {
    const raw = storage.getItem(COLUMN_WIDTH_STORAGE_KEY);
    if (!raw) {
      return sanitizeColumnWidths({}, fallback);
    }
    const parsed = JSON.parse(raw);
    return sanitizeColumnWidths(parsed, fallback);
  } catch (error) {
    console.warn("readStoredColumnWidths", error);
    return sanitizeColumnWidths({}, fallback);
  }
}

export function writeStoredColumnWidths(storage, widths) {
  if (!storage) {
    return false;
  }
  try {
    const sanitized = sanitizeColumnWidths(widths);
    storage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch (error) {
    console.warn("writeStoredColumnWidths", error);
    return false;
  }
}

const normalizeActorKey = (username) => {
  if (!username) {
    return "guest";
  }
  const value = username.toString().trim();
  return value || "guest";
};

const getColumnVisibilityStorageKey = (username) =>
  `${COLUMN_VISIBILITY_STORAGE_PREFIX}:${normalizeActorKey(username)}`;

export function sanitizeColumnVisibility(raw, fallback = DEFAULT_VISIBLE_COLUMNS) {
  const result = {};
  COLUMN_OPTIONS.forEach((option) => {
    if (option.required) {
      result[option.key] = true;
      return;
    }
    const fallbackValue = fallback?.[option.key] !== false;
    let value = raw?.[option.key];
    if (typeof value === "string") {
      const trimmed = value.trim().toLowerCase();
      if (["false", "0", "off", "no"].includes(trimmed)) {
        value = false;
      } else if (["true", "1", "on", "yes"].includes(trimmed)) {
        value = true;
      }
    }
    if (typeof value !== "boolean") {
      value = value === 0 ? false : fallbackValue;
    }
    result[option.key] = value;
  });
  return result;
}

export function readStoredColumnVisibility(
  storage,
  username,
  fallback = DEFAULT_VISIBLE_COLUMNS
) {
  const defaults = sanitizeColumnVisibility(fallback);
  if (!storage) {
    return defaults;
  }
  try {
    const key = getColumnVisibilityStorageKey(username);
    const raw = storage.getItem(key);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeColumnVisibility(parsed, defaults);
    return { ...defaults, ...sanitized };
  } catch (error) {
    console.warn("readStoredColumnVisibility", error);
    return defaults;
  }
}

export function writeStoredColumnVisibility(storage, username, visibility) {
  if (!storage) {
    return false;
  }
  try {
    const key = getColumnVisibilityStorageKey(username);
    const sanitized = sanitizeColumnVisibility(visibility);
    storage.setItem(key, JSON.stringify(sanitized));
    return true;
  } catch (error) {
    console.warn("writeStoredColumnVisibility", error);
    return false;
  }
}

export const getColumnLabel = (key) =>
  COLUMN_OPTIONS.find((option) => option.key === key)?.label || key;

export function useMSTAssignmentColumnLayout({ actor = "guest" } = {}) {
  const canUseLocalStorage =
    typeof window !== "undefined" && typeof window.localStorage !== "undefined";

  const defaultVisibleColumns = useMemo(
    () => sanitizeColumnVisibility(DEFAULT_VISIBLE_COLUMNS),
    []
  );

  const [columnWidths, setColumnWidths] = useState(() => {
    if (!canUseLocalStorage) {
      return sanitizeColumnWidths(DEFAULT_COLUMN_WIDTHS);
    }
    return readStoredColumnWidths(window.localStorage, DEFAULT_COLUMN_WIDTHS);
  });

  const columnWidthsRef = useRef(columnWidths);
  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  const pendingColumnWidthsRef = useRef(columnWidths);
  const persistColumnWidthsTimeoutRef = useRef(null);

  const schedulePersistColumnWidths = useCallback(
    (nextWidths) => {
      if (!canUseLocalStorage) {
        return;
      }
      pendingColumnWidthsRef.current = nextWidths;
      if (persistColumnWidthsTimeoutRef.current) {
        clearTimeout(persistColumnWidthsTimeoutRef.current);
      }
      persistColumnWidthsTimeoutRef.current = setTimeout(() => {
        writeStoredColumnWidths(window.localStorage, pendingColumnWidthsRef.current);
        persistColumnWidthsTimeoutRef.current = null;
      }, 280);
    },
    [canUseLocalStorage]
  );

  useEffect(() => {
    schedulePersistColumnWidths(columnWidths);
  }, [columnWidths, schedulePersistColumnWidths]);

  useEffect(() => {
    return () => {
      if (persistColumnWidthsTimeoutRef.current) {
        clearTimeout(persistColumnWidthsTimeoutRef.current);
      }
      if (typeof document !== "undefined" && document.body) {
        document.body.style.removeProperty("user-select");
        document.body.style.removeProperty("cursor");
      }
    };
  }, []);

  const columnResizeStateRef = useRef({ key: null, startX: 0, startWidth: 0 });

  const handleColumnResizeStart = useCallback((key, event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const currentWidths = columnWidthsRef.current || {};
    const startWidth = currentWidths[key] ?? getColumnFallbackWidth(key);
    columnResizeStateRef.current = {
      key,
      startX: event.clientX,
      startWidth,
    };
    if (typeof document !== "undefined" && document.body) {
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    }
  }, []);

  const handleColumnResizeMove = useCallback((event) => {
    const state = columnResizeStateRef.current;
    if (!state?.key) {
      return;
    }
    const delta = event.clientX - state.startX;
    const proposed = state.startWidth + delta;
    const minWidth = COLUMN_MIN_WIDTHS[state.key] ?? COLUMN_MIN_WIDTH;
    const nextWidth = Math.min(
      COLUMN_MAX_WIDTH,
      Math.max(minWidth, Math.round(proposed))
    );
    setColumnWidths((prev) => {
      const current = prev?.[state.key];
      if (current === nextWidth) {
        return prev;
      }
      return { ...prev, [state.key]: nextWidth };
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleMove = (event) => {
      if (!columnResizeStateRef.current?.key) {
        return;
      }
      handleColumnResizeMove(event);
    };
    const handleUp = () => {
      if (!columnResizeStateRef.current?.key) {
        return;
      }
      columnResizeStateRef.current = { key: null, startX: 0, startWidth: 0 };
      if (typeof document !== "undefined" && document.body) {
        document.body.style.removeProperty("user-select");
        document.body.style.removeProperty("cursor");
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [handleColumnResizeMove]);

  const handleResetColumnWidths = useCallback(() => {
    setColumnWidths(sanitizeColumnWidths(DEFAULT_COLUMN_WIDTHS));
  }, []);

  const columnStyleMap = useMemo(() => {
    const map = {};
    COLUMN_OPTIONS.forEach((option) => {
      const key = option.key;
      const stored = columnWidths?.[key];
      const minWidth = COLUMN_MIN_WIDTHS[key] ?? COLUMN_MIN_WIDTH;
      const fallbackWidth = getColumnFallbackWidth(key);
      const resolved = Math.max(
        minWidth,
        Number.isFinite(stored) ? stored : fallbackWidth
      );
      map[key] = {
        width: `${resolved}px`,
        minWidth: `${minWidth}px`,
        maxWidth: `${Math.max(resolved, minWidth)}px`,
      };
    });
    return map;
  }, [columnWidths]);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    if (!canUseLocalStorage) {
      return defaultVisibleColumns;
    }
    return readStoredColumnVisibility(window.localStorage, actor, defaultVisibleColumns);
  });

  useEffect(() => {
    if (!canUseLocalStorage) {
      setVisibleColumns(defaultVisibleColumns);
      return;
    }
    const storedVisibility = readStoredColumnVisibility(
      window.localStorage,
      actor,
      defaultVisibleColumns
    );
    setVisibleColumns((prev) => {
      const allKeys = new Set([
        ...Object.keys(prev || {}),
        ...Object.keys(storedVisibility || {}),
      ]);
      const isSame = Array.from(allKeys).every(
        (key) => prev?.[key] === storedVisibility?.[key]
      );
      if (isSame) {
        return prev;
      }
      return storedVisibility;
    });
  }, [actor, canUseLocalStorage, defaultVisibleColumns]);

  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const isColumnVisible = useCallback(
    (key) => {
      const option = COLUMN_OPTIONS.find((item) => item.key === key);
      if (!option || option.required) {
        return true;
      }
      return visibleColumns[key] !== false;
    },
    [visibleColumns]
  );

  const visibleColumnKeys = useMemo(
    () =>
      COLUMN_OPTIONS.filter((option) => isColumnVisible(option.key)).map(
        (option) => option.key
      ),
    [isColumnVisible]
  );

  const toggleColumnVisibility = useCallback(
    (key) => {
      const option = COLUMN_OPTIONS.find((item) => item.key === key);
      if (option?.required) {
        return;
      }
      setVisibleColumns((prev) => {
        const next = { ...prev, [key]: prev[key] === false };
        if (canUseLocalStorage) {
          writeStoredColumnVisibility(window.localStorage, actor, next);
        }
        return next;
      });
    },
    [actor, canUseLocalStorage]
  );

  return {
    columnMenuOpen,
    columnStyleMap,
    handleColumnResizeStart,
    handleResetColumnWidths,
    isColumnVisible,
    setColumnMenuOpen,
    toggleColumnVisibility,
    visibleColumnKeys,
  };
}
