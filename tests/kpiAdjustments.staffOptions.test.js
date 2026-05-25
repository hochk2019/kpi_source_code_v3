import { describe, expect, it } from "vitest";

import { buildStaffOptions } from "@/components/kpi-adjustments/model/staffOptions.js";

describe("kpi adjustment staff option builder", () => {
  it("returns an empty list for invalid rosters", () => {
    expect(buildStaffOptions(null)).toEqual([]);
    expect(buildStaffOptions({ teams: null })).toEqual([]);
  });

  it("flattens teams and trims valid member names", () => {
    expect(
      buildStaffOptions({
        teams: [
          {
            name: "Team 1",
            members: [{ name: " Lan " }, { name: "" }, { name: null }],
          },
          {
            name: "Team 2",
            members: [{ name: "Bình" }],
          },
        ],
      }),
    ).toEqual([
      { team: "Team 1", name: "Lan" },
      { team: "Team 2", name: "Bình" },
    ]);
  });
});
