import { describe, expect, it } from "vitest";

import { createDuplicateDiffGroups } from "@/components/dataImporter/dataImporterDuplicateDiffUtils.js";

describe("dataImporterDuplicateDiffUtils", () => {
  it("gom các trường diff theo nhóm với label và format thời gian hiện tại", () => {
    const groups = createDuplicateDiffGroups(
      {
        so_tk: "10203040506",
        date: "2025-07-05",
        reviewed: false,
        licenseCodes: ["GP01", "GP02"],
        duplicate_review_updated_at: "2025-07-06T08:15:00.000Z",
        custom_note: "Ghi chú A",
      },
      {
        so_tk: "10203040506",
        date: "2025-07-06",
        reviewed: true,
        licenseCodes: ["GP01", "GP03"],
        duplicate_review_updated_at: "2025-07-06T09:30:00.000Z",
        custom_note: "Ghi chú B",
      },
    );

    const declarationGroup = groups.find((group) => group.title === "Thông tin tờ khai");
    const assignmentGroup = groups.find((group) => group.title === "Phân công & trạng thái");
    const licenseGroup = groups.find((group) => group.title === "Giấy phép & KPI");
    const otherGroup = groups.find((group) => group.title === "Thông tin khác");

    expect(declarationGroup).toBeTruthy();
    expect(assignmentGroup).toBeTruthy();
    expect(licenseGroup).toBeTruthy();
    expect(otherGroup).toBeTruthy();

    expect(declarationGroup.rows).toContainEqual(
      expect.objectContaining({
        key: "date",
        label: "Ngày tờ khai",
        baseValue: "05/07/2025",
        compareValue: "06/07/2025",
        changed: true,
      }),
    );

    expect(assignmentGroup.rows).toContainEqual(
      expect.objectContaining({
        key: "reviewed",
        label: "Đã rà soát",
        baseValue: "Không",
        compareValue: "Có",
        changed: true,
      }),
    );

    expect(licenseGroup.rows).toContainEqual(
      expect.objectContaining({
        key: "licenseCodes",
        label: "Mã GP hiện tại",
        baseValue: "GP01\nGP02",
        compareValue: "GP01\nGP03",
        changed: true,
      }),
    );

    expect(assignmentGroup.rows).toContainEqual(
      expect.objectContaining({
        key: "duplicate_review_updated_at",
        label: "Cập nhật rà soát gần nhất",
      }),
    );

    expect(otherGroup.rows).toContainEqual(
      expect.objectContaining({
        key: "custom_note",
        label: "Custom note",
        baseValue: "Ghi chú A",
        compareValue: "Ghi chú B",
        changed: true,
      }),
    );
  });

  it("bỏ qua key rác, trường cùng rỗng và sort leftover keys ổn định", () => {
    const groups = createDuplicateDiffGroups(
      {
        raw: "ignore",
        key: "ignore",
        zzz_field: "Z",
        aaa_field: "A",
        agents: [],
      },
      {
        raw_data: "ignore too",
        aaa_field: "A",
        zzz_field: "ZZ",
        agents: [],
      },
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Thông tin khác");
    expect(groups[0].rows.map((row) => row.key)).toEqual(["aaa_field", "zzz_field"]);
    expect(groups[0].rows.map((row) => row.label)).toEqual(["Aaa field", "Zzz field"]);
  });
});
