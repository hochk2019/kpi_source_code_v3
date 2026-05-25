import { describe, expect, it } from "vitest";

import { MST_ASSIGNMENT_STATUS } from "@/lib/store.js";
import { createRowState } from "@/components/mst-assignment/model/createRowState.js";

describe("createRowState", () => {
  it("chuẩn hóa MST, trim chuỗi, và tính trạng thái từ dữ liệu đầu vào", () => {
    expect(
      createRowState({
        mst: " 03-123.456/78 ",
        company: "  Công ty A  ",
        person_import: " Nguyễn Văn A ",
        person_export: " Trần Thị B ",
        team: " Team 01 ",
        effective_from: "2026-03-01",
        effective_to: "2026-03-31",
      })
    ).toEqual({
      mst: "0312345678",
      company: "Công ty A",
      person_import: "Nguyễn Văn A",
      person_export: "Trần Thị B",
      team: "Team 01",
      effective_from: "2026-03-01",
      effective_to: "2026-03-31",
      status: MST_ASSIGNMENT_STATUS.ASSIGNED,
      __originalKey: "0312345678__2026-03-01__2026-03-31",
      __isNew: false,
    });
  });

  it("giữ __originalKey null cho row mới và đánh dấu __isNew", () => {
    expect(
      createRowState(
        {
          mst: "0312",
          company: "Công ty B",
          person_import: "",
          person_export: "",
          team: "",
          effective_from: "2026-04-01",
          effective_to: "",
        },
        { isNew: true }
      )
    ).toMatchObject({
      status: MST_ASSIGNMENT_STATUS.PENDING,
      __originalKey: null,
      __isNew: true,
    });
  });

  it("ưu tiên originalKey truyền vào từ meta", () => {
    expect(
      createRowState(
        {
          mst: "0312",
          company: "Công ty C",
          person_import: "",
          person_export: "",
          team: "",
          effective_from: "2026-05-01",
          effective_to: "",
        },
        { originalKey: "legacy-key" }
      ).__originalKey
    ).toBe("legacy-key");
  });
});
