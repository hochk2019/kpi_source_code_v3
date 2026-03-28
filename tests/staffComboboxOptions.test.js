import { describe, expect, it } from "vitest";

import {
  buildStaffComboboxTeams,
  flattenStaffComboboxMembers,
} from "@/components/shared/staffComboboxOptions.js";

describe("staffComboboxOptions", () => {
  it("normalizes and sorts teams with valid members only", () => {
    const teams = buildStaffComboboxTeams({
      teams: [
        {
          id: "b",
          name: "Tổ nhập khẩu",
          members: [
            { id: "2", name: "Phạm Hải" },
            { id: "1", name: " " },
          ],
        },
        {
          id: "a",
          name: "Tổ thuế A",
          members: [{ id: "3", name: "Nguyễn Văn A" }],
        },
        {
          id: "c",
          name: "",
          members: [{ id: "4", name: "Không hợp lệ" }],
        },
      ],
    });

    expect(teams).toHaveLength(2);
    expect(teams.map((team) => team.name)).toEqual(["Tổ nhập khẩu", "Tổ thuế A"]);
    expect(teams[0].members).toEqual([
      {
        id: "2",
        name: "Phạm Hải",
        normalized: "pham hai",
      },
    ]);
  });

  it("flattens members with team metadata", () => {
    expect(
      flattenStaffComboboxMembers([
        {
          id: "team-a",
          name: "Tổ Thuế A",
          members: [{ id: "mem-1", name: "Nguyễn Văn A" }],
        },
      ]),
    ).toEqual([
      {
        id: "mem-1",
        name: "Nguyễn Văn A",
        teamId: "team-a",
        teamName: "Tổ Thuế A",
        normalizedName: "nguyen van a",
        normalizedTeam: "to thue a",
      },
    ]);
  });
});
