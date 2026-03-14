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
