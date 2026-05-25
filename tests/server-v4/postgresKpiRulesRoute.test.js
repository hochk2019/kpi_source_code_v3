import { describe, expect, it, vi } from "vitest";
import request from "supertest";

import {
  DEFAULT_ROLE,
  MANAGER_ROLE,
  getPermissionTemplate,
} from "../../packages/domain/src/accountRoles.js";
import { buildV4App } from "../../server-v4/src/index.ts";
import { kpiRulesModule } from "../../server-v4/src/modules/kpi-rules/kpi-rules.module.ts";
import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";

describe("server-v4 postgres KPI rules route wiring", () => {
  it("routes KPI rules through the async persistence seam without requiring a raw sync runtime reader", async () => {
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
    const app = buildV4App({
      dbFile: ":memory:",
      modules: [kpiRulesModule],
      persistence: {
        mode: "postgres",
        sourceKind: "dual-write",
        declarationsReader: createDeclarationsReader(),
        kpiRulesReader,
        kpiRulesStore: createKpiRulesStoreStub(),
        mstAssignmentsReader: createMstAssignmentsReader(),
        teamsReader: createTeamsReader(),
        projections: createProjectionPersistence(),
        dispose: async () => {},
      },
    });

    const response = await request(app).get("/api/v4/kpi-rules");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        version: 2,
        activeId: "postgres-kpi",
        ruleSetCount: 1,
        sets: [
          expect.objectContaining({
            id: "postgres-kpi",
            name: "Postgres KPI",
          }),
        ],
      },
    });
    expect(kpiRulesReader.readRuleCollection).toHaveBeenCalledTimes(1);
  });

  it("requires an authenticated session for KPI rule mutations", async () => {
    const app = buildV4App({
      modules: [kpiRulesModule],
      persistence: {
        mode: "postgres",
        sourceKind: "relational-store",
        kpiRulesReader: createKpiRulesReaderStub(),
        kpiRulesStore: createKpiRulesStoreStub(),
        authStore: createAuthStore([]),
        dispose: async () => {},
      },
    });

    const response = await request(app).post("/api/v4/kpi-rules").send({
      name: "March Draft",
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: "auth_required",
    });
  });

  it("owns KPI rule-set draft creation and activation behind session-backed rulesEdit permission", async () => {
    const store = createKpiRulesStoreStub();
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
      modules: [kpiRulesModule],
      persistence: {
        mode: "postgres",
        sourceKind: "relational-store",
        kpiRulesReader: createKpiRulesReaderStub(),
        kpiRulesStore: store,
        authStore,
        dispose: async () => {},
      },
    });

    const forbiddenResponse = await request(app)
      .post("/api/v4/kpi-rules")
      .set(sessionHeaders("session-staff"))
      .send({
        name: "Forbidden Draft",
      });

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error).toMatchObject({
      code: "forbidden",
    });

    const createResponse = await request(app)
      .post("/api/v4/kpi-rules")
      .set(sessionHeaders("session-manager"))
      .send({
        name: "March Draft",
        description: "Draft for March KPI rollout",
        applyFrom: "2026-03-15",
        groups: {
          group1: {
            title: "March Group 1",
          },
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).toMatchObject({
      activeId: "postgres-kpi",
      ruleSetCount: 2,
      ruleSet: expect.objectContaining({
        id: expect.any(String),
        name: "March Draft",
        description: "Draft for March KPI rollout",
        applyFrom: "2026-03-15T00:00:00.000Z",
      }),
    });
    expect(store.writeRuleCollection).toHaveBeenCalledTimes(1);
    expect(store.writeRuleCollection.mock.calls[0][0]).toMatchObject({
      activeId: "postgres-kpi",
      sets: expect.arrayContaining([
        expect.objectContaining({
          id: createResponse.body.data.ruleSet.id,
          name: "March Draft",
        }),
      ]),
    });

    const activateResponse = await request(app)
      .post(`/api/v4/kpi-rules/${createResponse.body.data.ruleSet.id}/activate`)
      .set(sessionHeaders("session-manager"))
      .send({});

    expect(activateResponse.status).toBe(200);
    expect(activateResponse.body.data).toMatchObject({
      activeId: createResponse.body.data.ruleSet.id,
      ruleSetCount: 2,
    });
    expect(store.writeRuleCollection).toHaveBeenCalledTimes(2);
    expect(store.writeRuleCollection.mock.calls[1][0]).toMatchObject({
      activeId: createResponse.body.data.ruleSet.id,
    });
  });
});

const TEST_CSRF_TOKEN = "test-csrf-token";

function sessionHeaders(sessionToken) {
  return {
    Cookie: `kpi_session=${sessionToken}; kpi_csrf=${TEST_CSRF_TOKEN}`,
    "X-CSRF-Token": TEST_CSRF_TOKEN,
  };
}
function createDeclarationsReader() {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readDeclarationRows: vi.fn(async () => []),
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

function createKpiRulesReaderStub() {
  return {
    getSourceKind: () => "relational-store",
    getHotPathKeys: () => [],
    getLegacyDbFile: () => null,
    readRuleCollection: vi.fn(async () => ({
      version: 2,
      activeId: "postgres-kpi",
      sets: [
        {
          id: "postgres-kpi",
          name: "Postgres KPI",
          description: "Current active rules",
          applyFrom: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T09:00:00.000Z",
          groups: {
            group1: {
              key: "group1",
              title: "Nhom 1",
              description: "",
              codes: ["A11"],
              base: 0.5,
              perItem: 0.2,
              tierMode: "per_item",
              tiers: [],
            },
          },
          license: {
            defaultPoints: 0,
            codePoints: [],
            exclude: {
              codes: [],
              agencies: [],
            },
          },
          bonuses: {
            co: {
              enabled: false,
              label: "C/O",
              points: 0,
              perLine: 0,
            },
          },
        },
      ],
    })),
  };
}

function createKpiRulesStoreStub() {
  let collection = null;

  return {
    writeRuleCollection: vi.fn(async (nextCollection) => {
      collection = clone(nextCollection);
      return clone(collection);
    }),
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

