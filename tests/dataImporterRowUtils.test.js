import { describe, expect, it } from "vitest";

import {
  buildRosterTeams,
  collectEditableDiff,
} from "@/components/dataImporter/dataImporterRowUtils.js";

describe("dataImporterRowUtils", () => {
  it("gom diff chỉ cho các field editable thay đổi", () => {
    const baseline = {
      nhan_vien: "Nguyễn Văn A",
      team: "Tổ 1",
      agency: "Đại lý A",
      licenses: ["GP1"],
      licenseSourceCodes: ["HS"],
      untouched: "keep",
    };
    const current = {
      nhan_vien: "Nguyễn Văn B",
      team: "Tổ 1",
      agency: "Đại lý A",
      licenses: ["GP1", "GP2"],
      licenseSourceCodes: ["HS", "C/O"],
      untouched: "changed",
    };

    expect(collectEditableDiff(baseline, current)).toEqual({
      nhan_vien: "Nguyễn Văn B",
      licenses: ["GP1", "GP2"],
      licenseSourceCodes: ["HS", "C/O"],
    });
  });

  it("trả về null khi không có thay đổi editable hoặc dữ liệu đầu vào không hợp lệ", () => {
    expect(collectEditableDiff(null, {})).toBeNull();
    expect(
      collectEditableDiff(
        {
          nhan_vien: "Nguyễn Văn A",
          team: "Tổ 1",
        },
        {
          nhan_vien: "  Nguyễn Văn A  ",
          team: "Tổ 1",
        },
      ),
    ).toBeNull();
  });

  it("chuẩn hóa danh sách tổ đội và thành viên từ roster snapshot", () => {
    expect(
      buildRosterTeams({
        teams: [
          {
            id: "team-b",
            name: "Tổ B",
            members: [
              { id: "m2", name: "Bình" },
              { id: "m1", name: "An" },
              { id: "m3", name: "" },
            ],
          },
          {
            id: "team-a",
            name: " Tổ A ",
            members: [{ id: "m4", name: "Zed" }],
          },
          {
            id: "team-empty",
            name: " ",
            members: [{ id: "m5", name: "Bỏ qua" }],
          },
        ],
      }),
    ).toEqual([
      {
        id: "team-a",
        name: "Tổ A",
        normalized: "to a",
        members: [{ id: "m4", name: "Zed", normalized: "zed" }],
      },
      {
        id: "team-b",
        name: "Tổ B",
        normalized: "to b",
        members: [
          { id: "m1", name: "An", normalized: "an" },
          { id: "m2", name: "Bình", normalized: "binh" },
        ],
      },
    ]);
  });
});
