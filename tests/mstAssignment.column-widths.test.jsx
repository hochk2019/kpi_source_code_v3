import { describe, expect, it, vi } from "vitest";
import {
  COLUMN_MAX_WIDTH,
  COLUMN_MIN_WIDTH,
  COLUMN_MIN_WIDTHS,
  COLUMN_WIDTH_STORAGE_KEY,
  DEFAULT_COLUMN_WIDTHS,
  readStoredColumnWidths,
  sanitizeColumnWidths,
} from "@/components/mst-assignment/hooks/useMSTAssignmentColumnLayout.js";

describe("sanitizeColumnWidths", () => {
  it("chuẩn hóa giá trị về trong biên an toàn", () => {
    const sanitized = sanitizeColumnWidths({
      mst: 42,
      company: "9999",
      person_import: null,
      person_export: undefined,
      status: 0,
      effective_from: 12,
      effective_to: 2048,
      actions: 720,
    });

    expect(sanitized.mst).toBeGreaterThanOrEqual(COLUMN_MIN_WIDTHS.mst);
    expect(sanitized.company).toBe(COLUMN_MAX_WIDTH);
    expect(sanitized.person_import).toBe(DEFAULT_COLUMN_WIDTHS.person_import);
    expect(sanitized.status).toBe(DEFAULT_COLUMN_WIDTHS.status);
    expect(sanitized.effective_from).toBeGreaterThanOrEqual(COLUMN_MIN_WIDTH);
    expect(sanitized.effective_to).toBeLessThanOrEqual(COLUMN_MAX_WIDTH);
    expect(sanitized.actions).toBeLessThanOrEqual(COLUMN_MAX_WIDTH);
  });
});

describe("readStoredColumnWidths", () => {
  it("trả về fallback khi dữ liệu lỗi", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fallback = { ...DEFAULT_COLUMN_WIDTHS, mst: 200 };
    const storage = {
      getItem: vi.fn(() => "{invalid json"),
    };

    const result = readStoredColumnWidths(storage, fallback);
    expect(result.mst).toBe(fallback.mst);
    expect(storage.getItem).toHaveBeenCalledWith(COLUMN_WIDTH_STORAGE_KEY);
    warnSpy.mockRestore();
  });

  it("áp dụng cấu hình hợp lệ từ localStorage", () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ company: 412 })),
    };

    const result = readStoredColumnWidths(storage, DEFAULT_COLUMN_WIDTHS);
    expect(result.company).toBe(412);
  });
});

