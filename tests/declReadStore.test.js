import { describe, expect, it, vi } from "vitest";

import { createDeclReadStore } from "../src/lib/declReadStore.js";

function createHarness({
  storedValue = null,
  normalizedRows = [],
  annotatedRows = null,
} = {}) {
  const state = { value: storedValue };
  const getItem = vi.fn(() => state.value);
  const setItem = vi.fn((_key, value) => {
    state.value = value;
  });
  const refreshSharedKeys = vi.fn(async () => {});
  const safeParse = vi.fn((json, fallback) => {
    if (!json) return fallback;
    return JSON.parse(json);
  });
  const normalizeDeclRows = vi.fn(() => normalizedRows);
  const applyAgenciesToDeclRows = vi.fn((rows) => annotatedRows ?? rows);

  const store = createDeclReadStore({
    getItem,
    setItem,
    refreshSharedKeys,
    safeParse,
    normalizeDeclRows,
    applyAgenciesToDeclRows,
    declKey: "decl_rows_v1",
  });

  return {
    state,
    store,
    spies: {
      applyAgenciesToDeclRows,
      getItem,
      normalizeDeclRows,
      refreshSharedKeys,
      safeParse,
      setItem,
    },
  };
}

describe("createDeclReadStore", () => {
  it("normalizes persisted rows and backfills sanitized storage", () => {
    const storedValue = JSON.stringify([{ raw: true }]);
    const normalizedRows = [{ so_tk: "00000000001", nhanh: "A" }];
    const { store, spies, state } = createHarness({ storedValue, normalizedRows });

    expect(store.getDeclRowsRaw()).toEqual(normalizedRows);
    expect(spies.getItem).toHaveBeenCalledWith("decl_rows_v1");
    expect(spies.safeParse).toHaveBeenCalledWith(storedValue, []);
    expect(spies.normalizeDeclRows).toHaveBeenCalledWith([{ raw: true }]);
    expect(spies.setItem).toHaveBeenCalledWith("decl_rows_v1", JSON.stringify(normalizedRows));
    expect(state.value).toBe(JSON.stringify(normalizedRows));
  });

  it("does not rewrite storage when normalized payload is unchanged", () => {
    const normalizedRows = [{ so_tk: "00000000002", nhanh: "" }];
    const storedValue = JSON.stringify(normalizedRows);
    const { store, spies } = createHarness({ storedValue, normalizedRows });

    expect(store.getDeclRowsRaw()).toEqual(normalizedRows);
    expect(spies.setItem).not.toHaveBeenCalled();
  });

  it("applies agency annotations to declaration reads and compat getData", () => {
    const normalizedRows = [{ so_tk: "00000000003", agency: "" }];
    const annotatedRows = [{ so_tk: "00000000003", agency: "DLHQ" }];
    const { store, spies } = createHarness({ normalizedRows, annotatedRows });

    expect(store.getDeclRows()).toEqual(annotatedRows);
    expect(store.getData()).toEqual(annotatedRows);
    expect(spies.applyAgenciesToDeclRows).toHaveBeenCalledTimes(2);
    expect(spies.applyAgenciesToDeclRows).toHaveBeenNthCalledWith(1, normalizedRows);
    expect(spies.applyAgenciesToDeclRows).toHaveBeenNthCalledWith(2, normalizedRows);
  });

  it("refreshes shared storage before returning annotated rows", async () => {
    const normalizedRows = [{ so_tk: "00000000004", agency: "" }];
    const annotatedRows = [{ so_tk: "00000000004", agency: "A1" }];
    const { store, spies } = createHarness({ normalizedRows, annotatedRows });

    await expect(
      store.refreshDeclRowsFromServer({ actor: "tester" }),
    ).resolves.toEqual(annotatedRows);

    expect(spies.refreshSharedKeys).toHaveBeenCalledWith(["decl_rows_v1"], {
      actor: "tester",
    });
    expect(spies.applyAgenciesToDeclRows).toHaveBeenCalledWith(normalizedRows);
  });

  it("sorts rows by date desc, then declaration number, branch, and insertion order", () => {
    const { store } = createHarness();
    const rows = [
      { so_tk: "050", nhanh: "B", date: "2024-01-05" },
      { so_tk: "200", nhanh: "A", date: "2024-01-05" },
      { so_tk: "150", nhanh: "C", date: "2024-01-10" },
      { so_tk: "999", nhanh: "A", date: "" },
      { so_tk: "999", nhanh: "A", date: "" },
    ];

    const sorted = store.sortDeclRows(rows);

    expect(sorted.map((row) => `${row.so_tk}:${row.nhanh}`)).toEqual([
      "150:C",
      "200:A",
      "050:B",
      "999:A",
      "999:A",
    ]);
    expect(sorted[3]).toBe(rows[4]);
    expect(sorted[4]).toBe(rows[3]);
  });

  it("returns recent rows with the requested limit and falls back for invalid limits", () => {
    const annotatedRows = [
      { so_tk: "TK01", nhanh: "A", date: "2024-08-01" },
      { so_tk: "TK02", nhanh: "B", date: "2024-08-15" },
      { so_tk: "TK03", nhanh: "A", date: "2024-09-01" },
      { so_tk: "TK04", nhanh: "B", date: "2024-09-10" },
    ];
    const { store } = createHarness({
      normalizedRows: annotatedRows,
      annotatedRows,
    });

    expect(store.getRecentDeclRows(3).map((row) => row.so_tk)).toEqual([
      "TK04",
      "TK03",
      "TK02",
    ]);
    expect(store.getRecentDeclRows(0).map((row) => row.so_tk)).toEqual([
      "TK04",
      "TK03",
      "TK02",
      "TK01",
    ]);
  });
});
