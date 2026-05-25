import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import useDataImporterImportFlow from "@/components/dataImporter/useDataImporterImportFlow.js";

const dialogMocks = vi.hoisted(() => ({
  alert: vi.fn(() => Promise.resolve()),
  confirm: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => dialogMocks,
}));

function createProps(overrides = {}) {
  return {
    fileRef: overrides.fileRef ?? { current: { value: "selected.xlsx" } },
    canUploadFiles: true,
    isReadOnlyForEdits: false,
    hasUnsaved: false,
    mode: "source",
    previewSource: null,
    selectedFile: "",
    effectivePreviewRows: [],
    importPreview: { invalid: 0, inserted: 1, updated: 0 },
    canOverwriteData: true,
    overwrite: false,
    actor: "tester",
    isAdminRole: false,
    autoAssignStaff: false,
    defaultCoFilterMin: 5,
    loadRules: vi.fn(() => ({ license: { exclude: { codes: ["E01"] } } })),
    setRules: vi.fn(),
    getTeamRoster: vi.fn(() => [{ team: "OPS", members: ["Alice"] }]),
    mapMemberNamesToTeams: vi.fn(() => new Map([["alice", "OPS"]])),
    mapHQAgenciesByMST: vi.fn(() => new Map([["0101", { short_name: "HQ" }]])),
    detectDateOrder: vi.fn(() => "mdy"),
    mapRow: vi.fn((row) => ({ ...row, mapped: true })),
    ensureLicenseFields: vi.fn((row) => ({ ...row, licenseReady: true })),
    sortDeclRows: vi.fn((rows) => [...rows].sort((a, b) => a.so_tk.localeCompare(b.so_tk))),
    setRawRows: vi.fn(),
    setPage: vi.fn(),
    setMode: vi.fn(),
    setSelectedFile: vi.fn(),
    setQuery: vi.fn(),
    setFilterNoStaff: vi.fn(),
    setFilterNoTeam: vi.fn(),
    setCoFilterMode: vi.fn(),
    setCoFilterMin: vi.fn(),
    setSelectedKeys: vi.fn(),
    setHasUnsaved: vi.fn(),
    saveDeclRows: vi.fn(() => ({
      inserted: 1,
      updated: 0,
      skipped: 0,
      locked: 0,
      totalStored: 1,
      totalIncoming: 1,
      invalid: 0,
      errors: [],
      newBusinessCount: 0,
      newBusinesses: [],
      insertedDeclarations: [],
      updatedDeclarations: [],
      lockedDeclarations: [],
    })),
    pushImportLog: vi.fn(),
    loadSavedRows: vi.fn(() => true),
    fetchAlerts: vi.fn(),
    xlsx: {
      read: vi.fn(() => ({
        SheetNames: ["Sheet1"],
        Sheets: { Sheet1: {} },
      })),
      utils: {
        sheet_to_json: vi.fn(() => [
          { so_tk: "TK-002", date: "2025-02-02" },
          { so_tk: "TK-001", date: "2025-02-01" },
        ]),
      },
    },
    parseWorkbookRows: vi.fn(async () => ({
      sheetName: "Sheet1",
      rows: [
        { so_tk: "TK-002", date: "2025-02-02" },
        { so_tk: "TK-001", date: "2025-02-01" },
      ],
    })),
    FileReaderCtor: class MockFileReader {
      constructor() {
        this.result = "array-buffer";
        this.onload = null;
        this.onerror = null;
      }

      readAsArrayBuffer() {
        if (typeof this.onload === "function") {
          this.onload();
        }
      }
    },
    toast: {
      error: vi.fn(),
      success: vi.fn(),
      sticky: vi.fn(() => "sticky-toast"),
      dismiss: vi.fn(),
    },
    acceptedImportExtensions: [".xlsx", ".xlsm"],
    maxImportFileSizeBytes: 5 * 1024 * 1024,
    maxImportRows: 1000,
    ...overrides,
  };
}

describe("useDataImporterImportFlow", () => {
  afterEach(() => {
    vi.clearAllMocks();
    dialogMocks.alert.mockResolvedValue();
    dialogMocks.confirm.mockResolvedValue(true);
  });

  it("parses an accepted Excel file into preview-mode state", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterImportFlow(props));

    await act(async () => {
      result.current.handleFileChange({
        target: {
          files: [{ name: "imports.xlsx", size: 2048 }],
          value: "C:\\fakepath\\imports.xlsx",
        },
      });
    });

    await waitFor(() => {
      expect(props.setRawRows).toHaveBeenCalledWith([
        { so_tk: "TK-001", date: "2025-02-01", mapped: true, licenseReady: true },
        { so_tk: "TK-002", date: "2025-02-02", mapped: true, licenseReady: true },
      ]);
    });

    expect(props.loadRules).toHaveBeenCalledTimes(1);
    expect(props.parseWorkbookRows).toHaveBeenCalledWith("array-buffer");
    expect(props.setRules).toHaveBeenCalledWith({ license: { exclude: { codes: ["E01"] } } });
    expect(props.setMode).toHaveBeenCalledWith("preview");
    expect(props.setSelectedFile).toHaveBeenCalledWith("imports.xlsx");
    expect(props.setQuery).toHaveBeenCalledWith("");
    expect(props.setFilterNoStaff).toHaveBeenCalledWith(false);
    expect(props.setFilterNoTeam).toHaveBeenCalledWith(false);
    expect(props.setCoFilterMode).toHaveBeenCalledWith("all");
    expect(props.setCoFilterMin).toHaveBeenCalledWith(5);
    expect(props.setSelectedKeys).toHaveBeenCalledWith([]);
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    expect(props.fileRef.current.value).toBe("");
  });

  it("imports preview rows and refreshes saved data", async () => {
    const props = createProps({
      mode: "preview",
      selectedFile: "imports.xlsx",
      effectivePreviewRows: [{ so_tk: "TK-NEW", date: "2025-03-01" }],
      importPreview: { invalid: 0, inserted: 1, updated: 0 },
      canOverwriteData: true,
      overwrite: true,
      isAdminRole: true,
      saveDeclRows: vi.fn(() => ({
        inserted: 1,
        updated: 2,
        skipped: 3,
        locked: 1,
        totalStored: 6,
        totalIncoming: 6,
        invalid: 0,
        errors: [],
        newBusinessCount: 0,
        newBusinesses: [],
        insertedDeclarations: [{ so_tk: "TK-NEW" }],
        updatedDeclarations: [{ so_tk: "TK-UPD" }],
        lockedDeclarations: [{ so_tk: "TK-LOCK" }],
      })),
    });
    const { result } = renderHook(() => useDataImporterImportFlow(props));

    await act(async () => {
      await result.current.handleImport();
    });

    expect(props.saveDeclRows).toHaveBeenCalledWith(
      [{ so_tk: "TK-NEW", date: "2025-03-01" }],
      expect.objectContaining({
        overwrite: true,
        actor: "tester",
        detail: "Import từ imports.xlsx",
        allowReviewedOverride: true,
      }),
    );
    expect(props.pushImportLog).toHaveBeenCalledTimes(1);
    expect(props.loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(props.fetchAlerts).toHaveBeenCalledTimes(1);
    expect(props.fileRef.current.value).toBe("");
    expect(props.toast.success).toHaveBeenCalledWith("Import xong: thêm 1, cập nhật 2, bỏ qua 3 (khóa 1).");
  });

  it("blocks import when preview source is ECUS sync", async () => {
    const props = createProps({
      mode: "preview",
      previewSource: "sync",
      selectedFile: "",
      effectivePreviewRows: [{ so_tk: "TK-SYNC", date: "2025-03-01" }],
      importPreview: { inserted: 1, updated: 0, invalid: 0 },
    });
    const { result } = renderHook(() => useDataImporterImportFlow(props));

    await act(async () => {
      await result.current.handleImport();
    });

    expect(props.saveDeclRows).not.toHaveBeenCalled();
    expect(dialogMocks.alert).toHaveBeenCalledWith(
      'Bạn đang xem trước dữ liệu ECUS. Hãy dùng nút "Đồng bộ ngay" để đưa dữ liệu vào workspace.',
    );
  });

  it("blocks import when import preview has validation errors", async () => {
    const props = createProps({
      mode: "preview",
      selectedFile: "imports.xlsx",
      effectivePreviewRows: [{ so_tk: "TK-ERR", date: "2025-03-01" }],
      importPreview: { error: "preview failed" },
    });
    const { result } = renderHook(() => useDataImporterImportFlow(props));

    await act(async () => {
      await result.current.handleImport();
    });

    expect(props.saveDeclRows).not.toHaveBeenCalled();
    expect(dialogMocks.alert).toHaveBeenCalledWith("Không thể kiểm tra file import. preview failed");
  });

  it("blocks file upload when canUploadFiles is false", async () => {
    const props = createProps({ canUploadFiles: false });
    const { result } = renderHook(() => useDataImporterImportFlow(props));

    await act(async () => {
      await result.current.handleFileChange({ target: { files: [] } });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(expect.stringContaining("chưa được cấp quyền"));
  });

  it("blocks file upload when isReadOnlyForEdits is true", async () => {
    const props = createProps({ isReadOnlyForEdits: true });
    const { result } = renderHook(() => useDataImporterImportFlow(props));

    await act(async () => {
      await result.current.handleFileChange({ target: { files: [] } });
    });

    expect(dialogMocks.alert).toHaveBeenCalledWith(expect.stringContaining("chỉ xem"));
  });

  it("rejects non-Excel file extensions", async () => {
    const csvFile = new File(["a,b,c"], "data.csv", { type: "text/csv" });
    const props = createProps({ canUploadFiles: true });
    const { result } = renderHook(() => useDataImporterImportFlow(props));

    await act(async () => {
      await result.current.handleFileChange({ target: { files: [csvFile], value: "" } });
    });

    expect(props.toast.error).toHaveBeenCalledWith(expect.stringContaining("Excel"));
  });

  it("rejects files exceeding maxImportFileSizeBytes", async () => {
    const bigFile = new File(
      ["x".repeat(2000)],
      "big.xlsx",
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    );
    Object.defineProperty(bigFile, "size", { value: 2000 });
    const props = createProps({ canUploadFiles: true, maxImportFileSizeBytes: 1000 });
    const { result } = renderHook(() => useDataImporterImportFlow(props));

    await act(async () => {
      await result.current.handleFileChange({ target: { files: [bigFile], value: "" } });
    });

    expect(props.toast.error).toHaveBeenCalledWith(expect.stringContaining("vượt quá"));
  });

  it("processing lock prevents duplicate imports on rapid double-call", async () => {
    const props = createProps({
      mode: "preview",
      selectedFile: "imports.xlsx",
      effectivePreviewRows: [{ so_tk: "TK-001", date: "2025-01-01" }],
      importPreview: { invalid: 0, inserted: 1, updated: 0 },
      canOverwriteData: true,
      overwrite: true,
      isAdminRole: true,
    });
    const { result } = renderHook(() => useDataImporterImportFlow(props));

    await act(async () => {
      await Promise.all([result.current.handleImport(), result.current.handleImport()]);
    });

    expect(props.saveDeclRows).toHaveBeenCalledTimes(1);
  });
});
