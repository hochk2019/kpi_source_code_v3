import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/dataImporter/useDataImporterDeletedRows.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterQueryFilters.js", () => ({
  default: vi.fn(),
}));

import useDataImporterDeletedRows from "@/components/dataImporter/useDataImporterDeletedRows.js";
import useDataImporterQueryFilters from "@/components/dataImporter/useDataImporterQueryFilters.js";
import useDataImporterSessionFilters from "@/components/dataImporter/useDataImporterSessionFilters.js";

describe("useDataImporterSessionFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useDataImporterDeletedRows.mockReturnValue({
      deletedDialogOpen: false,
      hardDeletedLoading: false,
      hardDeletedError: "",
      deletedEntries: [{ key: "row-2" }],
      softDeletedCount: 1,
      hardDeletedCount: 0,
      deletedTotalCount: 1,
      deletedRangeLabel: "range",
      openDeletedDialog: vi.fn(),
      handleDeletedDialogOpenChange: vi.fn(),
      handleHardDeletedRetry: vi.fn(),
    });

    useDataImporterQueryFilters.mockReturnValue({
      queryFilterControlsProps: { query: "Acme" },
    });
  });

  it("builds filter-derived state and wires deleted/query controllers", () => {
    const props = {
      rawRows: [
        { id: "row-1", deleted_at: null, co_lines: [] },
        { id: "row-2", deleted_at: "2026-03-11T00:00:00.000Z", co_lines: [{}, {}, {}, {}, {}, {}] },
      ],
      mode: "saved",
      pageSize: 50,
      query: "Acme",
      quickMST: "0101",
      quickCompany: "Acme Corp",
      statusFilters: ["new"],
      searchRange: { from: "", to: "" },
      filterNoStaff: false,
      filterNoTeam: false,
      filterDuplicate11: false,
      coFilterMode: "all",
      coFilterMin: 5,
      showDeletedRows: false,
      fetchWithAuth: vi.fn(),
      filterDeclRows: vi.fn((rows) => rows),
      keyOfRow: vi.fn((row) => row?.id ?? ""),
      extractErrorMessage: vi.fn(),
      formatDateTime: vi.fn(),
      formatDisplayDate: vi.fn(),
      formatDateRangeLabel: vi.fn(),
      mainSearchHelpTextId: "search-help",
      datePreset: "none",
      setQuery: vi.fn(),
      setPage: vi.fn(),
      setDatePreset: vi.fn(),
      setSearchRange: vi.fn(),
      setFilterNoStaff: vi.fn(),
      setFilterNoTeam: vi.fn(),
      setCoFilterMode: vi.fn(),
      setCoFilterMin: vi.fn(),
    };

    const { result } = renderHook(() => useDataImporterSessionFilters(props));

    expect(result.current.deletedRowCount).toBe(1);
    expect(result.current.baseFilterInputs).toMatchObject({
      query: "Acme",
      mst: "0101",
      company: "Acme Corp",
      statuses: ["new"],
    });
    expect(result.current.pageResetKey).toContain("0101");
    expect(result.current.queryFilterControlsProps).toEqual({ query: "Acme" });

    expect(useDataImporterDeletedRows).toHaveBeenCalledWith(
      expect.objectContaining({
        baseFilterInputs: expect.objectContaining({
          query: "Acme",
          mst: "0101",
        }),
        softDeletedRows: [],
      }),
    );
    expect(useDataImporterQueryFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "Acme",
        mainSearchHelpTextId: "search-help",
      }),
    );
  });
});
