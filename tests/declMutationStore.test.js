import { describe, expect, it, vi } from "vitest";

import { createDeclMutationStore } from "../src/lib/declMutationStore.js";

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

function createHarness({ currentRows = [] } = {}) {
  const state = {
    currentRows: cloneRows(currentRows),
    cache: new Map(),
    auditLogs: [],
    importLogs: [],
    historyEntries: [],
    deletedLogEntries: [],
    patchCalls: [],
  };

  const normalizeStr = vi.fn((value) => (value == null ? "" : String(value).trim()));
  const getDeclRowsRaw = vi.fn(() => state.currentRows);
  const getDeclRowSimpleKey = vi.fn((row) => {
    const soTk = row?.so_tk == null ? "" : String(row.so_tk).trim();
    const nhanh = row?.nhanh == null ? "" : String(row.nhanh).trim();
    return soTk ? `${soTk}_${nhanh}` : "";
  });
  const sanitizePartialDeclUpdates = vi.fn((updates) => {
    if (!updates || typeof updates !== "object") {
      return {};
    }
    const safe = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        safe[key] = value;
      }
    });
    return safe;
  });
  const applyPartialUpdatesToRow = vi.fn((row, updates) => {
    const nextRow = { ...(row || {}) };
    let changed = false;
    Object.entries(updates || {}).forEach(([key, value]) => {
      if (!Object.is(nextRow[key], value)) {
        nextRow[key] = value;
        changed = true;
      }
    });
    return { changed, nextRow };
  });
  const patchDeclRows = vi.fn(async (payload, options) => {
    state.patchCalls.push({ payload, options });
  });
  const applyAgenciesToDeclRows = vi.fn((rows) =>
    cloneRows(rows).map((row) => ({
      ...row,
      agencyApplied: row.mst ? `agency:${row.mst}` : "",
    })),
  );
  const updateCachedItem = vi.fn((key, value) => {
    state.cache.set(key, value);
  });
  const pushAuditLog = vi.fn((entry) => {
    state.auditLogs.push(entry);
  });
  const pushImportLog = vi.fn((entry) => {
    state.importLogs.push(entry);
  });
  const persistAndAnnotateDeclRows = vi.fn((rows) => {
    state.currentRows = cloneRows(rows).map((row) => ({
      ...row,
      agencyApplied: row.mst ? `agency:${row.mst}` : "",
    }));
    return state.currentRows;
  });
  const writeDeclRows = vi.fn((rows) => {
    state.currentRows = cloneRows(rows);
    return state.currentRows;
  });
  const buildDeclHistoryChanges = vi.fn((current, nextRow, changedFields) =>
    (Array.isArray(changedFields) ? changedFields : []).map((field) => ({
      field,
      before: current?.[field],
      after: nextRow?.[field],
    })),
  );
  const appendDeclHistoryEntry = vi.fn((rowKey, entry) => {
    const nextEntry = { id: `hist-${state.historyEntries.length + 1}`, rowKey, ...entry };
    state.historyEntries.push(nextEntry);
    return nextEntry;
  });
  const buildDeletedDeclLogEntryFromRow = vi.fn((row, options) => ({
    key: getDeclRowSimpleKey(row),
    actor: options?.actor,
    type: options?.type,
    timestamp: options?.timestamp,
  }));
  const appendDeletedDeclLogEntries = vi.fn((entries) => {
    state.deletedLogEntries.push(...entries);
  });

  const store = createDeclMutationStore({
    normalizeStr,
    getDeclRowsRaw,
    getDeclRowSimpleKey,
    sanitizePartialDeclUpdates,
    applyPartialUpdatesToRow,
    patchDeclRows,
    applyAgenciesToDeclRows,
    updateCachedItem,
    declKey: "decl_rows_v1",
    pushAuditLog,
    pushImportLog,
    persistAndAnnotateDeclRows,
    writeDeclRows,
    buildDeclHistoryChanges,
    appendDeclHistoryEntry,
    buildDeletedDeclLogEntryFromRow,
    appendDeletedDeclLogEntries,
  });

  return {
    state,
    store,
    spies: {
      appendDeclHistoryEntry,
      appendDeletedDeclLogEntries,
      applyAgenciesToDeclRows,
      applyPartialUpdatesToRow,
      buildDeclHistoryChanges,
      buildDeletedDeclLogEntryFromRow,
      getDeclRowSimpleKey,
      getDeclRowsRaw,
      normalizeStr,
      patchDeclRows,
      persistAndAnnotateDeclRows,
      pushAuditLog,
      pushImportLog,
      sanitizePartialDeclUpdates,
      updateCachedItem,
      writeDeclRows,
    },
  };
}

describe("createDeclMutationStore", () => {
  it("patches declaration diffs, appends history, and refreshes cache", async () => {
    const { state, store, spies } = createHarness({
      currentRows: [
        {
          so_tk: "TK001",
          nhanh: "",
          mst: "0101234567",
          loai_hinh: "A11",
        },
      ],
    });

    const result = await store.saveDeclRowDiffs(
      [{ key: "TK001_", updates: { loai_hinh: "B11" } }],
      { actor: "tester", detail: "Patch thủ công" },
    );

    expect(result).toMatchObject({
      success: true,
      updated: 1,
      locked: 0,
      missing: 0,
    });
    expect(spies.patchDeclRows).toHaveBeenCalledWith(
      [
        {
          key: "TK001_",
          updates: { loai_hinh: "B11" },
          row: expect.objectContaining({
            loai_hinh: "B11",
            agencyApplied: "agency:0101234567",
          }),
        },
      ],
      { actor: "tester", detail: "Patch thủ công" },
    );
    expect(state.historyEntries).toHaveLength(1);
    expect(state.historyEntries[0].changes).toEqual([
      { field: "loai_hinh", before: "A11", after: "B11" },
    ]);
    expect(state.cache.get("decl_rows_v1")).toContain('"loai_hinh":"B11"');
    expect(spies.pushAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "decl.patch",
        actor: "tester",
      }),
    );
  });

  it("blocks partial updates on reviewed rows unless override is allowed", async () => {
    const { state, store, spies } = createHarness({
      currentRows: [
        {
          so_tk: "TK002",
          nhanh: "",
          mst: "0201234567",
          reviewed: true,
          reviewed_at: "2026-04-01T00:00:00Z",
          loai_hinh: "A12",
        },
      ],
    });

    const blocked = await store.updateDeclRowFields(
      "TK002_",
      { loai_hinh: "B12" },
      { actor: "tester" },
    );
    expect(blocked).toEqual({ success: false, reason: "review-locked" });
    expect(state.currentRows[0].loai_hinh).toBe("A12");
    expect(spies.persistAndAnnotateDeclRows).not.toHaveBeenCalled();

    const override = await store.updateDeclRowFields(
      "TK002_",
      { loai_hinh: "B12" },
      { actor: "admin", allowReviewedOverride: true },
    );
    expect(override.success).toBe(true);
    expect(override.row).toMatchObject({
      loai_hinh: "B12",
      agencyApplied: "agency:0201234567",
    });
    expect(state.historyEntries).toHaveLength(1);
  });

  it("soft deletes rows, records deleted-log entries, and reports already deleted keys", async () => {
    const { state, store, spies } = createHarness({
      currentRows: [
        { so_tk: "TK003", nhanh: "", mst: "0301234567" },
        { so_tk: "TK004", nhanh: "", mst: "0401234567", deleted_at: "2026-04-01T00:00:00Z" },
      ],
    });

    const result = await store.softDeleteDeclRows(["TK003_", "TK004_", "TK999_"], { actor: "tester" });

    expect(result).toMatchObject({
      deleted: 1,
      alreadyDeleted: 1,
      missing: 1,
      keys: ["TK003_"],
      alreadyDeletedKeys: ["TK004_"],
      missingKeys: ["TK999_"],
    });
    expect(state.currentRows[0]).toMatchObject({
      deleted_by: "tester",
      agencyApplied: "agency:0301234567",
    });
    expect(state.deletedLogEntries).toEqual([
      expect.objectContaining({ key: "TK003_", actor: "tester", type: "soft" }),
    ]);
    expect(spies.pushImportLog).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "warn", actor: "tester" }),
    );
  });

  it("hard deletes rows and emits error-level import logs", async () => {
    const { state, store, spies } = createHarness({
      currentRows: [
        { so_tk: "TK005", nhanh: "", mst: "0501234567", deleted_at: "2026-04-01T00:00:00Z" },
        { so_tk: "TK006", nhanh: "", mst: "0601234567" },
      ],
    });

    const result = await store.hardDeleteDeclRows(["TK005_"], { actor: "tester" });

    expect(result).toMatchObject({
      removed: 1,
      missing: 0,
      keys: ["TK005_"],
    });
    expect(state.currentRows).toHaveLength(1);
    expect(state.currentRows[0].so_tk).toBe("TK006");
    expect(spies.pushImportLog).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "error", actor: "tester" }),
    );
  });

  it("restores soft-deleted rows and writes an import info log", async () => {
    const { state, store, spies } = createHarness({
      currentRows: [
        {
          so_tk: "TK007",
          nhanh: "",
          mst: "0701234567",
          deleted_at: "2026-04-01T00:00:00Z",
          deleted_by: "seed",
        },
      ],
    });

    const result = await store.restoreDeclRows(["TK007_"], { actor: "tester" });

    expect(result).toMatchObject({
      restored: 1,
      skipped: 0,
      failed: 0,
      restoredKeys: ["TK007_"],
    });
    expect(state.currentRows[0].deleted_at).toBeNull();
    expect(state.currentRows[0].deleted_by).toBeNull();
    expect(spies.pushImportLog).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "info",
        actor: "tester",
      }),
    );
  });

  it("marks and unmarks reviewed metadata via write-through storage", async () => {
    const { state, store, spies } = createHarness({
      currentRows: [
        { so_tk: "TK008", nhanh: "", mst: "0801234567" },
      ],
    });

    const marked = await store.markDeclRowsReviewed(["TK008_"], { actor: "reviewer" });
    expect(marked).toBe(1);
    expect(state.currentRows[0]).toMatchObject({
      reviewed: true,
      reviewed_by: "reviewer",
    });

    const unmarked = await store.unmarkDeclRowsReviewed(["TK008_"], { actor: "reviewer" });
    expect(unmarked).toBe(1);
    expect(state.currentRows[0].reviewed).toBeUndefined();
    expect(state.currentRows[0].reviewed_at).toBeUndefined();
    expect(state.currentRows[0].reviewed_by).toBeUndefined();
    expect(spies.writeDeclRows).toHaveBeenCalledTimes(2);
  });
});
