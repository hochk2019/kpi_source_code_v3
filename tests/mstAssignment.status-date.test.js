import { afterEach, describe, expect, it, vi } from "vitest";

import { MST_ASSIGNMENT_STATUS } from "@/lib/mstAssignments.js";
import {
  computeStatusDisplay,
  computeStoredStatus,
  formatISODate,
  normalizeStatusLabel,
} from "@/components/mst-assignment/model/statusDate.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatISODate", () => {
  it("trả về chuỗi rỗng khi không có giá trị", () => {
    expect(formatISODate("")).toBe("");
    expect(formatISODate(null)).toBe("");
  });

  it("format ngày hợp lệ theo locale vi-VN", () => {
    const input = "2026-03-26T00:00:00.000Z";
    expect(formatISODate(input)).toBe(new Date(input).toLocaleDateString("vi-VN"));
  });

  it("giữ nguyên giá trị khi ngày không hợp lệ", () => {
    expect(formatISODate("khong-hop-le")).toBe("khong-hop-le");
  });

  it("cảnh báo và trả nguyên giá trị nếu Date constructor ném lỗi", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = {
      [Symbol.toPrimitive]() {
        throw new Error("boom");
      },
    };

    expect(formatISODate(input)).toBe(input);
    expect(warnSpy).toHaveBeenCalledWith("formatISODate", expect.any(Error));
  });
});

describe("normalizeStatusLabel", () => {
  it("chuẩn hóa label trạng thái theo accent và khoảng trắng", () => {
    expect(normalizeStatusLabel("  Đã   gán nhân viên ")).toBe(MST_ASSIGNMENT_STATUS.ASSIGNED);
    expect(normalizeStatusLabel("CHƯA GÁN NHÂN VIÊN")).toBe(MST_ASSIGNMENT_STATUS.PENDING);
  });

  it("giữ nguyên giá trị trim nếu không match danh mục trạng thái", () => {
    expect(normalizeStatusLabel("Đang chờ rà soát")).toBe("Đang chờ rà soát");
  });
});

describe("computeStoredStatus", () => {
  it("trả về Đã gán nhân viên khi đủ người nhập và xuất", () => {
    expect(
      computeStoredStatus({
        person_import: "Nguyễn Văn A",
        person_export: "Trần Thị B",
      })
    ).toBe(MST_ASSIGNMENT_STATUS.ASSIGNED);
  });

  it("trả về Chưa gán nhân viên khi thiếu một trong hai đầu mối", () => {
    expect(computeStoredStatus({ person_import: "Nguyễn Văn A", person_export: "" })).toBe(
      MST_ASSIGNMENT_STATUS.PENDING
    );
    expect(computeStoredStatus({ person_import: "", person_export: "Trần Thị B" })).toBe(
      MST_ASSIGNMENT_STATUS.PENDING
    );
  });
});

describe("computeStatusDisplay", () => {
  it("hiển thị trạng thái assigned khi đã đủ cả hai đầu mối", () => {
    expect(
      computeStatusDisplay({
        person_import: "Nguyễn Văn A",
        person_export: "Trần Thị B",
      })
    ).toBe(MST_ASSIGNMENT_STATUS.ASSIGNED);
  });

  it("hiển thị trạng thái pending khi chưa có đầu mối nào", () => {
    expect(computeStatusDisplay({ person_import: "", person_export: "" })).toBe(
      MST_ASSIGNMENT_STATUS.PENDING
    );
  });

  it("hiển thị cảnh báo thiếu người nhập hoặc xuất", () => {
    expect(computeStatusDisplay({ person_import: "", person_export: "Trần Thị B" })).toBe(
      "Thiếu người phụ trách nhập"
    );
    expect(computeStatusDisplay({ person_import: "Nguyễn Văn A", person_export: "" })).toBe(
      "Thiếu người phụ trách xuất"
    );
  });
});
