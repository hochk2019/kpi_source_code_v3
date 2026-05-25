import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import useDataImporterImportPreview from "@/components/dataImporter/useDataImporterImportPreview.js";

function createProps(overrides = {}) {
  return {
    rawRows: [{ so_tk: "1234567890123", value: 1 }],
    upsert11: true,
    mode: "preview",
    overwrite: false,
    actor: "tester",
    canImportUpload: true,
    allowAdminUploadOverride: false,
    isAdminRole: true,
    previewDeclRows: vi.fn((rows, options) => ({ rows, options })),
    setOverwrite: vi.fn(),
    syncPreviewMeta: null,
    ...overrides,
  };
}

describe("useDataImporterImportPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds preview rows with truncated 11-digit declarations and forwards overwrite when allowed", () => {
    const props = createProps({ overwrite: true });

    const { result } = renderHook(() => useDataImporterImportPreview(props));

    expect(result.current.canUploadFiles).toBe(true);
    expect(result.current.canOverwriteData).toBe(true);
    expect(result.current.effectivePreviewRows).toEqual([{ so_tk: "12345678901", value: 1 }]);
    expect(props.previewDeclRows).toHaveBeenCalledWith(
      [{ so_tk: "12345678901", value: 1 }],
      { overwrite: true, actor: "tester" },
    );
    expect(result.current.importPreview).toEqual({
      rows: [{ so_tk: "12345678901", value: 1 }],
      options: { overwrite: true, actor: "tester" },
    });
  });

  it("resets overwrite when the actor can no longer overwrite saved data", () => {
    const props = createProps({
      overwrite: true,
      canImportUpload: false,
      allowAdminUploadOverride: false,
      isAdminRole: false,
    });

    renderHook(() => useDataImporterImportPreview(props));

    expect(props.setOverwrite).toHaveBeenCalledWith(false);
  });

  it("ignores overwrite when the preview is sourced from ECUS sync", () => {
    const props = createProps({
      overwrite: true,
      previewSource: "sync",
    });

    renderHook(() => useDataImporterImportPreview(props));

    expect(props.previewDeclRows).toHaveBeenCalledWith(
      [{ so_tk: "12345678901", value: 1 }],
      { overwrite: false, actor: "tester" },
    );
  });

  it("uses ECUS server row status as the source of truth for sync preview counts", () => {
    const props = createProps({
      rawRows: [
        {
          so_tk: "1234567890123",
          mst: "0101234567",
          cong_ty: "Cong ty moi",
          status: "new",
          locked: false,
          changedFields: ["agency"],
        },
        {
          so_tk: "2234567890123",
          status: "existing",
          locked: false,
          changedFields: ["agency"],
        },
        {
          so_tk: "3234567890123",
          status: "existing",
          locked: false,
          changedFields: [],
        },
        {
          so_tk: "4234567890123",
          status: "existing",
          locked: true,
          changedFields: [],
        },
      ],
      previewSource: "sync",
      syncPreviewMeta: { fetched: 9 },
      previewDeclRows: vi.fn(() => ({
        mode: "merge",
        totalBefore: 25,
        totalAfter: 26,
        totalStored: 26,
        totalIncoming: 4,
        inserted: 99,
        updated: 88,
        skipped: 77,
        locked: 66,
        invalid: 55,
        samples: { inserted: [], errors: [{ so_tk: "wrong" }] },
        newBusinessCount: 0,
        newBusinesses: [],
      })),
    });

    const { result } = renderHook(() => useDataImporterImportPreview(props));

    expect(props.previewDeclRows).toHaveBeenCalledWith(
      [
        expect.objectContaining({ so_tk: "12345678901" }),
        expect.objectContaining({ so_tk: "22345678901" }),
        expect.objectContaining({ so_tk: "32345678901" }),
        expect.objectContaining({ so_tk: "42345678901" }),
      ],
      { overwrite: false, actor: "tester" },
    );
    expect(result.current.importPreview).toMatchObject({
      mode: "merge",
      totalBefore: 25,
      totalAfter: 26,
      totalStored: 26,
      totalIncoming: 9,
      inserted: 1,
      updated: 1,
      skipped: 1,
      locked: 1,
      invalid: 0,
      newBusinessCount: 1,
      newBusinesses: [{ mst: "0101234567", company: "Cong ty moi" }],
      samples: {
        inserted: [expect.objectContaining({ so_tk: "12345678901" })],
        errors: [],
      },
    });
  });

  it("returns an error preview when preview generation throws", () => {
    const error = new Error("preview failed");
    const props = createProps({
      previewDeclRows: vi.fn(() => {
        throw error;
      }),
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useDataImporterImportPreview(props));

    expect(result.current.importPreview).toEqual({ error });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
