import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildDeletedEntries,
  buildDeletedRangeLabel,
} from "@/components/dataImporter/dataImporterDeletedEntries.js";

export default function useDataImporterDeletedRows({
  searchRange,
  softDeletedRows = [],
  baseFilterInputs = null,
  fetchWithAuth,
  extractErrorMessage,
  filterDeclRows = (rows) => rows,
  keyOfRow = (row) => row?.id ?? "",
  formatDateTime = (value) => `${value ?? ""}`,
  formatDisplayDate = (value) => `${value ?? ""}`,
  formatDateRangeLabel = () => "",
}) {
  const [deletedDialogOpen, setDeletedDialogOpen] = useState(false);
  const [hardDeletedRows, setHardDeletedRows] = useState([]);
  const [hardDeletedLoading, setHardDeletedLoading] = useState(false);
  const [hardDeletedError, setHardDeletedError] = useState("");
  const [hardDeletedRangeKey, setHardDeletedRangeKey] = useState(null);
  const hardDeletedAbortRef = useRef(null);

  const fetchHardDeletedRows = useCallback(
    async ({ from, to, rangeKey }) => {
      if (hardDeletedAbortRef.current) {
        hardDeletedAbortRef.current.abort();
      }

      const controller = new AbortController();
      hardDeletedAbortRef.current = controller;
      setHardDeletedLoading(true);
      setHardDeletedError("");

      try {
        const params = new URLSearchParams();
        params.set("type", "hard");
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const queryString = params.toString();
        const target = `/api/import/deleted-declarations${queryString ? `?${queryString}` : ""}`;

        const response = await fetchWithAuth(target, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await extractErrorMessage(
            response,
            "Không thể tải danh sách tờ khai đã xóa vĩnh viễn."
          );
          throw new Error(message);
        }

        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        const rows = Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        setHardDeletedRows(rows);
        setHardDeletedRangeKey(rangeKey);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Không thể tải danh sách tờ khai đã xóa vĩnh viễn", error);
        setHardDeletedError(error?.message || "Không thể tải danh sách tờ khai đã xóa vĩnh viễn.");
        setHardDeletedRows([]);
        setHardDeletedRangeKey(rangeKey);
      } finally {
        if (hardDeletedAbortRef.current === controller) {
          hardDeletedAbortRef.current = null;
        }
        setHardDeletedLoading(false);
      }
    },
    [extractErrorMessage, fetchWithAuth]
  );

  useEffect(() => {
    if (!deletedDialogOpen) {
      return;
    }

    const rangeKey = `${searchRange.from || ""}|${searchRange.to || ""}`;
    if (rangeKey === hardDeletedRangeKey && (hardDeletedRows.length > 0 || hardDeletedError)) {
      return;
    }

    fetchHardDeletedRows({
      from: searchRange.from || "",
      to: searchRange.to || "",
      rangeKey,
    });
  }, [
    deletedDialogOpen,
    fetchHardDeletedRows,
    hardDeletedError,
    hardDeletedRangeKey,
    hardDeletedRows.length,
    searchRange.from,
    searchRange.to,
  ]);

  useEffect(
    () => () => {
      if (hardDeletedAbortRef.current) {
        hardDeletedAbortRef.current.abort();
      }
    },
    []
  );

  const handleDeletedDialogOpenChange = useCallback((nextOpen) => {
    if (!nextOpen && hardDeletedAbortRef.current) {
      hardDeletedAbortRef.current.abort();
      hardDeletedAbortRef.current = null;
      setHardDeletedLoading(false);
    }
    setDeletedDialogOpen(nextOpen);
  }, []);

  const openDeletedDialog = useCallback(() => {
    setDeletedDialogOpen(true);
  }, []);

  const handleHardDeletedRetry = useCallback(async () => {
    if (hardDeletedLoading) {
      return;
    }

    const rangeKey = `${searchRange.from || ""}|${searchRange.to || ""}`;
    await fetchHardDeletedRows({
      from: searchRange.from || "",
      to: searchRange.to || "",
      rangeKey,
    });
  }, [fetchHardDeletedRows, hardDeletedLoading, searchRange.from, searchRange.to]);

  const filteredHardDeletedRows = useMemo(() => {
    if (!Array.isArray(hardDeletedRows) || hardDeletedRows.length === 0) {
      return [];
    }

    const filtered = filterDeclRows(hardDeletedRows, {
      ...(baseFilterInputs || {}),
      includeDeleted: true,
    });

    return filtered.filter(
      (row) => row && (row.deleted_at || row.deletedAt || row.deleted_at_tm || row.deletedAtTm)
    );
  }, [baseFilterInputs, filterDeclRows, hardDeletedRows]);

  const deletedEntries = useMemo(
    () =>
      buildDeletedEntries({
        softDeletedRows,
        hardDeletedRows: filteredHardDeletedRows,
        keyOfRow,
        formatDateTime,
        formatDisplayDate,
      }),
    [filteredHardDeletedRows, formatDateTime, formatDisplayDate, keyOfRow, softDeletedRows]
  );

  const softDeletedCount = softDeletedRows.length;
  const hardDeletedCount = filteredHardDeletedRows.length;
  const deletedTotalCount = deletedEntries.length;

  const deletedRangeLabel = useMemo(
    () =>
      buildDeletedRangeLabel(
        { from: searchRange.from, to: searchRange.to },
        { formatDateRangeLabel }
      ),
    [formatDateRangeLabel, searchRange.from, searchRange.to]
  );

  return {
    deletedDialogOpen,
    hardDeletedRows,
    hardDeletedLoading,
    hardDeletedError,
    filteredHardDeletedRows,
    deletedEntries,
    softDeletedCount,
    hardDeletedCount,
    deletedTotalCount,
    deletedRangeLabel,
    openDeletedDialog,
    handleDeletedDialogOpenChange,
    handleHardDeletedRetry,
  };
}
