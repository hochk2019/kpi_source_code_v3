import { useCallback, useEffect, useMemo, useState } from 'react';



/**

 * Hook quản lý phân trang với các bảng dữ liệu lớn.

 * @param {any[]} items

 * @param {{ initialPage?: number, initialPageSize?: number, minPageSize?: number }} [options]

 */

export default function usePagination(items = [], options = {}) {

  const { initialPage = 1, initialPageSize = 20, minPageSize = 1 } = options;

  const safeItems = Array.isArray(items) ? items : [];



  const [pageSize, setPageSizeState] = useState(() =>

    Math.max(minPageSize, Number.isFinite(initialPageSize) ? Math.trunc(initialPageSize) : 20)

  );

  const [page, setPageState] = useState(() => Math.max(1, Math.trunc(initialPage)));



  const itemCount = safeItems.length;

  const pageCount = useMemo(() => Math.max(1, Math.ceil(itemCount / pageSize)), [itemCount, pageSize]);



  const clampPage = useCallback(

    (value) => {

      const numeric = Number(value);

      if (!Number.isFinite(numeric)) return 1;

      const normalized = Math.trunc(numeric);

      if (normalized <= 1) return 1;

      if (normalized >= pageCount) return pageCount;

      return normalized;

    },

    [pageCount]

  );



  useEffect(() => {

    setPageState((prev) => clampPage(prev));

  }, [clampPage]);



  const setPage = useCallback(

    (value) => {

      if (typeof value === 'function') {

        setPageState((prev) => clampPage(value(prev)));

      } else {

        setPageState(clampPage(value));

      }

    },

    [clampPage]

  );



  const setPageSize = useCallback(

    (value) => {

      const numeric = Number(value);

      const normalized = Number.isFinite(numeric) ? Math.max(minPageSize, Math.trunc(numeric)) : pageSize;

      setPageSizeState((prev) => (prev === normalized ? prev : normalized));

      setPageState(1);

    },

    [minPageSize, pageSize]

  );



  const currentPageItems = useMemo(() => {

    if (!safeItems.length) return [];

    const safePage = clampPage(page);

    const start = (safePage - 1) * pageSize;

    return safeItems.slice(start, start + pageSize);

  }, [safeItems, page, pageSize, clampPage]);



  const nextPage = useCallback(() => {

    setPage((prev) => Math.min(prev + 1, pageCount));

  }, [setPage, pageCount]);



  const previousPage = useCallback(() => {

    setPage((prev) => Math.max(prev - 1, 1));

  }, [setPage]);



  return {

    page,

    pageSize,

    pageCount,

    totalItems: itemCount,

    currentPageItems,

    setPage,

    setPageSize,

    nextPage,

    previousPage,

  };

}

