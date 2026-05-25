import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterSavedEdits from "@/components/dataImporter/useDataImporterSavedEdits.js";

const dialogMocks = vi.hoisted(() => ({
  alert: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => dialogMocks,
}));

function createProps(overrides = {}) {
  return {
    isReadOnlyForEdits: false,
    mode: "saved",
    actor: "tester",
    isAdminRole: false,
    rowDiffMap: new Map(),
    reviewLockMessage: "Đang bị khóa rà soát.",
    keyOfRow: vi.fn((row) => row.rowKey),
    ensureLicenseFields: vi.fn((row) => ({ ...row, licenseReady: true })),
    ensureCOFields: vi.fn((row) => ({ ...row, coReady: true })),
    saveDeclRowDiffs: vi.fn(async () => ({
      success: true,
      updated: 1,
      locked: 0,
      missing: 0,
      noChange: 0,
      invalid: 0,
    })),
    updateDeclRowFields: vi.fn(() => ({
      success: true,
      row: { rowKey: "row-1", so_tk: "TK-001", date: "2025-03-01", co_qty: "2" },
    })),
    setHasUnsaved: vi.fn(),
    loadSavedRows: vi.fn(),
    fetchAlerts: vi.fn(),
    setRowSaveStatus: vi.fn(),
    setRawRows: vi.fn(),
    commitRowToBaseline: vi.fn(),
    refreshRowHistory: vi.fn(),
    toast: {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

describe("useDataImporterSavedEdits", () => {
  afterEach(() => {
    vi.clearAllMocks();
    dialogMocks.alert.mockResolvedValue();
  });

  it("saves pending bulk diffs and refreshes saved rows", async () => {
    const props = createProps({
      rowDiffMap: new Map([
        ["row-1", { team: "OPS" }],
        ["row-2", {}],
      ]),
    });

    const { result } = renderHook(() => useDataImporterSavedEdits(props));

    await act(async () => {
      await result.current.handleSaveAll();
    });

    expect(props.saveDeclRowDiffs).toHaveBeenCalledWith(
      [{ key: "row-1", updates: { team: "OPS" } }],
      expect.objectContaining({
        actor: "tester",
        detail: "Lưu chỉnh sửa tờ khai thủ công",
        allowReviewedOverride: false,
      })
    );
    expect(dialogMocks.alert).toHaveBeenCalledWith("Đã cập nhật 1 tờ khai.");
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    expect(props.loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
  });

  it("saves one row diff and merges the normalized row back into state", async () => {
    const props = createProps({
      isAdminRole: true,
      rowDiffMap: new Map([["row-1", { team: "OPS" }]]),
    });

    const { result } = renderHook(() => useDataImporterSavedEdits(props));

    await act(async () => {
      await result.current.handleSaveRowChanges("row-1");
    });

    expect(props.updateDeclRowFields).toHaveBeenCalledWith(
      "row-1",
      { team: "OPS" },
      expect.objectContaining({
        actor: "tester",
        detail: "Cập nhật thủ công (team) qua Import Data",
        allowReviewedOverride: true,
      })
    );

    const startUpdater = props.setRowSaveStatus.mock.calls[0][0];
    expect(typeof startUpdater).toBe("function");
    const startStatus = startUpdater({});
    expect(startStatus).toEqual({
      "row-1": { saving: true, error: "" },
    });

    const finishUpdater = props.setRowSaveStatus.mock.calls[1][0];
    expect(typeof finishUpdater).toBe("function");
    const finishStatus = finishUpdater({});
    expect(finishStatus).toEqual({
      "row-1": { saving: false, error: "" },
    });

    const mergeUpdater = props.setRawRows.mock.calls[0][0];
    expect(typeof mergeUpdater).toBe("function");
    const mergedRows = mergeUpdater([{ rowKey: "row-1", existing: true }]);
    expect(mergedRows).toEqual([
      {
        rowKey: "row-1",
        existing: true,
        so_tk: "TK-001",
        date: "2025-03-01",
        co_qty: "2",
        licenseReady: true,
        coReady: true,
      },
    ]);

    expect(props.commitRowToBaseline).toHaveBeenCalledWith("row-1", {
      rowKey: "row-1",
      so_tk: "TK-001",
      date: "2025-03-01",
      co_qty: "2",
      licenseReady: true,
      coReady: true,
    });
    expect(props.refreshRowHistory).toHaveBeenCalledWith("row-1");
    expect(props.toast.success).toHaveBeenCalledWith("Đã lưu cập nhật cho tờ khai.");
  });

  it("blocks handleSaveAll when isReadOnlyForEdits", async () => {
    const props = createProps({ isReadOnlyForEdits: true });
    const { result } = renderHook(() => useDataImporterSavedEdits(props));

    await act(async () => {
      await result.current.handleSaveAll();
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("không có quyền"),
    );
    expect(props.saveDeclRowDiffs).not.toHaveBeenCalled();
  });

  it("blocks handleSaveAll when mode is source", async () => {
    const props = createProps({ mode: "source" });
    const { result } = renderHook(() => useDataImporterSavedEdits(props));

    await act(async () => {
      await result.current.handleSaveAll();
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("Chỉ có thể"),
    );
    expect(props.saveDeclRowDiffs).not.toHaveBeenCalled();
  });

  it("blocks handleSaveAll when rowDiffMap is empty", async () => {
    const props = createProps({ rowDiffMap: new Map() });
    const { result } = renderHook(() => useDataImporterSavedEdits(props));

    await act(async () => {
      await result.current.handleSaveAll();
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("Không có thay đổi"),
    );
    expect(props.saveDeclRowDiffs).not.toHaveBeenCalled();
  });

  it("shows error toast when saveDeclRowDiffs throws", async () => {
    const rowDiffMap = new Map([["row-1", { team: "OPS" }]]);
    const props = createProps({
      rowDiffMap,
      saveDeclRowDiffs: vi.fn(() => {
        throw new Error("DB error");
      }),
    });
    const { result } = renderHook(() => useDataImporterSavedEdits(props));

    await act(async () => {
      await result.current.handleSaveAll();
    });

    expect(props.toast.error).toHaveBeenCalledWith("DB error");
  });

  it("shows info toast when handleSaveRowChanges has empty diff", async () => {
    const props = createProps({ rowDiffMap: new Map() });
    const { result } = renderHook(() => useDataImporterSavedEdits(props));

    await act(async () => {
      await result.current.handleSaveRowChanges("row-1");
    });

    expect(props.toast.info).toHaveBeenCalled();
    expect(props.updateDeclRowFields).not.toHaveBeenCalled();
  });

  it("shows warning toast when row is review-locked", async () => {
    const rowDiffMap = new Map([["row-1", { team: "OPS" }]]);
    const props = createProps({
      rowDiffMap,
      updateDeclRowFields: vi.fn(() => ({
        success: false,
        reason: "review-locked",
      })),
    });
    const { result } = renderHook(() => useDataImporterSavedEdits(props));

    await act(async () => {
      await result.current.handleSaveRowChanges("row-1");
    });

    expect(props.toast.warning).toHaveBeenCalled();
  });

  it("shows error toast when updateDeclRowFields throws", async () => {
    const rowDiffMap = new Map([["row-1", { team: "OPS" }]]);
    const props = createProps({
      rowDiffMap,
      updateDeclRowFields: vi.fn(() => {
        throw new Error("Network error");
      }),
    });
    const { result } = renderHook(() => useDataImporterSavedEdits(props));

    await act(async () => {
      await result.current.handleSaveRowChanges("row-1");
    });

    expect(props.toast.error).toHaveBeenCalled();
  });
});
