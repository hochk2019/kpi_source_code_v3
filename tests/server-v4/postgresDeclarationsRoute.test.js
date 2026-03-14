import { describe, expect, it, vi } from "vitest";
import request from "supertest";

import {
  ADMIN_ROLE,
  DEFAULT_ROLE,
  MANAGER_ROLE,
  getPermissionTemplate,
} from "../../packages/domain/src/accountRoles.js";
import { buildV4App } from "../../server-v4/src/index.ts";
import { declarationsModule } from "../../server-v4/src/modules/declarations/declarations.module.ts";
import { applyDeclarationPatch } from "../../server-v4/src/modules/declarations/declarationsStore.ts";
import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";

describe("server-v4 postgres declarations route wiring", () => {
  it("routes declaration reads through the async persistence seam without requiring a raw sync runtime reader", async () => {
    const declarationsReader = {
      getSourceKind: () => "dual-write",
      getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
      getLegacyDbFile: () => ":memory:",
      readDeclarationRows: vi.fn(async () => [
        {
          so_tk: "12345ABC",
          branch: "Chi nhanh A",
          mst: "0101234567-1",
          date: "2026/02/14",
          ma_loai_hinh: "A11",
        },
      ]),
    };
    const app = buildV4App({
      dbFile: ":memory:",
      modules: [declarationsModule],
      persistence: {
        mode: "postgres",
        sourceKind: "dual-write",
        declarationsReader,
        kpiRulesReader: createKpiRulesReader(),
        mstAssignmentsReader: createMstAssignmentsReader(),
        teamsReader: createTeamsReader(),
        projections: createProjectionPersistence(),
        dispose: async () => {},
      },
    });

    const response = await request(app).get("/api/v4/declarations").query({ mst: "0101234567" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        total: 1,
        items: [
          expect.objectContaining({
            so_tk: "00000012345",
            nhanh: "Chi nhanh A",
            mst: "01012345671",
            ma_loai_hinh: "A11",
          }),
        ],
      },
    });
    expect(declarationsReader.readDeclarationRows).toHaveBeenCalledTimes(1);
  });

  it("requires an authenticated session for declaration mutations", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        so_tk: "00000012345",
        nhanh: "Chi nhanh A",
      }),
    ]);
    const app = buildV4App({
      modules: [declarationsModule],
      persistence: {
        mode: "postgres",
        sourceKind: "relational-store",
        declarationsReader: runtime.reader,
        declarationsStore: runtime.store,
        authStore: createAuthStore([]),
        dispose: async () => {},
      },
    });

    const listResponse = await request(app).get("/api/v4/declarations");
    const declarationId = listResponse.body.data.items[0].id;

    const response = await request(app)
      .patch(`/api/v4/declarations/${declarationId}`)
      .send({
        teamName: "Blue Team",
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: "auth_required",
    });
  });

  it("owns declaration patch and history routes behind session-backed importEdit permission", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        so_tk: "00000012345",
        nhanh: "Chi nhanh A",
      }),
    ]);
    const authStore = createAuthStore([
      createAccount({
        username: "manager",
        role: MANAGER_ROLE,
        name: "Manager User",
      }),
      createAccount({
        username: "staff",
        role: DEFAULT_ROLE,
        name: "Staff User",
      }),
    ]);
    const app = buildV4App({
      modules: [declarationsModule],
      persistence: {
        mode: "postgres",
        sourceKind: "relational-store",
        declarationsReader: runtime.reader,
        declarationsStore: runtime.store,
        authStore,
        dispose: async () => {},
      },
    });

    const listResponse = await request(app).get("/api/v4/declarations");
    const declarationId = listResponse.body.data.items[0].id;

    const forbiddenResponse = await request(app)
      .patch(`/api/v4/declarations/${declarationId}`)
      .set("Cookie", "kpi_session=session-staff")
      .send({
        teamName: "Forbidden Team",
      });

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error).toMatchObject({
      code: "forbidden",
    });

    const updateResponse = await request(app)
      .patch(`/api/v4/declarations/${declarationId}`)
      .set("Cookie", "kpi_session=session-manager")
      .send({
        staffName: "Tran Thi Lan",
        teamName: "Blue Team",
        agencyText: "Agency B",
        licenseManualCount: 2,
        licenseSourceCodes: ["GP01", "ZN02"],
        licenseExcludedCodes: ["ZN02"],
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data).toMatchObject({
      nhan_vien: "Tran Thi Lan",
      team: "Blue Team",
      agency: "Agency B",
      dai_ly: "Agency B",
      licenses: 2,
      so_luong_gp: 2,
      licenseManualCount: 2,
      licenseCodes: ["GP01"],
      licenseSourceCodes: ["GP01", "ZN02"],
      licenseExcludedCodes: ["ZN02"],
    });
    expect(runtime.store.patchDeclaration).toHaveBeenCalledTimes(1);

    const eventsResponse = await request(app).get(`/api/v4/declarations/${declarationId}/events`);

    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.body.data.total).toBe(1);
    expect(eventsResponse.body.data.items).toEqual([
      expect.objectContaining({
        kind: "update",
        actor: "manager",
        changes: expect.arrayContaining([
          expect.objectContaining({ field: "nhan_vien", after: "Tran Thi Lan" }),
          expect.objectContaining({ field: "team", after: "Blue Team" }),
          expect.objectContaining({ field: "agency", after: "Agency B" }),
          expect.objectContaining({ field: "licenses", after: "2" }),
          expect.objectContaining({ field: "licenseSourceCodes", after: "GP01, ZN02" }),
          expect.objectContaining({ field: "licenseExcludedCodes", after: "ZN02" }),
        ]),
      }),
    ]);
  });

  it("blocks reviewed declarations for managers and allows admin override", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        so_tk: "00000099999",
        nhanh: "Chi nhanh B",
        reviewed: true,
      }),
    ]);
    const authStore = createAuthStore([
      createAccount({
        username: "manager",
        role: MANAGER_ROLE,
        name: "Manager User",
      }),
      createAccount({
        username: "admin",
        role: ADMIN_ROLE,
        name: "Admin User",
      }),
    ]);
    const app = buildV4App({
      modules: [declarationsModule],
      persistence: {
        mode: "postgres",
        sourceKind: "relational-store",
        declarationsReader: runtime.reader,
        declarationsStore: runtime.store,
        authStore,
        dispose: async () => {},
      },
    });

    const listResponse = await request(app)
      .get("/api/v4/declarations")
      .query({ soTk: "00000099999" });
    const declarationId = listResponse.body.data.items[0].id;

    const managerResponse = await request(app)
      .patch(`/api/v4/declarations/${declarationId}`)
      .set("Cookie", "kpi_session=session-manager")
      .send({
        teamName: "Blocked Team",
      });

    expect(managerResponse.status).toBe(409);
    expect(managerResponse.body.error).toMatchObject({
      code: "review_locked",
    });

    const adminResponse = await request(app)
      .patch(`/api/v4/declarations/${declarationId}`)
      .set("Cookie", "kpi_session=session-admin")
      .send({
        teamName: "Admin Override Team",
      });

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data).toMatchObject({
      team: "Admin Override Team",
      team_name_snapshot: "Admin Override Team",
    });
  });
});

function createDeclarationsRuntimeStub(seedRows) {
  const rows = seedRows.map((row) => clone(row));
  const eventMap = new Map();

  return {
    reader: {
      getSourceKind: () => "relational-store",
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readDeclarationRows: vi.fn(async () => rows.map((row) => clone(row))),
    },
    store: {
      patchDeclaration: vi.fn(async (target, normalizedPatch, actor) => {
        const index = rows.findIndex(
          (row) => `${row.so_tk ?? ""}_${row.nhanh ?? row.branch ?? ""}` === target.key,
        );
        const current = index === -1 ? clone(target.current) : clone(rows[index]);
        const result = applyDeclarationPatch(current, normalizedPatch);
        const nextRow = {
          ...clone(result.nextRecord),
          declaration_id: current.declaration_id ?? target.declarationId ?? `decl-${target.key}`,
        };

        if (index >= 0) {
          rows[index] = clone(nextRow);
        }

        if (result.historyChanges.length > 0) {
          const currentEvents = eventMap.get(target.key) ?? [];
          currentEvents.unshift({
            id: `evt-${currentEvents.length + 1}`,
            kind: "update",
            timestamp: nextRow.updatedAt,
            actor: actor.username,
            changes: result.historyChanges,
          });
          eventMap.set(target.key, currentEvents);
        }

        return clone(nextRow);
      }),
      listDeclarationEvents: vi.fn(async (target) => clone(eventMap.get(target.key) ?? [])),
    },
  };
}

function createDeclarationRow(overrides = {}) {
  return {
    declaration_id: "decl-1",
    so_tk: "00000012345",
    nhanh: "Chi nhanh A",
    mst: "01012345671",
    date: "2026-02-14",
    ma_loai_hinh: "A11",
    reviewed: false,
    nhan_vien: "Lan",
    staff_name_snapshot: "Lan",
    team: "Red Team",
    team_name_snapshot: "Red Team",
    agency: "Agency A",
    dai_ly: "Agency A",
    agency_text: "Agency A",
    licenses: 1,
    so_luong_gp: 1,
    licenseManualCount: 1,
    license_count: 1,
    licenseCodes: ["GP01"],
    licenseSourceCodes: ["GP01"],
    licenseExcludedCodes: [],
    ...overrides,
  };
}

function createMstAssignmentsReader() {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readMstAssignmentRows: vi.fn(async () => []),
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

function createTeamsReader() {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readTeamRoster: vi.fn(async () => ({})),
  };
}

function createProjectionPersistence() {
  return {
    readValue: async () => null,
    writeValue: async () => {},
    deleteValue: async () => {},
    readScheduleEntries: async () => [],
    readMonthlyAggregateEntries: async () => [],
    readJobRunEntries: async () => [],
  };
}

function createAuthStore(accounts) {
  const sessions = new Map([
    [
      "session-manager",
      {
        token: "session-manager",
        username: "manager",
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
    ],
    [
      "session-staff",
      {
        token: "session-staff",
        username: "staff",
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
    ],
    [
      "session-admin",
      {
        token: "session-admin",
        username: "admin",
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
    ],
  ]);

  return {
    async listAccounts() {
      return clone(accounts);
    },
    async saveAccounts() {},
    async readSession(token) {
      return clone(sessions.get(token) ?? null);
    },
    async createSession(username) {
      const session = {
        token: `session-${username}`,
        username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      };
      sessions.set(session.token, session);
      return clone(session);
    },
    async deleteSession(token) {
      sessions.delete(token);
    },
    async deleteSessionsForUser(username) {
      for (const [token, session] of sessions.entries()) {
        if (session.username === username) {
          sessions.delete(token);
        }
      }
    },
  };
}

function createAccount({ username, role, name }) {
  return {
    username,
    passwordHash: "unused-for-route-tests",
    role,
    name,
    permissions: getPermissionTemplate(role),
    memberId: null,
    memberName: null,
    teamId: null,
    teamName: null,
    updatedAt: "2026-03-14T00:00:00.000Z",
  };
}

function clone(value) {
  return value === null ? null : JSON.parse(JSON.stringify(value));
}
