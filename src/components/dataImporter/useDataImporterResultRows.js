import { useEffect, useMemo, useRef, useState } from "react";

export default function useDataImporterResultRows({
  defaultPageSize = 50,
  serverSearchMaxPageSize = 200,
  shouldUseServerSearch = false,
  normalizedFilters,
  pageResetKey = "",
  page = 1,
  pageSize = defaultPageSize,
  rawRows = [],
  duplicateCounts,
  filterDeclRows,
  fetchWithAuth,
  setPage,
  keyOfRow,
  setSelectedKeys,
  showDeletedRows = false,
}) {
  const [serverSearchState, setServerSearchState] = useState({
    rows: [],
    total: 0,
    page: 1,
    pageSize: defaultPageSize,
    loading: false,
    error: "",
    queryKey: "",
  });

  const serverSearchAbortRef = useRef(null);

  useEffect(() => {
    if (!shouldUseServerSearch) {
      if (serverSearchAbortRef.current) {
        serverSearchAbortRef.current.abort();
        serverSearchAbortRef.current = null;
      }

      setServerSearchState((prev) => {
        if (
          !prev.loading &&
          !prev.error &&
          prev.rows.length === 0 &&
          prev.total === 0 &&
          prev.page === 1 &&
          prev.pageSize === pageSize
        ) {
          return prev;
        }

        return {
          rows: [],
          total: 0,
          page: 1,
          pageSize,
          loading: false,
          error: "",
          queryKey: "",
        };
      });

      return undefined;
    }

    const safePageSize = Math.max(1, Math.min(pageSize, serverSearchMaxPageSize));
    const params = new URLSearchParams();

    if (normalizedFilters?.query) params.set("query", normalizedFilters.query);
    if (normalizedFilters?.mst) params.set("mst", normalizedFilters.mst);
    if (normalizedFilters?.company) params.set("company", normalizedFilters.company);
    if (Array.isArray(normalizedFilters?.statuses) && normalizedFilters.statuses.length) {
      params.set("status", normalizedFilters.statuses.join(","));
    }
    if (normalizedFilters?.range?.from) params.set("from", normalizedFilters.range.from);
    if (normalizedFilters?.range?.to) params.set("to", normalizedFilters.range.to);
    if (normalizedFilters?.noStaff) params.set("noStaff", "1");
    if (normalizedFilters?.noTeam) params.set("noTeam", "1");
    if (normalizedFilters?.duplicate) params.set("duplicate", "1");
    if (normalizedFilters?.includeDeleted) params.set("includeDeleted", "1");
    if (normalizedFilters?.coMode && normalizedFilters.coMode !== "all") {
      params.set("coMode", normalizedFilters.coMode);
    }
    if (
      normalizedFilters?.coMode === "min" &&
      Number.isFinite(Number(normalizedFilters?.coMin))
    ) {
      params.set("coMin", String(Math.max(0, Number(normalizedFilters.coMin))));
    }

    params.set("page", String(Math.max(1, page)));
    params.set("pageSize", String(safePageSize));

    const queryKey = params.toString();

    if (serverSearchAbortRef.current) {
      serverSearchAbortRef.current.abort();
    }

    const controller = new AbortController();
    serverSearchAbortRef.current = controller;

    setServerSearchState((prev) => ({
      ...prev,
      loading: true,
      error: "",
      queryKey,
      pageSize: safePageSize,
    }));

    (async () => {
      try {
        const response = await fetchWithAuth(`/api/v4/declarations/imports/search?${queryKey}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (serverSearchAbortRef.current !== controller) {
          return;
        }

        const resolvedPageSize = Number.isFinite(Number(data?.pageSize))
          ? Math.max(1, Math.min(Number(data.pageSize), serverSearchMaxPageSize))
          : safePageSize;
        const resolvedPage =
          Number.isFinite(Number(data?.page)) && Number(data.page) > 0 ? Number(data.page) : 1;
        const resolvedTotal =
          Number.isFinite(Number(data?.total)) && Number(data.total) > 0 ? Number(data.total) : 0;
        const rows = Array.isArray(data?.rows) ? data.rows : [];

        setServerSearchState({
          rows,
          total: resolvedTotal,
          page: resolvedPage,
          pageSize: resolvedPageSize,
          loading: false,
          error: "",
          queryKey,
        });

        if (resolvedPage !== page) {
          setPage(resolvedPage);
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }

        console.error("Không thể tìm kiếm tờ khai trên máy chủ", error);
        if (serverSearchAbortRef.current === controller) {
          setServerSearchState((prev) => ({
            ...prev,
            loading: false,
            error: error?.message || "Không thể tìm kiếm trên máy chủ",
          }));
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    fetchWithAuth,
    normalizedFilters,
    page,
    pageSize,
    serverSearchMaxPageSize,
    shouldUseServerSearch,
    setPage,
  ]);

  const clientFiltered = useMemo(() => {
    if (shouldUseServerSearch) {
      return [];
    }

    const context =
      normalizedFilters?.duplicate && duplicateCounts
        ? { duplicateCounts }
        : undefined;

    return filterDeclRows(rawRows, normalizedFilters, context);
  }, [duplicateCounts, filterDeclRows, normalizedFilters, rawRows, shouldUseServerSearch]);

  const effectivePageSize = shouldUseServerSearch ? serverSearchState.pageSize || pageSize : pageSize;
  const total = shouldUseServerSearch ? serverSearchState.total : clientFiltered.length;
  const maxPage = Math.max(1, Math.ceil(total / Math.max(1, effectivePageSize)));
  const safePage = Math.min(page, maxPage);
  const pageRows = useMemo(
    () =>
      shouldUseServerSearch
        ? Array.isArray(serverSearchState.rows)
          ? serverSearchState.rows
          : []
        : clientFiltered.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize),
    [clientFiltered, effectivePageSize, safePage, serverSearchState.rows, shouldUseServerSearch]
  );

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage, setPage]);

  useEffect(() => {
    setPage(1);
  }, [pageResetKey, setPage]);

  useEffect(() => {
    if (showDeletedRows) {
      return;
    }

    setSelectedKeys((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) {
        return prev;
      }

      const activeKeys = new Set(
        rawRows
          .filter((row) => row && !row.deleted_at)
          .map((row) => keyOfRow(row))
          .filter(Boolean)
      );
      const next = prev.filter((key) => activeKeys.has(key));
      return next.length === prev.length ? prev : next;
    });
  }, [keyOfRow, rawRows, setSelectedKeys, showDeletedRows]);

  const filteredKeys = useMemo(() => {
    if (shouldUseServerSearch) {
      return Array.from(new Set((pageRows || []).map((row) => keyOfRow(row))));
    }

    return Array.from(new Set(clientFiltered.map((row) => keyOfRow(row))));
  }, [clientFiltered, keyOfRow, pageRows, shouldUseServerSearch]);

  return {
    serverSearchState,
    setServerSearchState,
    clientFiltered,
    total,
    maxPage,
    safePage,
    pageRows,
    filteredKeys,
  };
}
