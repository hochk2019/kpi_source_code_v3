import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterReviewActions from "@/components/dataImporter/useDataImporterReviewActions.js";

const ALERTS_REVIEW_ROUTE = "/api/v4/declarations/imports/alerts/review";
const ALERTS_UNREVIEW_ROUTE = "/api/v4/declarations/imports/alerts/unreview";

function createProps(overrides = {}) {
  return {
    actor: "tester",
    canReviewAlerts: true,
    mode: "saved",
    selectedKeys: ["row-1"],
    rawRows: [{ rowKey: "row-1", reviewed: true }],
    ensureEditableKeys: vi.fn((keys) => keys),
    keyOfRow: vi.fn((row) => row.rowKey),
    markDeclRowsReviewed: vi.fn(() => 1),
    unmarkDeclRowsReviewed: vi.fn(() => 1),
    fetchWithAuth: vi.fn(async () => ({ ok: true })),
    setSelectedKeys: vi.fn(),
    setHasUnsaved: vi.fn(),
    loadSavedRows: vi.fn(),
    fetchAlerts: vi.fn(),
    ...overrides,
  };
}

describe("useDataImporterReviewActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes alert monitoring on demand", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterReviewActions(props));

    act(() => {
      result.current.handleRefreshAlerts();
    });

    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
  });

  it("marks selected declarations as reviewed and syncs the server state", async () => {
    const props = createProps({
      selectedKeys: ["row-1", "row-2"],
      markDeclRowsReviewed: vi.fn(() => 2),
    });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useDataImporterReviewActions(props));

    await act(async () => {
      await result.current.handleMarkReviewed();
    });

    expect(props.ensureEditableKeys).toHaveBeenCalledWith(["row-1", "row-2"], "đánh dấu rà soát");
    expect(props.markDeclRowsReviewed).toHaveBeenCalledWith(["row-1", "row-2"], { actor: "tester" });
    expect(props.fetchWithAuth).toHaveBeenCalledWith(
      ALERTS_REVIEW_ROUTE,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
    expect(props.setSelectedKeys).toHaveBeenCalledWith([]);
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    expect(props.loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("unmarks only reviewed rows and syncs the server state", async () => {
    const props = createProps({
      selectedKeys: ["row-1", "row-2"],
      rawRows: [
        { rowKey: "row-1", reviewed: true },
        { rowKey: "row-2", reviewed: false },
      ],
    });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useDataImporterReviewActions(props));

    await act(async () => {
      await result.current.handleUnmarkReviewed();
    });

    expect(props.ensureEditableKeys).toHaveBeenCalledWith(["row-1", "row-2"], "bỏ đánh dấu rà soát");
    expect(props.unmarkDeclRowsReviewed).toHaveBeenCalledWith(["row-1"], { actor: "tester" });
    expect(props.fetchWithAuth).toHaveBeenCalledWith(
      ALERTS_UNREVIEW_ROUTE,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
    expect(props.setSelectedKeys).toHaveBeenCalledWith([]);
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    expect(props.loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
