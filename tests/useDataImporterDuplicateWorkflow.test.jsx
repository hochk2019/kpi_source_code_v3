import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterDuplicateWorkflow from "@/components/dataImporter/useDataImporterDuplicateWorkflow.js";

function createRows() {
  return [
    {
      id: "newest",
      so_tk_full: "1020304050602",
      nhanh: "HCM",
      updated_at: "2025-03-05T08:00:00.000Z",
      nhan_vien: "",
      team: "",
      kpi: 9,
    },
    {
      id: "third",
      so_tk_full: "1020304050603",
      nhanh: "HCM",
      updated_at: "2025-03-02T09:00:00.000Z",
      nhan_vien: "Binh",
      team: "OPS",
      kpi: 5,
    },
    {
      id: "unique",
      so_tk_full: "9988776655443",
      nhanh: "HN",
      updated_at: "2025-03-04T08:00:00.000Z",
      nhan_vien: "An",
      team: "OPS",
      kpi: 4,
    },
  ];
}

function createProps(overrides = {}) {
  return {
    rawRows: createRows(),
    keyOfRow: (row) => row.id,
    lastSyncSummary: {
      rowsFetched: 2,
      rowsInserted: 1,
      rowsUpdated: 1,
      rowsSkipped: 0,
      totalStored: 3,
      updatedDeclarations: [{ id: "third", so_tk_full: "1020304050603", nhanh: "HCM" }],
      updatedKeys: ["third"],
    },
    mode: "saved",
    coMismatchKeySet: new Set(["unique"]),
    setSelectedKeys: vi.fn(),
    setPage: vi.fn(),
    setFilterDuplicate11: vi.fn(),
    summarizeLicenseSnapshot: vi.fn(() => ({
      sourceCount: 0,
      includedCount: 0,
      excludedCount: 0,
      sourceCodes: [],
      includedCodes: [],
      excludedCodes: [],
    })),
    coLabel: vi.fn(() => "Khong CO"),
    coLineCount: vi.fn(() => 0),
    createDuplicateDiffGroups: vi.fn(() => [{ rows: [{ changed: true }, { changed: false }] }]),
    formatDeclarationLabel: vi.fn((row) => row.so_tk_full || row.id || "missing"),
    actor: "tester",
    isReadOnlyForEdits: false,
    isAdminRole: false,
    editingRestrictionMessage: "Bạn không có quyền xử lý nhóm này.",
    duplicateMergeFields: [{ key: "team" }],
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

describe("useDataImporterDuplicateWorkflow", () => {
  it("builds duplicate summary metadata and wires saved-row highlight actions", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterDuplicateWorkflow(props));

    expect(result.current.duplicate11GroupCount).toBe(1);
    expect(result.current.duplicate11TotalRows).toBe(2);
    expect(result.current.hasDuplicate11Rows).toBe(true);
    expect(Array.from(result.current.duplicate11KeeperSet)).toEqual(["newest"]);
    expect(Array.from(result.current.duplicate11DuplicatesSet)).toEqual(["third"]);
    expect(result.current.lastSyncUpdated).toBe(1);
    expect(result.current.updatedPreview).toHaveLength(1);

    act(() => {
      result.current.handleSelectUpdated();
      result.current.handleToggleDuplicateFilter();
    });

    expect(props.setSelectedKeys).toHaveBeenCalledWith(["third"]);
    expect(props.setPage).toHaveBeenCalledWith(1);
    expect(props.setFilterDuplicate11).toHaveBeenCalledTimes(1);
    expect(props.setFilterDuplicate11.mock.calls[0][0](false)).toBe(true);
  });

  it("coordinates duplicate diff and review workflows from the shared summary", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterDuplicateWorkflow(props));

    act(() => {
      result.current.handleOpenDuplicateDiff("10203040506", "newest", "third");
    });

    expect(result.current.duplicateDiffState).toEqual({
      open: true,
      group: "10203040506",
      baseKey: "newest",
      compareKey: "third",
    });
    expect(result.current.duplicateDiffChangedCount).toBe(1);
    expect(result.current.duplicateDiffGroupLabel).toContain("10203040506");

    act(() => {
      result.current.handleDeleteDuplicates11();
    });

    expect(result.current.duplicateReviewOpen).toBe(true);
    expect(result.current.duplicate11PlanHasActions).toBe(true);
    expect(result.current.duplicate11PlannedDeleteGroups).toBe(1);
    expect(result.current.duplicate11PlannedRemovalCount).toBe(1);
  });
});
