import { describe, expect, it } from "vitest";

import { NoopHqAgenciesAsyncReader } from "../../server-v4/src/modules/hq-agencies/noopHqAgenciesAsyncReader.ts";

describe("server-v4 noop HQ agencies async reader", () => {
  it("defaults to a relational-store no-op surface", async () => {
    const reader = new NoopHqAgenciesAsyncReader();

    expect(reader.getSourceKind()).toBe("relational-store");
    expect(reader.getHotPathKeys()).toEqual([]);
    expect(reader.getLegacyDbFile()).toBeNull();
    await expect(reader.readBindings()).resolves.toEqual([]);
    await expect(reader.readHistoryEntries()).resolves.toEqual([]);
  });

  it("can expose an explicit legacy db file when used as a rollback guardrail", () => {
    const reader = new NoopHqAgenciesAsyncReader({
      legacyDbFile: ":memory:",
      sourceKind: "dual-write",
    });

    expect(reader.getSourceKind()).toBe("dual-write");
    expect(reader.getLegacyDbFile()).toBe(":memory:");
  });
});
