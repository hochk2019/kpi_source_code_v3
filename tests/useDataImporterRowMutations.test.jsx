import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import useDataImporterRowMutations from "@/components/dataImporter/useDataImporterRowMutations.js";

const dialogMocks = vi.hoisted(() => ({
  alert: vi.fn(() => Promise.resolve()),
  confirm: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => dialogMocks,
}));

function createProps(overrides = {}) {
  return {
    actor: "tester",
    mode: "saved",
    isReadOnlyForEdits: false,
    selectedKeys: [],
    editingRestrictionMessage: "Bạn không được sửa dữ liệu này.",
    reviewLockMessage: "Đang bị khóa rà soát.",
    ensureEditableKeys: vi.fn((keys) => keys),
    ensureHardDeleteKeys: vi.fn((keys) => keys),
    filterEditableKeys: vi.fn(() => ({
      allowed: [],
      blocked: 0,
      reviewLocked: 0,
      reviewLockedKeys: [],
    })),
    filterHardDeleteKeys: vi.fn(() => ({
      allowed: [],
      blocked: 0,
      reviewLocked: 0,
      reviewLockedKeys: [],
    })),
    isRowEditable: vi.fn(() => true),
    keyOfRow: vi.fn((row) => row.rowKey),
    softDeleteDeclRows: vi.fn(() => ({
      deleted: 2,
      alreadyDeleted: 0,
      missing: 0,
    })),
    hardDeleteDeclRows: vi.fn(() => ({
      removed: 2,
      missing: 0,
      keys: ["row-1", "row-3"],
    })),
    restoreDeclRows: vi.fn(() => ({
      restored: 1,
      skipped: 0,
      failedKeys: [],
    })),
    pushAuditLog: vi.fn(),
    setHasUnsaved: vi.fn(),
    setSelectedKeys: vi.fn(),
    loadSavedRows: vi.fn(),
    fetchAlerts: vi.fn(),
    ...overrides,
  };
}

describe("useDataImporterRowMutations", () => {
  afterEach(() => {
    vi.clearAllMocks();
    dialogMocks.alert.mockResolvedValue();
    dialogMocks.confirm.mockResolvedValue(true);
  });

  it("soft deletes selected rows and refreshes saved state", async () => {
    const props = createProps({
      selectedKeys: ["row-1", "row-2"],
    });

    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSelected();
    });

    expect(props.ensureEditableKeys).toHaveBeenCalledWith(["row-1", "row-2"], "đánh dấu xóa");
    await waitFor(() => {
      expect(props.softDeleteDeclRows).toHaveBeenCalledWith(["row-1", "row-2"], {
        actor: "tester",
      });
    });
    expect(dialogMocks.alert).toHaveBeenCalledWith("Đã đánh dấu xóa 2 tờ khai.");
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    expect(props.loadSavedRows).toHaveBeenCalledTimes(1);
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
  });

  it("hard deletes selected rows and prunes removed keys from selection", async () => {
    const props = createProps({
      selectedKeys: ["row-1", "row-2", "row-3"],
    });

    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleHardDeleteSelected();
    });

    expect(props.ensureHardDeleteKeys).toHaveBeenCalledWith(
      ["row-1", "row-2", "row-3"],
      "xóa vĩnh viễn"
    );
    await waitFor(() => {
      expect(props.hardDeleteDeclRows).toHaveBeenCalledWith(["row-1", "row-2", "row-3"], {
        actor: "tester",
      });
    });
    expect(dialogMocks.alert).toHaveBeenCalledWith("Đã xóa vĩnh viễn 2 tờ khai.");
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    const updater = props.setSelectedKeys.mock.calls[0][0];
    expect(typeof updater).toBe("function");
    const nextSelection = updater(["row-1", "row-2", "row-3"]);
    expect(nextSelection).toEqual(["row-2"]);
    expect(props.loadSavedRows).toHaveBeenCalledTimes(1);
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
  });

  it("restores one soft-deleted row and reloads alerts", async () => {
    const props = createProps();

    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleRestoreSingle({ rowKey: "row-9" });
    });

    expect(props.restoreDeclRows).toHaveBeenCalledWith(["row-9"], {
      actor: "tester",
      detail: "Khôi phục tờ khai bị xóa mềm từ giao diện Import Data",
    });
    expect(dialogMocks.alert).toHaveBeenCalledWith("Đã khôi phục 1 tờ khai.");
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    expect(props.loadSavedRows).toHaveBeenCalledTimes(1);
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
  });

  it("does not soft-delete when user declines confirmation", async () => {
    dialogMocks.confirm.mockResolvedValue(false);
    const props = createProps({ selectedKeys: ["row-1"] });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSelected();
    });

    expect(props.softDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("does not hard-delete when user declines confirmation", async () => {
    dialogMocks.confirm.mockResolvedValue(false);
    const props = createProps({ selectedKeys: ["row-1"] });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleHardDeleteSelected();
    });

    expect(props.hardDeleteDeclRows).not.toHaveBeenCalled();
  });

  // --- Guard condition tests ---

  it("blocks handleDeleteSelected when isReadOnlyForEdits=true", async () => {
    const props = createProps({ isReadOnlyForEdits: true, selectedKeys: ["row-1"] });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSelected();
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("không có quyền")
    );
    expect(props.softDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleDeleteSelected when mode is not saved", async () => {
    const props = createProps({ mode: "source", selectedKeys: ["row-1"] });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSelected();
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("Chỉ có thể")
    );
    expect(props.softDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleDeleteSelected when selectedKeys is empty", async () => {
    const props = createProps({ selectedKeys: [] });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSelected();
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("Chưa chọn")
    );
    expect(props.softDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleHardDeleteSelected when isReadOnlyForEdits=true", async () => {
    const props = createProps({ isReadOnlyForEdits: true, selectedKeys: ["row-1"] });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleHardDeleteSelected();
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("không có quyền")
    );
    expect(props.hardDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleHardDeleteSelected when mode is not saved", async () => {
    const props = createProps({ mode: "source", selectedKeys: ["row-1"] });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleHardDeleteSelected();
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("Chỉ có thể")
    );
    expect(props.hardDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleHardDeleteSelected when selectedKeys is empty", async () => {
    const props = createProps({ selectedKeys: [] });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleHardDeleteSelected();
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("Chưa chọn")
    );
    expect(props.hardDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("soft-deletes a single row via handleDeleteSingle", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSingle({ rowKey: "row-1" });
    });

    expect(props.softDeleteDeclRows).toHaveBeenCalledWith(["row-1"], { actor: "tester" });
  });

  it("blocks handleDeleteSingle when isReadOnlyForEdits=true", async () => {
    const props = createProps({ isReadOnlyForEdits: true });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSingle({ rowKey: "row-1" });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("không có quyền")
    );
    expect(props.softDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleDeleteSingle when mode is not saved", async () => {
    const props = createProps({ mode: "source" });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSingle({ rowKey: "row-1" });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("Chỉ có thể")
    );
    expect(props.softDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleDeleteSingle when isRowEditable returns false", async () => {
    const props = createProps({ isRowEditable: vi.fn(() => false) });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSingle({ rowKey: "row-1" });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(props.editingRestrictionMessage);
    expect(props.softDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleDeleteSingle with reviewLockMessage when row is reviewed", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleDeleteSingle({ rowKey: "row-1", reviewed: true });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith("Đang bị khóa rà soát.");
    expect(props.softDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("hard-deletes a single row via handleHardDeleteSingle", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleHardDeleteSingle({ rowKey: "row-1" });
    });

    expect(props.hardDeleteDeclRows).toHaveBeenCalledWith(["row-1"], { actor: "tester" });
  });

  it("blocks handleHardDeleteSingle when isReadOnlyForEdits=true", async () => {
    const props = createProps({ isReadOnlyForEdits: true });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleHardDeleteSingle({ rowKey: "row-1" });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("không có quyền")
    );
    expect(props.hardDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleHardDeleteSingle when mode is not saved", async () => {
    const props = createProps({ mode: "source" });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleHardDeleteSingle({ rowKey: "row-1" });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("Chỉ có thể")
    );
    expect(props.hardDeleteDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleRestoreSingle when isReadOnlyForEdits=true", async () => {
    const props = createProps({ isReadOnlyForEdits: true });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleRestoreSingle({ rowKey: "row-1" });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("không có quyền")
    );
    expect(props.restoreDeclRows).not.toHaveBeenCalled();
  });

  it("blocks handleRestoreSingle when mode is not saved", async () => {
    const props = createProps({ mode: "source" });
    const { result } = renderHook(() => useDataImporterRowMutations(props));

    await act(async () => {
      await result.current.handleRestoreSingle({ rowKey: "row-1" });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("Chỉ có thể")
    );
    expect(props.restoreDeclRows).not.toHaveBeenCalled();
  });
});
