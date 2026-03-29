import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  getMSTHistoryEntries: vi.fn(),
}));

vi.mock("@/lib/store.js", async () => {
  const actual = await vi.importActual("@/lib/store.js");
  return {
    ...actual,
    getMSTHistoryEntries: storeMocks.getMSTHistoryEntries,
  };
});

import useMSTAssignmentHistoryWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js";

function createEntries() {
  return [
    {
      rowKey: "031__2025-03-01__",
      field: "person_import",
      type: "update",
      timestamp: "2025-03-01T08:00:00.000Z",
    },
    {
      rowKey: "031__2025-03-02__",
      field: "person_export",
      type: "create",
      timestamp: "2025-03-02T08:00:00.000Z",
    },
    {
      rowKey: "031__2025-03-03__",
      field: "status",
      to: "Chưa gán nhân viên",
      type: "update",
      timestamp: "2025-03-03T08:00:00.000Z",
    },
  ];
}

describe("useMSTAssignmentHistoryWorkspace", () => {
  beforeEach(() => {
    storeMocks.getMSTHistoryEntries.mockReset();
    storeMocks.getMSTHistoryEntries.mockReturnValue(createEntries());
  });

  it("loads history entries, derives counts, and filters row keys by action type", () => {
    const goToFirstPage = vi.fn();

    const { result } = renderHook(() =>
      useMSTAssignmentHistoryWorkspace({
        addQuickFavorite: vi.fn(() => ({ ok: true })),
        goToFirstPage,
      })
    );

    expect(storeMocks.getMSTHistoryEntries).toHaveBeenCalled();
    expect(result.current.totalHistoryCount).toBe(3);
    expect(result.current.filteredHistoryCount).toBe(3);
    expect(result.current.historyIndex.get("031__2025-03-01__")).toMatchObject({
      person_import: [expect.objectContaining({ type: "update" })],
    });

    act(() => {
      result.current.updateHistoryFilter({ type: "update" });
    });

    expect(result.current.isHistoryFilterActive).toBe(true);
    expect(result.current.filteredHistoryCount).toBe(2);
    expect(result.current.historyFilteredRowKeys.has("031__2025-03-01__")).toBe(true);
    expect(result.current.historyFilteredRowKeys.has("031__2025-03-03__")).toBe(true);
    expect(result.current.activeStatusFilter).toBeNull();
    expect(goToFirstPage).toHaveBeenCalled();
  });

  it("saves action favorites with duplicate messaging and can reset filters", () => {
    const alertFn = vi.fn();
    const addQuickFavorite = vi
      .fn()
      .mockReturnValueOnce({ ok: false, reason: "duplicate" })
      .mockReturnValueOnce({ ok: true });

    const { result } = renderHook(() =>
      useMSTAssignmentHistoryWorkspace({
        addQuickFavorite,
        goToFirstPage: vi.fn(),
        alertFn,
      })
    );

    act(() => {
      result.current.updateHistoryFilter({ type: "status:assigned" });
    });

    act(() => {
      result.current.handleSaveActionFavorite();
    });

    expect(alertFn).toHaveBeenCalledWith("Bộ lọc thay đổi trạng thái đã tồn tại.");

    act(() => {
      result.current.handleSaveActionFavorite();
    });

    expect(addQuickFavorite).toHaveBeenLastCalledWith("action", "status:assigned");
    expect(alertFn).toHaveBeenCalledWith("Đã lưu bộ lọc thay đổi trạng thái.");

    act(() => {
      result.current.resetHistoryFilter();
    });

    expect(result.current.historyFilter).toEqual({ from: "", to: "", type: "all" });
    expect(result.current.isHistoryFilterActive).toBe(false);
  });

  it("refreshes entries and filters real history events for status transitions", () => {
    let currentEntries = createEntries();

    const { result } = renderHook(() =>
      useMSTAssignmentHistoryWorkspace({
        addQuickFavorite: vi.fn(() => ({ ok: true })),
        goToFirstPage: vi.fn(),
        loadHistoryEntries: () => currentEntries,
      })
    );

    act(() => {
      result.current.updateHistoryFilter({ type: "status:pending" });
    });

    expect(result.current.activeStatusFilter).toBeNull();
    expect(result.current.filteredHistoryCount).toBe(1);
    expect(result.current.filteredHistoryEntries[0]).toMatchObject({
      rowKey: "031__2025-03-03__",
      field: "status",
      to: "Chưa gán nhân viên",
    });
    expect(result.current.historyFilteredRowKeys.has("031__2025-03-03__")).toBe(true);

    act(() => {
      currentEntries = [
        {
          rowKey: "031__2025-03-05__",
          field: "status",
          type: "update",
          timestamp: "2025-03-05T08:00:00.000Z",
        },
      ];
      result.current.refreshHistory();
    });

    expect(result.current.totalHistoryCount).toBe(1);
    expect(result.current.filteredHistoryEntries).toEqual([]);
  });
});
