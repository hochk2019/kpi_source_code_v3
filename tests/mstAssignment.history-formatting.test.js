import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatHistoryTime,
  HISTORY_FIELD_LABELS,
} from "@/components/mst-assignment/model/historyFormatting.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HISTORY_FIELD_LABELS", () => {
  it("giữ ánh xạ nhãn lịch sử cho các field đang dùng", () => {
    expect(HISTORY_FIELD_LABELS).toEqual({
      person_import: "Người phụ trách Nhập",
      person_export: "Người phụ trách Xuất",
      effective_from: "Áp dụng từ ngày",
      effective_to: "Đến hết ngày",
    });
  });
});

describe("formatHistoryTime", () => {
  it("trả về chuỗi rỗng khi không có giá trị", () => {
    expect(formatHistoryTime("")).toBe("");
    expect(formatHistoryTime(null)).toBe("");
  });

  it("format timestamp hợp lệ theo locale vi-VN", () => {
    const input = "2026-03-26T15:45:00.000Z";
    expect(formatHistoryTime(input)).toBe(
      new Date(input).toLocaleString("vi-VN", { hour12: false })
    );
  });

  it("giữ nguyên hành vi Invalid Date cho chuỗi ngày không hợp lệ", () => {
    expect(formatHistoryTime("khong-hop-le")).toBe("Invalid Date");
  });

  it("cảnh báo và trả nguyên giá trị nếu Date constructor ném lỗi", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = {
      [Symbol.toPrimitive]() {
        throw new Error("boom");
      },
    };

    expect(formatHistoryTime(input)).toBe(input);
    expect(warnSpy).toHaveBeenCalledWith("formatHistoryTime error", expect.any(Error));
  });
});
