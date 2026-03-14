import { describe, expect, it, vi } from "vitest";
import request from "supertest";

import { buildV4App } from "../../server-v4/src/index.ts";
import { reportingModule } from "../../server-v4/src/modules/reporting/reporting.module.ts";
import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";

describe("server-v4 postgres reporting input wiring", () => {
  it("routes reporting declarations, rules, adjustments, and teams through the async persistence seams without requiring a raw sync runtime reader", async () => {
    const adjustmentsReader = {
      getSourceKind: () => "dual-write",
      getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
      getLegacyDbFile: () => ":memory:",
      readAdjustmentRows: vi.fn(async () => [
        {
          id: "adj-1",
          month: "2026-02",
          category: "bonus",
          staffName: "Lan",
          teamName: "Blue Team",
          status: "approved",
          totalPoints: 3,
        },
      ]),
    };
    const declarationsReader = {
      getSourceKind: () => "dual-write",
      getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
      getLegacyDbFile: () => ":memory:",
      readDeclarationRows: vi.fn(async () => [
        {
          date: "2026-02-14",
          so_tk: "TK-POSTGRES",
          loai_hinh: "A11",
          nhan_vien: "Lan",
          team: "Blue Team",
          num_items: 1,
        },
      ]),
    };
    const teamsReader = {
      getSourceKind: () => "dual-write",
      getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
      getLegacyDbFile: () => ":memory:",
      readTeamRoster: vi.fn(async () => ({
        version: 1,
        teams: [
          {
            id: "team-blue-team",
            name: "Blue Team",
            members: [{ id: "team-blue-team-lan", name: "Lan" }],
          },
        ],
      })),
    };
    const kpiRulesReader = {
      getSourceKind: () => "dual-write",
      getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
      getLegacyDbFile: () => ":memory:",
      readRuleCollection: vi.fn(async () => ({
        version: 2,
        activeId: "postgres-kpi",
        sets: [
          {
            id: "postgres-kpi",
            name: "Postgres KPI",
            groups: {
              group1: {
                key: "group1",
                title: "Nhom 1",
                codes: ["A11"],
              },
            },
          },
        ],
      })),
    };
    const projections = createProjectionPersistence();
    const app = buildV4App({
      dbFile: ":memory:",
      modules: [reportingModule],
      persistence: {
        mode: "postgres",
        sourceKind: "dual-write",
        adjustmentsReader,
        declarationsReader,
        kpiRulesReader,
        mstAssignmentsReader: createMstAssignmentsReader(),
        teamsReader,
        projections,
        dispose: async () => {},
      },
    });

    const response = await request(app)
      .get("/api/v4/reporting/aggregates/monthly")
      .query({ from: "2026-02-01", to: "2026-02-28" });

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items[0].period).toBe("2026-02");
    expect(response.body.data.items[0].topTeams).toEqual([
      expect.objectContaining({
        name: "Blue Team",
      }),
    ]);
    expect(response.body.data.items[0].topStaff).toEqual([
      expect.objectContaining({
        name: "Lan",
        teamLabel: "Blue Team",
      }),
    ]);
    expect(adjustmentsReader.readAdjustmentRows).toHaveBeenCalledTimes(1);
    expect(declarationsReader.readDeclarationRows).toHaveBeenCalledTimes(1);
    expect(kpiRulesReader.readRuleCollection).toHaveBeenCalledTimes(1);
    expect(teamsReader.readTeamRoster).toHaveBeenCalledTimes(1);
    expect(projections.writeValue).toHaveBeenCalled();
  });
});

function createMstAssignmentsReader() {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readMstAssignmentRows: vi.fn(async () => []),
  };
}

function createProjectionPersistence() {
  return {
    readValue: async () => null,
    writeValue: vi.fn(async () => {}),
    deleteValue: async () => {},
    readScheduleEntries: async () => [],
    readMonthlyAggregateEntries: async () => [],
    readJobRunEntries: async () => [],
  };
}
