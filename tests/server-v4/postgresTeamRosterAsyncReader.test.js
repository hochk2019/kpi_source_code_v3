import { describe, expect, it, vi } from "vitest";

import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";
import { PostgresTeamRosterAsyncReader } from "../../server-v4/src/modules/teams/postgresTeamRosterAsyncReader.ts";

describe("server-v4 postgres team roster async reader", () => {
  it("maps the relational roster snapshot onto the legacy-compatible team roster shape", async () => {
    const fallbackReader = createFallbackReader({
      version: 1,
      teams: [{ name: "Blob Team", members: [{ name: "Blob User" }] }],
    });
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: "team-row-1", legacy_team_id: "team-blue-team", name: "Blue Team" }],
        })
        .mockResolvedValueOnce({
          rows: [
            { team_id: "team-row-1", legacy_member_id: "team-blue-team-lan", full_name: "Lan", notes: "" },
            { team_id: "team-row-1", legacy_member_id: "custom-member", full_name: "Minh", notes: "Lead" },
          ],
        }),
    };
    const reader = new PostgresTeamRosterAsyncReader(fallbackReader, pool, {
      sourceKind: "dual-write",
    });

    await expect(reader.readTeamRoster()).resolves.toEqual({
      version: 1,
      teams: [
        {
          id: "team-blue-team",
          name: "Blue Team",
          members: [
            { id: "team-blue-team-lan", name: "Lan" },
            { id: "custom-member", name: "Minh", notes: "Lead" },
          ],
        },
      ],
    });
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(fallbackReader.readTeamRoster).not.toHaveBeenCalled();
  });

  it("returns an empty canonical roster in relational-store mode when postgres has no active team rows", async () => {
    const fallbackReader = createFallbackReader({
      version: 1,
      teams: [{ name: "Legacy Team", members: [{ name: "Legacy User" }] }],
    });
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    const reader = new PostgresTeamRosterAsyncReader(fallbackReader, pool, {
      sourceKind: "relational-store",
    });

    await expect(reader.readTeamRoster()).resolves.toEqual({
      version: 1,
      teams: [],
    });
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(fallbackReader.readTeamRoster).not.toHaveBeenCalled();
  });

  it("falls back to the compatibility reader in dual-write mode when postgres has no active team rows", async () => {
    const fallbackRoster = {
      version: 1,
      teams: [{ name: "Typed Blue Team", members: [{ name: "Lan" }] }],
    };
    const fallbackReader = createFallbackReader(fallbackRoster);
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    const reader = new PostgresTeamRosterAsyncReader(fallbackReader, pool, {
      sourceKind: "dual-write",
    });

    await expect(reader.readTeamRoster()).resolves.toEqual(fallbackRoster);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(fallbackReader.readTeamRoster).toHaveBeenCalledTimes(1);
  });

  it("falls back to the SQLite compatibility reader when the relational roster query fails", async () => {
    const fallbackRoster = {
      version: 1,
      teams: [{ name: "Typed Blue Team", members: [{ name: "Lan" }] }],
    };
    const fallbackReader = createFallbackReader(fallbackRoster);
    const pool = {
      query: vi.fn(async () => {
        throw new Error("connection refused");
      }),
    };
    const reader = new PostgresTeamRosterAsyncReader(fallbackReader, pool);

    await expect(reader.readTeamRoster()).resolves.toEqual(fallbackRoster);
    expect(fallbackReader.readTeamRoster).toHaveBeenCalledTimes(1);
  });
});

function createFallbackReader(roster) {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readTeamRoster: vi.fn(async () => roster),
  };
}
