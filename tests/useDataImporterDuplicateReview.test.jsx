import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterDuplicateReview from "@/components/dataImporter/useDataImporterDuplicateReview.js";

function createGroup(rawPrefix, keys, keeperKey = keys[0]) {
  return {
    rawPrefix,
    prefix: `Group ${rawPrefix}`,
    keeperKey,
    items: keys.map((key) => ({
      key,
      label: `Label ${key}`,
      row: { rowKey: key },
    })),
  };
}

function createProps(overrides = {}) {
  return {
    actor: "tester",
    mode: "saved",
    isReadOnlyForEdits: false,
    isAdminRole: false,
    duplicate11Details: [createGroup("grp-1", ["row-1", "row-2"])],
    rawRows: [
      { rowKey: "row-1", fieldA: "A1" },
      { rowKey: "row-2", fieldA: "A2" },
    ],
    editingRestrictionMessage: "Bạn không có quyền xử lý nhóm này.",
    duplicateMergeFields: [{ key: "fieldA" }],
    keyOfRow: vi.fn((row) => row.rowKey),
    isRowEditable: vi.fn(() => true),
    clearDuplicateReviewFlags: vi.fn(),
    applyMergeField: vi.fn((keeper, source, field) => {
      keeper[field] = source[field];
    }),
    sortDeclRows: vi.fn((rows) => rows),
    saveDeclRows: vi.fn(),
    pushAuditLog: vi.fn(),
    loadSavedRows: vi.fn(),
    fetchAlerts: vi.fn(),
    ...overrides,
  };
}

describe("useDataImporterDuplicateReview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds default duplicate plan state and updates keeper-driven merges", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterDuplicateReview(props));

    expect(result.current.duplicate11Plan).toEqual({
      "grp-1": {
        keeperKey: "row-1",
        merges: { fieldA: "row-1" },
        resolution: "delete",
        note: "",
      },
    });
    expect(result.current.duplicate11PlannedDeleteGroups).toBe(1);
    expect(result.current.duplicate11PlannedReviewGroups).toBe(0);
    expect(result.current.duplicate11PlannedRemovalCount).toBe(1);

    act(() => {
      result.current.handleChangeDuplicateKeeper("grp-1", "row-2");
    });

    expect(result.current.duplicate11Plan["grp-1"]).toEqual({
      keeperKey: "row-2",
      merges: { fieldA: "row-2" },
      resolution: "delete",
      note: "",
    });
  });

  it("opens and closes the duplicate review dialog while resetting confirmation state", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterDuplicateReview(props));

    act(() => {
      result.current.handleDeleteDuplicates11();
      result.current.setDuplicateReviewConfirmed(true);
    });

    expect(result.current.duplicateReviewOpen).toBe(true);
    expect(result.current.duplicateReviewConfirmed).toBe(true);

    act(() => {
      result.current.handleDuplicateReviewOpenChange(false);
    });

    expect(result.current.duplicateReviewOpen).toBe(false);
    expect(result.current.duplicateReviewConfirmed).toBe(false);
  });

  it("applies delete and review plans, persists rows, and refreshes alert state", () => {
    const props = createProps({
      duplicate11Details: [
        createGroup("grp-delete", ["row-1", "row-2"]),
        createGroup("grp-review", ["row-3", "row-4"], "row-3"),
      ],
      rawRows: [
        { rowKey: "row-1", fieldA: "A1", duplicate_review_pending: true },
        { rowKey: "row-2", fieldA: "A2" },
        { rowKey: "row-3", fieldA: "B3" },
        { rowKey: "row-4", fieldA: "B4" },
      ],
      clearDuplicateReviewFlags: vi.fn((row) => {
        delete row.duplicate_review_pending;
      }),
    });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useDataImporterDuplicateReview(props));

    act(() => {
      result.current.handleChangeDuplicateMerge("grp-delete", "fieldA", "row-2");
      result.current.handleChangeDuplicateResolution("grp-review", "review");
      result.current.handleChangeDuplicateNote("grp-review", "Can review");
    });

    act(() => {
      result.current.handleConfirmDuplicateRemoval();
    });

    expect(props.saveDeclRows).toHaveBeenCalledWith(
      [
        { rowKey: "row-1", fieldA: "A2" },
        expect.objectContaining({
          rowKey: "row-3",
          duplicate_review_pending: true,
          duplicate_review_note: "Can review",
          duplicate_review_actor: "tester",
        }),
        expect.objectContaining({
          rowKey: "row-4",
          duplicate_review_pending: true,
          duplicate_review_note: "Can review",
          duplicate_review_actor: "tester",
        }),
      ],
      expect.objectContaining({
        overwrite: true,
        actor: "tester",
        allowReviewedOverride: false,
      })
    );
    expect(props.pushAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "decl.duplicate.resolve",
        meta: expect.objectContaining({
          groups: expect.arrayContaining([
            expect.objectContaining({ prefix: "grp-delete", resolution: "delete" }),
            expect.objectContaining({ prefix: "grp-review", resolution: "review", note: "Can review" }),
          ]),
        }),
      })
    );
    expect(props.loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      "Đã xóa 1 bản ghi trong 1 nhóm, 1 nhóm được đánh dấu cần rà soát."
    );
  });
});
