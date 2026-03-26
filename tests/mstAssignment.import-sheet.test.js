import { describe, expect, it } from "vitest";

import {
  findCell,
  headerAliases,
  toISO,
} from "@/components/mst-assignment/model/importSheet.js";

describe("headerAliases", () => {
  it("giữ alias tiếng Việt cho các cột import MST", () => {
    expect(headerAliases.mst).toContain("mã số thuế");
    expect(headerAliases.effective_from).toContain("áp dụng từ ngày");
    expect(headerAliases.status).toContain("trạng thái");
  });
});

describe("toISO", () => {
  it("chuẩn hóa Date object thành yyyy-mm-dd", () => {
    expect(toISO(new Date("2026-03-26T00:00:00.000Z"))).toBe("2026-03-26");
  });

  it("đọc được serial Excel", () => {
    expect(toISO(45292)).toBe("2024-01-01");
  });

  it("chuẩn hóa chuỗi dd/mm/yyyy và yyyy-mm-dd", () => {
    expect(toISO("26/3/2026")).toBe("2026-03-26");
    expect(toISO("2026-3-6")).toBe("2026-03-06");
  });

  it("trả về chuỗi rỗng cho giá trị không parse được", () => {
    expect(toISO("khong-hop-le")).toBe("");
    expect(toISO(null)).toBe("");
  });
});

describe("findCell", () => {
  it("đọc giá trị theo alias tiếng Việt có dấu", () => {
    const row = {
      "Mã số thuế (MST)": "0101234567",
      "Áp dụng từ ngày": "2026-03-26",
    };

    expect(findCell(row, "mst")).toBe("0101234567");
    expect(findCell(row, "effective_from")).toBe("2026-03-26");
  });

  it("đọc giá trị theo alias không dấu", () => {
    const row = {
      "nguoi phu trach nhap": "Lan",
      "ghi chu trang thai": "Đang gán",
    };

    expect(findCell(row, "person_import")).toBe("Lan");
    expect(findCell(row, "status")).toBe("Đang gán");
  });

  it("trả về chuỗi rỗng khi không có cột tương ứng", () => {
    expect(findCell({ company: "Công ty A" }, "person_export")).toBe("");
  });
});
