import { describe, expect, it } from "vitest";

import { NoopBusinessSnapshotReader } from "../../server-v4/src/persistence/noopBusinessSnapshotReader.ts";

describe("server-v4 noop business snapshot reader", () => {
  it("defaults to a relational-store source with no legacy compatibility payloads", () => {
    const reader = new NoopBusinessSnapshotReader();

    expect(reader.getSourceKind()).toBe("relational-store");
    expect(reader.getHotPathKeys()).toEqual([]);
    expect(reader.getLegacyDbFile()).toBeNull();
    expect(reader.readDeclarationRows()).toEqual([]);
    expect(reader.readMstAssignmentRows()).toEqual([]);
    expect(reader.readTeamRoster()).toEqual({});
    expect(reader.readRuleCollection()).toEqual({});
    expect(reader.readAdjustmentRows()).toEqual([]);
    expect(reader.readReportSchedules()).toEqual([]);
    expect(reader.readMonthlyAggregateSnapshot()).toBeNull();
    expect(reader.readDefaultMonthlyAggregateSnapshot()).toBeNull();
  });

  it("allows the compatibility sourceKind to be overridden when needed", () => {
    const reader = new NoopBusinessSnapshotReader({ sourceKind: "dual-write" });

    expect(reader.getSourceKind()).toBe("dual-write");
  });
});
