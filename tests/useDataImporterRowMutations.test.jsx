import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterRowMutations from "@/components/dataImporter/useDataImporterRowMutations.js";
import { AppDialogProvider } from "@/hooks/useAppDialog.tsx";

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
    vi.restoreAllMocks();
  });

  it("soft deletes selected rows and refreshes saved state", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    const props = createProps({
      selectedKeys: ["row-1", "row-2"],
    });

    const { result } = renderHook(() => useDataImporterRowMutations(props), {
      wrapper: ({ children }) => <AppDialogProvider>{children}</AppDialogProvider>,
    });

    act(() => {
      result.current.handleDeleteSelected();
    });

    expect(props.ensureEditableKeys).toHaveBeenCalledWith(["row-1", "row-2"], "đánh dấu xóa");
    expect(props.softDeleteDeclRows).toHaveBeenCalledWith(["row-1", "row-2"], {
      actor: "tester",
    });
    expect(alertSpy).toHaveBeenCalledWith("Đã đánh dấu xóa 2 tờ khai.");
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    expect(props.loadSavedRows).toHaveBeenCalledTimes(1);
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
  });

  it("hard deletes selected rows and prunes removed keys from selection", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    const props = createProps({
      selectedKeys: ["row-1", "row-2", "row-3"],
    });

    const { result } = renderHook(() => useDataImporterRowMutations(props), {
      wrapper: ({ children }) => <AppDialogProvider>{children}</AppDialogProvider>,
    });

    act(() => {
      result.current.handleHardDeleteSelected();
    });

    expect(props.ensureHardDeleteKeys).toHaveBeenCalledWith(
      ["row-1", "row-2", "row-3"],
      "xóa vĩnh viễn"
    );
    expect(props.hardDeleteDeclRows).toHaveBeenCalledWith(["row-1", "row-2", "row-3"], {
      actor: "tester",
    });
    expect(alertSpy).toHaveBeenCalledWith("Đã xóa vĩnh viễn 2 tờ khai.");
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    const nextSelection = props.setSelectedKeys.mock.calls[0][0](["row-1", "row-2", "row-3"]);
    expect(nextSelection).toEqual(["row-2"]);
    expect(props.loadSavedRows).toHaveBeenCalledTimes(1);
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
  });

  it("restores one soft-deleted row and reloads alerts", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const props = createProps();

    const { result } = renderHook(() => useDataImporterRowMutations(props), {
      wrapper: ({ children }) => <AppDialogProvider>{children}</AppDialogProvider>,
    });

    act(() => {
      result.current.handleRestoreSingle({ rowKey: "row-9" });
    });

    expect(props.restoreDeclRows).toHaveBeenCalledWith(["row-9"], {
      actor: "tester",
      detail: "Khôi phục tờ khai bị xóa mềm từ giao diện Import Data",
    });
    expect(alertSpy).toHaveBeenCalledWith("Đã khôi phục 1 tờ khai.");
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    expect(props.loadSavedRows).toHaveBeenCalledTimes(1);
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
  });
});
