import { describe, expect, it, vi } from "vitest";

import { createDeclWriteStore } from "../src/lib/declWriteStore.js";

function createHarness({
  currentRows = [],
  mstRows = [],
} = {}) {
  const state = {
    currentRows: [...currentRows],
    mstRows: [...mstRows],
  };

  const normalizeStr = vi.fn((value) => (value == null ? "" : String(value).trim()));
  const normalizeDeclRows = vi.fn((rows) =>
    Array.isArray(rows)
      ? rows
          .filter(Boolean)
          .map((row) => ({
            ...row,
            nhanh: row.nhanh ?? row.branch ?? "",
          }))
      : [],
  );
  const getDeclRowsRaw = vi.fn(() => state.currentRows);
  const getDeclarationKey = vi.fn((row) => {
    const soTk = row?.so_tk == null ? "" : String(row.so_tk).trim();
    const nhanh = row?.nhanh == null ? "" : String(row.nhanh).trim();
    return soTk ? `${soTk}_${nhanh}` : "";
  });
  const extractMSTFromDeclRow = vi.fn((row) => (row?.mst == null ? "" : String(row.mst).trim()));
  const extractCompanyNameFromDeclRow = vi.fn((row) =>
    row?.company == null ? "" : String(row.company).trim(),
  );
  const extractEffectiveDateFromDeclRow = vi.fn((row) =>
    row?.date == null ? "" : String(row.date).trim(),
  );
  const getMSTMap = vi.fn(() => state.mstRows);
  const upsertMSTRows = vi.fn((rows) => {
    state.mstRows = rows.map((row) => ({ ...row }));
  });
  const persistAndAnnotateDeclRows = vi.fn((rows) => {
    state.currentRows = rows.map((row) => ({ ...row }));
    return state.currentRows;
  });
  const pushAuditLog = vi.fn(() => {});
  const normalizeDeclarationNumber = vi.fn((value) =>
    value == null ? "" : String(value).trim(),
  );
  const mergeDeclarationRowClient = vi.fn((existing, incoming) => {
    const { __forceReviewedOverride: _force, ...safeIncoming } = incoming || {};
    return {
      ...(existing || {}),
      ...safeIncoming,
    };
  });

  const store = createDeclWriteStore({
    normalizeStr,
    normalizeDeclRows,
    getDeclRowsRaw,
    getDeclarationKey,
    extractMSTFromDeclRow,
    extractCompanyNameFromDeclRow,
    extractEffectiveDateFromDeclRow,
    getMSTMap,
    upsertMSTRows,
    mstAssignmentStatusPending: "pending",
    persistAndAnnotateDeclRows,
    pushAuditLog,
    normalizeDeclarationNumber,
    mergeDeclarationRowClient,
  });

  return {
    state,
    store,
    spies: {
      extractCompanyNameFromDeclRow,
      extractEffectiveDateFromDeclRow,
      extractMSTFromDeclRow,
      getDeclRowsRaw,
      getDeclarationKey,
      getMSTMap,
      mergeDeclarationRowClient,
      normalizeDeclRows,
      normalizeDeclarationNumber,
      normalizeStr,
      persistAndAnnotateDeclRows,
      pushAuditLog,
      upsertMSTRows,
    },
  };
}

describe("createDeclWriteStore", () => {
  it("previews merge diffs and MST additions without mutating storage", () => {
    const { state, store, spies } = createHarness({
      currentRows: [
        {
          so_tk: "TK001",
          nhanh: "",
          date: "2024-01-01",
          mst: "0101234567",
          company: "ACME",
        },
      ],
      mstRows: [{ mst: "0101234567" }],
    });

    const preview = store.previewDeclRows(
      [
        { so_tk: "TK001", nhanh: "", date: "2024-01-05", mst: "0101234567", company: "ACME" },
        { so_tk: "TK002", nhanh: "A", date: "2024-01-06", mst: "0207654321", company: "Beta" },
        { nhanh: "", date: "2024-01-07", mst: "0999999999", company: "Thiếu số" },
      ],
      { overwrite: false, actor: "tester" },
    );

    expect(preview).toMatchObject({
      mode: "merge",
      inserted: 1,
      updated: 1,
      invalid: 1,
      newBusinessCount: 1,
    });
    expect(preview.errors[0]).toMatchObject({ reason: "missing-key" });
    expect(preview.newBusinesses[0]).toMatchObject({
      mst: "0207654321",
      company: "Beta",
      effective_from: "2024-01-06",
    });
    expect(state.currentRows).toEqual([
      {
        so_tk: "TK001",
        nhanh: "",
        date: "2024-01-01",
        mst: "0101234567",
        company: "ACME",
      },
    ]);
    expect(spies.persistAndAnnotateDeclRows).not.toHaveBeenCalled();
    expect(spies.upsertMSTRows).not.toHaveBeenCalled();
  });

  it("saves overwrite payloads, appends MST additions, and emits overwrite audit", async () => {
    const { state, store, spies } = createHarness({
      currentRows: [{ so_tk: "OLD", nhanh: "", date: "2024-01-01", mst: "0100000000" }],
      mstRows: [{ mst: "0100000000" }],
    });

    const result = await store.saveDeclRows(
      [
        { so_tk: "TK010", nhanh: "", date: "2024-02-01", mst: "0123456789", company: "Doanh nghiệp A" },
      ],
      { overwrite: true, actor: "tester" },
    );

    expect(result).toMatchObject({
      mode: "overwrite",
      totalBefore: 1,
      totalAfter: 1,
      inserted: 1,
      newBusinessCount: 1,
    });
    expect(state.currentRows).toEqual([
      {
        so_tk: "TK010",
        nhanh: "",
        date: "2024-02-01",
        mst: "0123456789",
        company: "Doanh nghiệp A",
      },
    ]);
    expect(state.mstRows).toEqual([
      { mst: "0100000000" },
      expect.objectContaining({
        mst: "0123456789",
        company: "Doanh nghiệp A",
        effective_from: "2024-02-01",
        status: "pending",
      }),
    ]);
    expect(spies.pushAuditLog).toHaveBeenCalledWith({
      actor: "tester",
      action: "decl.overwrite",
      detail: "Ghi đè 1 tờ khai",
    });
  });

  it("keeps reviewed rows locked unless override is explicitly enabled", async () => {
    const harness = createHarness({
      currentRows: [
        {
          so_tk: "TK777",
          nhanh: "",
          date: "2025-02-01",
          mst: "0777777777",
          company: "Reviewed Co",
          loai_hinh: "A11",
          reviewed: true,
        },
      ],
    });

    const lockedResult = await harness.store.saveDeclRows(
      [
        {
          so_tk: "TK777",
          nhanh: "",
          date: "2025-02-01",
          mst: "0777777777",
          company: "Reviewed Co",
          loai_hinh: "B33",
        },
      ],
      { overwrite: false, actor: "tester" },
    );

    expect(lockedResult.locked).toBe(1);
    expect(harness.state.currentRows[0].loai_hinh).toBe("A11");

    const overrideResult = await harness.store.saveDeclRows(
      [
        {
          so_tk: "TK777",
          nhanh: "",
          date: "2025-02-01",
          mst: "0777777777",
          company: "Reviewed Co",
          loai_hinh: "B33",
        },
      ],
      { overwrite: false, actor: "tester", allowReviewedOverride: true },
    );

    expect(overrideResult.locked).toBe(0);
    expect(overrideResult.updated).toBe(1);
    expect(harness.state.currentRows[0].loai_hinh).toBe("B33");
  });
});
