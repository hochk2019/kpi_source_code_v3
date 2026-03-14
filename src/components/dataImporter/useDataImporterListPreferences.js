import { useCallback } from "react";

export default function useDataImporterListPreferences({
  columnHiddenSet,
  pageSize,
  canOverwriteData,
  defaultPageSize,
  maxPageSize,
  viewModes,
  cardGridColumnOptions,
  defaultCardGridColumns,
  setColumnDraftHidden,
  setColumnDraftError,
  setColumnConfigOpen,
  setPageSizeMode,
  setPageSizeCustomInput,
  setPage,
  setPageSize,
  setViewMode,
  setFreezeColumnsEnabled,
  setCardGridColumns,
  setShowDeletedRows,
  setOverwrite,
  confirmOverwrite = (message) =>
    typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm(message)
      : false,
}) {
  const handleOpenColumnConfig = useCallback(() => {
    setColumnDraftHidden(new Set(columnHiddenSet));
    setColumnDraftError("");
    setColumnConfigOpen(true);
  }, [columnHiddenSet, setColumnConfigOpen, setColumnDraftError, setColumnDraftHidden]);

  const handlePageSizeSelectChange = useCallback(
    (event) => {
      const { value } = event.target;
      if (value === "custom") {
        setPageSizeMode("custom");
        setPageSizeCustomInput((prev) => (prev ? prev : String(pageSize)));
        setPage(1);
        return;
      }

      const numeric = Number.parseInt(value || "", 10);
      if (!Number.isFinite(numeric)) {
        setPageSizeMode("preset");
        setPageSizeCustomInput("");
        setPage(1);
        setPageSize(defaultPageSize);
        return;
      }

      setPageSizeMode("preset");
      setPageSizeCustomInput("");
      setPage(1);
      setPageSize(numeric);
    },
    [defaultPageSize, pageSize, setPage, setPageSize, setPageSizeCustomInput, setPageSizeMode]
  );

  const handlePageSizeCustomInputChange = useCallback(
    (event) => {
      const { value } = event.target;
      setPageSizeCustomInput(value);

      const numeric = Number.parseInt(value || "", 10);
      if (!Number.isFinite(numeric)) {
        return;
      }

      const clamped = Math.max(1, Math.min(numeric, maxPageSize));
      setPage(1);
      setPageSize(clamped);
      if (clamped !== numeric) {
        setPageSizeCustomInput(String(clamped));
      }
    },
    [maxPageSize, setPage, setPageSize, setPageSizeCustomInput]
  );

  const handleToolbarViewModeChange = useCallback(
    (nextMode) => {
      setViewMode(nextMode === viewModes.CARD ? viewModes.CARD : viewModes.TABLE);
    },
    [setViewMode, viewModes.CARD, viewModes.TABLE]
  );

  const handleToolbarFreezeColumnsEnabledChange = useCallback(
    (nextValue) => {
      setFreezeColumnsEnabled(Boolean(nextValue));
    },
    [setFreezeColumnsEnabled]
  );

  const handleToolbarCardGridColumnsChange = useCallback(
    (nextValue) => {
      if (cardGridColumnOptions.includes(nextValue)) {
        setCardGridColumns(nextValue);
        return;
      }
      setCardGridColumns(defaultCardGridColumns);
    },
    [cardGridColumnOptions, defaultCardGridColumns, setCardGridColumns]
  );

  const handleToolbarPageSizeSelect = useCallback(
    (nextValue) => {
      handlePageSizeSelectChange({ target: { value: nextValue } });
    },
    [handlePageSizeSelectChange]
  );

  const handleToolbarPageSizeCustomInput = useCallback(
    (nextValue) => {
      handlePageSizeCustomInputChange({ target: { value: nextValue } });
    },
    [handlePageSizeCustomInputChange]
  );

  const handleToolbarToggleShowDeletedRows = useCallback(() => {
    setShowDeletedRows((prev) => !prev);
  }, [setShowDeletedRows]);

  const handleOverwriteToggle = useCallback(
    (nextValue) => {
      if (!canOverwriteData) {
        setOverwrite(false);
        return;
      }

      if (nextValue) {
        const confirmed = confirmOverwrite(
          "Cảnh báo: Ghi đè toàn bộ sẽ thay thế dữ liệu hiện có bằng file import. Bạn chắc chắn muốn tiếp tục?"
        );
        if (!confirmed) {
          return;
        }
      }

      setOverwrite(nextValue);
    },
    [canOverwriteData, confirmOverwrite, setOverwrite]
  );

  return {
    handleOpenColumnConfig,
    handlePageSizeSelectChange,
    handlePageSizeCustomInputChange,
    handleToolbarViewModeChange,
    handleToolbarFreezeColumnsEnabledChange,
    handleToolbarCardGridColumnsChange,
    handleToolbarPageSizeSelect,
    handleToolbarPageSizeCustomInput,
    handleToolbarToggleShowDeletedRows,
    handleOverwriteToggle,
  };
}
