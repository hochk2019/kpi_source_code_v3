import { describe, expect, it, vi } from "vitest";
import request from "supertest";

import { buildV4App } from "../../server-v4/src/index.ts";
import { mstAssignmentsModule } from "../../server-v4/src/modules/mst-assignments/mst-assignments.module.ts";
import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";

describe("server-v4 postgres MST assignment route wiring", () => {
  it("routes mst-assignment reads through the async persistence seam without requiring a raw sync runtime reader", async () => {
    const mstAssignmentsReader = {
      getSourceKind: () => "dual-write",
      getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
      getLegacyDbFile: () => ":memory:",
      readMstAssignmentRows: vi.fn(async () => [
        {
          mst: "0101234567",
          company: "Cong ty A",
          person_import: "Minh",
          person_export: "Bao",
          team: "Blue Team",
          effective_from: "2026-01-01",
          effective_to: "2026-01-31",
          status: "assigned",
        },
        {
          mst: "0101234567",
          company: "Cong ty A",
          person_import: "Minh",
          person_export: "Bao",
          team: "Blue Team",
          effective_from: "2026-02-01",
          effective_to: "",
          status: "assigned",
        },
      ]),
    };
    const app = buildV4App({
      dbFile: ":memory:",
      modules: [mstAssignmentsModule],
      persistence: {
        mode: "postgres",
        sourceKind: "dual-write",
        declarationsReader: createDeclarationsReader(),
        kpiRulesReader: createKpiRulesReader(),
        mstAssignmentsReader,
        teamsReader: createTeamsReader(),
        projections: createProjectionPersistence(),
        dispose: async () => {},
      },
    });

    const listResponse = await request(app).get("/api/v4/mst-assignments").query({ mst: "0101234567" });
    const resolveResponse = await request(app)
      .get("/api/v4/mst-assignments/resolve")
      .query({ mst: "0101234567", date: "2026-02-15" });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toEqual([
      {
        mst: "0101234567",
        company: "Cong ty A",
        person_import: "Minh",
        person_export: "Bao",
        team: "Blue Team",
        effective_from: "2026-01-01",
        effective_to: "2026-01-31",
        status: "assigned",
      },
      {
        mst: "0101234567",
        company: "Cong ty A",
        person_import: "Minh",
        person_export: "Bao",
        team: "Blue Team",
        effective_from: "2026-02-01",
        effective_to: "",
        status: "assigned",
      },
    ]);
    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body.data.assignment).toEqual({
      mst: "0101234567",
      company: "Cong ty A",
      person_import: "Minh",
      person_export: "Bao",
      team: "Blue Team",
      effective_from: "2026-02-01",
      effective_to: "",
      status: "assigned",
    });
    expect(mstAssignmentsReader.readMstAssignmentRows).toHaveBeenCalledTimes(2);
  });
});

function createDeclarationsReader() {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readDeclarationRows: vi.fn(async () => []),
  };
}

function createKpiRulesReader() {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readRuleCollection: vi.fn(async () => ({})),
  };
}

function createProjectionPersistence() {
  return {
    readValue: async () => null,
    writeValue: async () => {},
    deleteValue: async () => {},
    readMonthlyAggregateEntries: async () => [],
    readJobRunEntries: async () => [],
  };
}

function createTeamsReader() {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readTeamRoster: vi.fn(async () => ({})),
  };
}
