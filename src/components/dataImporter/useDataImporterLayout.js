import { useCallback, useMemo } from "react";

import {
  CARD_GRID_COLUMN_OPTIONS,
  CARD_GRID_MIN_WIDTH,
  DEFAULT_CARD_GRID_COLUMNS,
  FROZEN_COLUMN_KEYS,
  FROZEN_COLUMN_WIDTHS,
  clampColumnWidth,
} from "@/components/dataImporter/dataImporterConfig.js";

export default function useDataImporterLayout({
  columnWidths,
  freezeColumnsEnabled,
  selectionEnabled,
  hiddenColumns,
  cardGridColumns,
  containerWidth,
  visibleColumnCount,
  updateEnabled,
  deleteEnabled,
  historyEnabled,
}) {
  const resolveColumnWidth = useCallback(
    (key) => {
      const stored = columnWidths?.[key];
      if (Number.isFinite(stored) && stored > 0) {
        return clampColumnWidth(stored);
      }
      const fallback = FROZEN_COLUMN_WIDTHS[key];
      if (Number.isFinite(fallback)) {
        return fallback;
      }
      return undefined;
    },
    [columnWidths],
  );

  const getColumnStyle = useCallback(
    (key) => {
      const width = resolveColumnWidth(key);
      if (!width) {
        return undefined;
      }
      return {
        minWidth: `${width}px`,
        width: `${width}px`,
      };
    },
    [resolveColumnWidth],
  );

  const frozenOffsets = useMemo(() => {
    if (!freezeColumnsEnabled) {
      return { total: 0 };
    }

    let offset = 0;
    const config = {};

    if (selectionEnabled) {
      config.selection = { left: offset, width: FROZEN_COLUMN_WIDTHS.selection };
      offset += FROZEN_COLUMN_WIDTHS.selection;
    }

    for (const key of FROZEN_COLUMN_KEYS) {
      if (hiddenColumns.has(key)) {
        continue;
      }
      const width = resolveColumnWidth(key);
      if (!width) {
        continue;
      }
      config[key] = { left: offset, width };
      offset += width;
    }

    config.total = offset;
    return config;
  }, [freezeColumnsEnabled, hiddenColumns, resolveColumnWidth, selectionEnabled]);

  const getFrozenStyle = useCallback(
    (key) => {
      if (!freezeColumnsEnabled) {
        return undefined;
      }
      const config = frozenOffsets[key];
      if (!config) {
        return undefined;
      }
      return {
        left: `${config.left}px`,
        minWidth: `${config.width}px`,
        width: `${config.width}px`,
        maxWidth: `${config.width}px`,
      };
    },
    [freezeColumnsEnabled, frozenOffsets],
  );

  const historyIndent = useMemo(() => {
    const total = Number(frozenOffsets.total || 0);
    if (selectionEnabled) {
      const selectionWidth = resolveColumnWidth("selection") ?? FROZEN_COLUMN_WIDTHS.selection;
      return Math.max(0, total - selectionWidth);
    }
    return total;
  }, [frozenOffsets, resolveColumnWidth, selectionEnabled]);

  const effectiveCardColumns = useMemo(() => {
    if (CARD_GRID_COLUMN_OPTIONS.includes(cardGridColumns)) {
      return cardGridColumns;
    }
    return DEFAULT_CARD_GRID_COLUMNS;
  }, [cardGridColumns]);

  const appliedCardColumns = useMemo(() => {
    if (containerWidth <= 0) {
      return effectiveCardColumns;
    }
    const maxFit = Math.max(1, Math.floor(containerWidth / CARD_GRID_MIN_WIDTH));
    return Math.max(1, Math.min(effectiveCardColumns, maxFit));
  }, [containerWidth, effectiveCardColumns]);

  const cardGridStyle = useMemo(() => {
    if (appliedCardColumns <= 1) {
      return { gridTemplateColumns: "repeat(1, minmax(0, 1fr))" };
    }
    return {
      gridTemplateColumns: `repeat(${appliedCardColumns}, minmax(0, 1fr))`,
    };
  }, [appliedCardColumns]);

  const totalColumns =
    visibleColumnCount +
    (selectionEnabled ? 1 : 0) +
    (updateEnabled ? 1 : 0) +
    (deleteEnabled ? 1 : 0) +
    (historyEnabled ? 1 : 0);

  return {
    resolveColumnWidth,
    getColumnStyle,
    frozenOffsets,
    getFrozenStyle,
    historyIndent,
    effectiveCardColumns,
    appliedCardColumns,
    cardGridStyle,
    totalColumns,
    frozenHeaderClass:
      "sticky top-0 z-40 bg-gray-50 shadow-[4px_0_8px_rgba(148,163,184,0.18)] dark:bg-slate-900",
    frozenCellClass:
      "sticky z-30 bg-inherit shadow-[4px_0_6px_rgba(148,163,184,0.12)] dark:bg-inherit",
  };
}
