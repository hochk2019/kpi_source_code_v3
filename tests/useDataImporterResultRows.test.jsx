import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import useDataImporterResultRows from "@/components/dataImporter/useDataImporterResultRows.js";

function createRow(index, overrides = {}) {
  return {
    rowKey: `row-${index}`,
    deleted_at: "",
    ...overrides,
  };
}

function createProps(overrides = {}) {
  return {
    defaultPageSize: 50,
    serverSearchMaxPageSize: 200,
    shouldUseServerSearch: false,
    normalizedFilters: {
      query: "",
      mst: "",
      company: "",
      statuses: [],
      range: { from: "", to: "" },
      noStaff: false,
      noTeam: false,
      duplicate: false,
      includeDeleted: false,
      coMode: "all",
      coMin: 0,
    },
    pageResetKey: "base",
    page: 1,
    pageSize: 2,
    rawRows: [],
    duplicateCounts: new Map(),
    filterDeclRows: vi.fn((rows) => rows),
    fetchWithAuth: vi.fn(),
    setPage: vi.fn(),
    keyOfRow: vi.fn((row) => row.rowKey),
    setSelectedKeys: vi.fn(),
    showDeletedRows: false,
    ...overrides,
  };
}

describe("useDataImporterResultRows", () => {
  it("builds client-side page rows and prunes deleted selections when deleted rows are hidden", () => {
    const rows = [
      createRow(1),
      createRow(2, { deleted_at: "2026-03-10T10:00:00.000Z" }),
      createRow(3),
    ];
    const props = createProps({
      rawRows: rows,
      filterDeclRows: vi.fn(() => rows),
    });

    const { result } = renderHook(() => useDataImporterResultRows(props));

    expect(result.current.pageRows).toEqual(rows.slice(0, 2));
    expect(result.current.filteredKeys).toEqual(["row-1", "row-2", "row-3"]);
    expect(result.current.total).toBe(3);
    expect(result.current.safePage).toBe(1);
    expect(result.current.maxPage).toBe(2);

    expect(props.setSelectedKeys).toHaveBeenCalledTimes(1);
    const nextSelection = props.setSelectedKeys.mock.calls[0][0](["row-1", "row-2", "missing"]);
    expect(nextSelection).toEqual(["row-1"]);
  });

  it("fetches server-search rows and exposes returned paging state", async () => {
    const rows = [createRow(11, { rowKey: "server-1" }), createRow(12, { rowKey: "server-2" })];
    const fetchWithAuth = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rows,
        total: 2,
        page: 2,
        pageSize: 25,
      }),
    }));
    const props = createProps({
      shouldUseServerSearch: true,
      page: 1,
      fetchWithAuth,
      normalizedFilters: {
        query: "abc",
        mst: "0101",
        company: "Cong ty",
        statuses: ["reviewed", "warning"],
        range: { from: "2026-01-01", to: "2026-01-31" },
        noStaff: true,
        noTeam: true,
        duplicate: true,
        includeDeleted: true,
        coMode: "min",
        coMin: 5,
      },
    });

    const { result } = renderHook(() => useDataImporterResultRows(props));

    await waitFor(() => {
      expect(result.current.serverSearchState.loading).toBe(false);
      expect(result.current.serverSearchState.total).toBe(2);
    });

    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    const [requestUrl, requestOptions] = fetchWithAuth.mock.calls[0];
    expect(requestUrl).toContain("/api/v4/declarations/imports/search?");
    expect(requestUrl).toContain("query=abc");
    expect(requestUrl).toContain("mst=0101");
    expect(requestUrl).toContain("company=Cong+ty");
    expect(requestUrl).toContain("status=reviewed%2Cwarning");
    expect(requestUrl).toContain("from=2026-01-01");
    expect(requestUrl).toContain("to=2026-01-31");
    expect(requestUrl).toContain("noStaff=1");
    expect(requestUrl).toContain("noTeam=1");
    expect(requestUrl).toContain("duplicate=1");
    expect(requestUrl).toContain("includeDeleted=1");
    expect(requestUrl).toContain("coMode=min");
    expect(requestUrl).toContain("coMin=5");
    expect(requestUrl).toContain("page=1");
    expect(requestUrl).toContain("pageSize=2");
    expect(requestOptions).toEqual(
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );

    expect(result.current.pageRows).toEqual(rows);
    expect(result.current.filteredKeys).toEqual(["server-1", "server-2"]);
    expect(result.current.total).toBe(2);
    expect(result.current.safePage).toBe(1);
    expect(result.current.maxPage).toBe(1);
    expect(props.setPage).toHaveBeenCalledWith(2);
  });

  it("adopts a server-clamped page when the requested page is out of range", async () => {
    const rows = [createRow(21, { rowKey: "server-last" })];
    const fetchWithAuth = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rows,
        total: 1,
        page: 1,
        pageSize: 1,
      }),
    }));
    const props = createProps({
      shouldUseServerSearch: true,
      page: 4,
      pageSize: 1,
      fetchWithAuth,
      normalizedFilters: {
        query: "clamped",
        mst: "",
        company: "",
        statuses: [],
        range: { from: "", to: "" },
        noStaff: false,
        noTeam: false,
        duplicate: false,
        includeDeleted: false,
        coMode: "all",
        coMin: 0,
      },
    });

    const { result } = renderHook(() => useDataImporterResultRows(props));

    await waitFor(() => {
      expect(result.current.serverSearchState.loading).toBe(false);
      expect(result.current.serverSearchState.page).toBe(1);
    });

    const [requestUrl] = fetchWithAuth.mock.calls[0];
    expect(requestUrl).toContain("query=clamped");
    expect(requestUrl).toContain("page=4");
    expect(requestUrl).toContain("pageSize=1");
    expect(result.current.pageRows).toEqual(rows);
    expect(result.current.total).toBe(1);
    expect(props.setPage).toHaveBeenCalledWith(1);
  });

  it("resets to page one when the page reset key changes", () => {
    const rows = [createRow(1), createRow(2), createRow(3), createRow(4)];
    const props = createProps({
      rawRows: rows,
      filterDeclRows: vi.fn(() => rows),
      page: 1,
      pageSize: 1,
      pageResetKey: "initial",
    });

    const { rerender } = renderHook((nextProps) => useDataImporterResultRows(nextProps), {
      initialProps: props,
    });

    props.setPage.mockClear();

    rerender({
      ...props,
      page: 4,
      pageResetKey: "changed",
    });

    expect(props.setPage).toHaveBeenCalledWith(1);
  });
});
