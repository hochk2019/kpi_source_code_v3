import { describe, expect, it } from "vitest";

import {
  buildAggregatedRowsByMST,
  buildDisplayList,
  buildGroupedStages,
  buildTimelineGroupsByMST,
  sortMSTRows,
} from "@/components/mst-assignment/model/displaySelectors.js";

describe("mst assignment display selectors", () => {
  it("sorts rows by MST, effective_from, then effective_to", () => {
    const rows = [
      { mst: "0312", effective_from: "2024-02-01", effective_to: "" },
      { mst: "0311", effective_from: "2024-03-01", effective_to: "" },
      { mst: "0312", effective_from: "2024-01-01", effective_to: "2024-12-31" },
      { mst: "0312", effective_from: "2024-01-01", effective_to: "" },
    ];

    expect(sortMSTRows(rows)).toEqual([
      { mst: "0311", effective_from: "2024-03-01", effective_to: "" },
      { mst: "0312", effective_from: "2024-01-01", effective_to: "2024-12-31" },
      { mst: "0312", effective_from: "2024-01-01", effective_to: "" },
      { mst: "0312", effective_from: "2024-02-01", effective_to: "" },
    ]);
  });

  it("builds grouped stages per MST with sorted stage lists", () => {
    const rows = [
      { mst: "0312", company: "Công ty A", effective_from: "2024-02-01", effective_to: "" },
      { mst: "0311", company: "Công ty B", effective_from: "2024-01-01", effective_to: "" },
      { mst: "0312", company: "Công ty A", effective_from: "2024-01-01", effective_to: "2024-01-31" },
    ];

    expect(buildGroupedStages(rows)).toEqual([
      {
        mst: "0311",
        company: "Công ty B",
        stages: [{ mst: "0311", company: "Công ty B", effective_from: "2024-01-01", effective_to: "" }],
      },
      {
        mst: "0312",
        company: "Công ty A",
        stages: [
          { mst: "0312", company: "Công ty A", effective_from: "2024-01-01", effective_to: "2024-01-31" },
          { mst: "0312", company: "Công ty A", effective_from: "2024-02-01", effective_to: "" },
        ],
      },
    ]);
  });

  it("builds aggregated rows by MST using the active stage when enabled", () => {
    const groupedStages = [
      {
        mst: "0312",
        company: "Công ty A",
        stages: [
          {
            mst: "0312",
            company: "Công ty A",
            person_import: "Lan",
            effective_from: "2024-01-01",
            effective_to: "2024-01-31",
          },
          {
            mst: "0312",
            company: "Công ty A",
            person_import: "Hà",
            effective_from: "2024-02-01",
            effective_to: "",
          },
        ],
      },
    ];

    expect(buildAggregatedRowsByMST(groupedStages, true)).toEqual([
      {
        mst: "0312",
        company: "Công ty A",
        person_import: "Hà",
        effective_from: "2024-02-01",
        effective_to: "",
        __group: true,
      },
    ]);
    expect(buildAggregatedRowsByMST(groupedStages, false)).toEqual([]);
  });

  it("builds display list and timeline map from grouped data", () => {
    const filtered = [{ mst: "0311" }];
    const aggregated = [{ mst: "0312", __group: true }];
    const groupedStages = [
      { mst: "0311", stages: [{ mst: "0311" }] },
      { mst: "", stages: [{ mst: "" }] },
    ];

    expect(buildDisplayList({ groupByMST: false, aggregatedByMST: aggregated, filtered })).toBe(filtered);
    expect(buildDisplayList({ groupByMST: true, aggregatedByMST: aggregated, filtered })).toBe(aggregated);

    const timelineMap = buildTimelineGroupsByMST(groupedStages);
    expect(timelineMap.get("0311")).toEqual(groupedStages[0]);
    expect(timelineMap.get("__unknown")).toEqual(groupedStages[1]);
  });
});
