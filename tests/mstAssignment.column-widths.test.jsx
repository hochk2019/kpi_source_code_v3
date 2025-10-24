import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/store.js", () => {
  const rows = [
    {
      mst: "0100000001",
      company: "Công ty Ánh Dương",
      person_import: "",
      person_export: "",
      team: "",
      effective_from: "2025-01-01",
      effective_to: "",
      status: "",
    },
  ];

  return {
    MST_ASSIGNMENT_STATUS: {
      ASSIGNED: "Đã gán",
      PENDING: "Đang chờ",
    },
    getMSTMap: vi.fn(() => rows.map((row) => ({ ...row }))),
    getMSTHistoryEntries: vi.fn(() => []),
    upsertMSTRows: vi.fn(() => ({ ok: true })),
    saveMSTRow: vi.fn(() => ({ ok: true })),
    getTeamRoster: vi.fn(() => ({ teams: [] })),
    subscribeTeamRoster: vi.fn(() => () => {}),
    normalizeStr: (value) => (value == null ? "" : value.toString()),
    normalizeName: (value) => (value == null ? "" : value.toString().trim().toLowerCase()),
  };
});

import MSTAssignment, {
  COLUMN_MAX_WIDTH,
  COLUMN_MIN_WIDTH,
  COLUMN_MIN_WIDTHS,
  COLUMN_WIDTH_STORAGE_KEY,
  DEFAULT_COLUMN_WIDTHS,
  readStoredColumnWidths,
  sanitizeColumnWidths,
} from "@/components/MSTAssignment.jsx";

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
    expect(sanitized.status).toBe(COLUMN_MIN_WIDTHS.status);
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

describe("MSTAssignment – tùy chỉnh chiều rộng cột", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("đọc cấu hình đã lưu, kéo giãn và đặt lại chiều rộng", () => {
    window.localStorage.setItem(
      COLUMN_WIDTH_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_COLUMN_WIDTHS,
        company: 360,
      })
    );

    render(<MSTAssignment canEdit={false} currentUser={{ username: "viewer" }} />);

    const companyHeader = screen.getByRole("columnheader", { name: /công ty/i });
    expect(companyHeader).toHaveStyle({ width: "360px" });

    const handle = companyHeader.querySelector('[data-resize-handle="company"]');
    expect(handle).toBeTruthy();

    fireEvent.mouseDown(handle, { button: 0, clientX: 360 });
    fireEvent.mouseMove(window, { clientX: 420 });
    fireEvent.mouseUp(window, { clientX: 420 });

    vi.runAllTimers();

    expect(companyHeader).toHaveStyle({ width: "420px" });

    const stored = JSON.parse(window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY));
    expect(stored.company).toBe(420);

    fireEvent.click(screen.getByRole("button", { name: /cột hiển thị/i }));
    const resetButton = screen.getByRole("button", { name: /đặt lại chiều rộng/i });
    fireEvent.click(resetButton);

    vi.runAllTimers();

    expect(companyHeader).toHaveStyle({ width: `${DEFAULT_COLUMN_WIDTHS.company}px` });
    const storedAfter = JSON.parse(window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY));
    expect(storedAfter.company).toBe(DEFAULT_COLUMN_WIDTHS.company);
  });
});
