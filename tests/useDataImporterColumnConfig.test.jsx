import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, fireEvent } from "@testing-library/react";

vi.mock("@/lib/importColumnConfig.js", () => ({
  IMPORT_COLUMN_IDS: ["date", "company", "status"],
  IMPORT_SENSITIVE_COLUMNS: ["status", "history", "update"],
  getImportColumnConfig: vi.fn(() => ({
    hidden: ["status"],
    widths: { date: 160 },
  })),
  saveImportColumnConfig: vi.fn((config) => ({
    hidden: Array.isArray(config?.hidden) ? config.hidden : [],
    widths: config?.widths || {},
  })),
  subscribeImportColumnConfig: vi.fn(() => () => {}),
}));

vi.mock("@/shared/toast.js", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import useDataImporterColumnConfig from "@/components/dataImporter/useDataImporterColumnConfig.jsx";
import {
  AUX_COLUMN_LABELS,
  IMPORT_TABLE_COLUMNS,
} from "@/components/dataImporter/dataImporterConfig.js";
import {
  getImportColumnConfig,
  saveImportColumnConfig,
  subscribeImportColumnConfig,
} from "@/lib/importColumnConfig.js";
import { toast } from "@/shared/toast.js";

function createProps(overrides = {}) {
  return {
    actor: "tester",
    isAdminRole: true,
    ...overrides,
  };
}

describe("useDataImporterColumnConfig", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates hidden columns, visible counts, and reacts to config subscription updates", () => {
    let notify = null;
    subscribeImportColumnConfig.mockImplementation((callback) => {
      notify = callback;
      return () => {};
    });

    const { result } = renderHook(() =>
      useDataImporterColumnConfig(createProps()),
    );

    expect(getImportColumnConfig).toHaveBeenCalledTimes(1);
    expect(result.current.columnHiddenSet).toEqual(new Set(["status"]));
    expect(result.current.visibleColumnCount).toBe(IMPORT_TABLE_COLUMNS.length - 1);
    expect(result.current.totalConfigColumns).toBe(
      IMPORT_TABLE_COLUMNS.length + Object.keys(AUX_COLUMN_LABELS).length,
    );

    act(() => {
      notify?.({
        hidden: ["company", "status"],
        widths: { company: 240 },
      });
    });

    expect(result.current.columnHiddenSet).toEqual(new Set(["company", "status"]));
    expect(result.current.visibleColumnCount).toBe(IMPORT_TABLE_COLUMNS.length - 2);
  });

  it("blocks sensitive columns for non-admin users and prevents hiding every base column", () => {
    const { result } = renderHook(() =>
      useDataImporterColumnConfig(createProps({ isAdminRole: false })),
    );

    act(() => {
      result.current.setColumnConfigOpen(true);
    });

    act(() => {
      result.current.setColumnDraftHidden(new Set(["status"]));
    });

    act(() => {
      result.current.handleToggleColumnDraft("status");
    });

    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(result.current.columnDraftHidden).toEqual(new Set(["status"]));

    act(() => {
      result.current.handleToggleColumnDraft("date");
    });

    expect(result.current.columnDraftHidden).toEqual(new Set(["status", "date"]));

    act(() => {
      result.current.handleToggleColumnDraft("company");
    });

    expect(result.current.columnDraftHidden).toEqual(new Set(["status", "date"]));
    expect(result.current.columnDraftError).toMatch(/ít nhất một cột/i);
  });

  it("persists resized widths, applies hidden config changes, and resets to defaults", () => {
    const { result } = renderHook(() =>
      useDataImporterColumnConfig(createProps()),
    );

    act(() => {
      result.current.setColumnConfigOpen(true);
    });

    act(() => {
      result.current.setColumnDraftHidden(new Set(["status"]));
    });

    act(() => {
      result.current.registerHeaderRef("date", {
        getBoundingClientRect: () => ({ width: 160 }),
      });
    });

    const resizeHandle = result.current.renderResizeHandle("date");
    expect(resizeHandle).toBeTruthy();

    act(() => {
      resizeHandle.props.onMouseDown({
        clientX: 100,
        preventDefault() {},
        stopPropagation() {},
      });
    });

    act(() => {
      fireEvent.mouseMove(window, { clientX: 150 });
      fireEvent.mouseUp(window, { clientX: 150 });
    });

    expect(saveImportColumnConfig).toHaveBeenNthCalledWith(
      1,
      { widths: { date: 210 } },
      { actor: "tester" },
    );

    act(() => {
      result.current.handleToggleColumnDraft("company");
    });

    act(() => {
      result.current.handleApplyColumnConfig();
    });

    expect(saveImportColumnConfig).toHaveBeenNthCalledWith(
      2,
      {
        hidden: ["status", "company"],
        widths: { date: 210 },
      },
      { actor: "tester" },
    );
    expect(toast.success).toHaveBeenCalledWith("Đã cập nhật cấu hình cột Import Data.");
    expect(result.current.columnConfigOpen).toBe(false);

    act(() => {
      result.current.handleResetColumnConfig();
    });

    expect(saveImportColumnConfig).toHaveBeenNthCalledWith(
      3,
      { hidden: [...new Set([...Object.keys(AUX_COLUMN_LABELS), "status"])], widths: {} },
      { actor: "tester" },
    );
    expect(toast.success).toHaveBeenCalledWith("Đã khôi phục cấu hình cột Import Data mặc định.");
  });
});
