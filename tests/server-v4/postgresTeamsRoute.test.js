import { describe, expect, it, vi } from "vitest";
import request from "supertest";

import {
  DEFAULT_ROLE,
  MANAGER_ROLE,
  getPermissionTemplate,
} from "../../packages/domain/src/accountRoles.js";
import { buildV4App } from "../../server-v4/src/index.ts";
import { teamsModule } from "../../server-v4/src/modules/teams/teams.module.ts";
import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";

describe("server-v4 postgres teams route wiring", () => {
  it("routes team roster reads through the async persistence seam without requiring a raw sync runtime reader", async () => {
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
            members: [
              { id: "team-blue-team-lan", name: "Lan" },
              { id: "custom-member", name: "Minh", notes: "Lead" },
            ],
          },
        ],
      })),
    };
    const app = buildV4App({
      dbFile: ":memory:",
      modules: [teamsModule],
      persistence: {
        mode: "postgres",
        sourceKind: "dual-write",
        declarationsReader: createDeclarationsReader(),
        kpiRulesReader: createKpiRulesReader(),
        mstAssignmentsReader: createMstAssignmentsReader(),
        teamsReader,
        projections: createProjectionPersistence(),
        dispose: async () => {},
      },
    });

    const response = await request(app).get("/api/v4/teams");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        version: 1,
        teams: [
          {
            id: "team-blue-team",
            memberCount: 2,
            members: [
              { id: "team-blue-team-lan", name: "Lan" },
              { id: "custom-member", name: "Minh", notes: "Lead" },
            ],
            name: "Blue Team",
          },
        ],
      },
    });
    expect(teamsReader.readTeamRoster).toHaveBeenCalledTimes(1);
  });

  it("requires an authenticated session for team roster mutations", async () => {
    const runtime = createTeamsRuntimeStub();
    const app = buildV4App({
      modules: [teamsModule],
      persistence: {
        mode: "postgres",
        sourceKind: "relational-store",
        teamsReader: runtime.reader,
        teamsStore: runtime.store,
        authStore: createAuthStore([]),
        dispose: async () => {},
      },
    });

    const response = await request(app).put("/api/v4/teams").send({
      version: 1,
      teams: [],
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: "auth_required",
    });
  });

  it("owns full-roster replacement behind session-backed teamsEdit permission", async () => {
    const runtime = createTeamsRuntimeStub({
      version: 1,
      teams: [
        {
          id: "team-red-team",
          name: "Red Team",
          members: [{ id: "team-red-team-hoa", name: "Hoa" }],
        },
      ],
    });
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
      modules: [teamsModule],
      persistence: {
        mode: "postgres",
        sourceKind: "relational-store",
        teamsReader: runtime.reader,
        teamsStore: runtime.store,
        authStore,
        dispose: async () => {},
      },
    });

    const forbiddenResponse = await request(app)
      .put("/api/v4/teams")
      .set("Cookie", "kpi_session=session-staff")
      .send({
        version: 1,
        teams: [{ name: "Forbidden Team", members: [] }],
      });

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error).toMatchObject({
      code: "forbidden",
    });

    const replaceResponse = await request(app)
      .put("/api/v4/teams")
      .set("Cookie", "kpi_session=session-manager")
      .send({
        version: 1,
        teams: [
          {
            name: "Blue Team",
            members: [
              { name: "Minh", notes: "Lead" },
              { id: "custom-member", name: "Lan" },
            ],
          },
          {
            id: "ops",
            name: "Operations",
            members: [{ name: "Dung" }],
          },
        ],
      });

    expect(replaceResponse.status).toBe(200);
    expect(replaceResponse.body).toEqual({
      ok: true,
      data: {
        version: 1,
        teams: [
          {
            id: "team-blue-team",
            name: "Blue Team",
            memberCount: 2,
            members: [
              { id: "custom-member", name: "Lan" },
              { id: "team-blue-team-minh", name: "Minh", notes: "Lead" },
            ],
          },
          {
            id: "team-ops",
            name: "Operations",
            memberCount: 1,
            members: [{ id: "team-ops-dung", name: "Dung" }],
          },
        ],
      },
    });
    expect(runtime.store.writeRoster).toHaveBeenCalledTimes(1);
    expect(runtime.store.writeRoster.mock.calls[0][0]).toEqual({
      version: 1,
      teams: [
        {
          id: "team-blue-team",
          name: "Blue Team",
          members: [
            { id: "custom-member", name: "Lan" },
            { id: "team-blue-team-minh", name: "Minh", notes: "Lead" },
          ],
        },
        {
          id: "team-ops",
          name: "Operations",
          members: [{ id: "team-ops-dung", name: "Dung" }],
        },
      ],
    });

    const listResponse = await request(app).get("/api/v4/teams");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual(replaceResponse.body);
    expect(runtime.reader.readTeamRoster).toHaveBeenCalledTimes(1);
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

function createProjectionPersistence() {
  return {
    readValue: async () => null,
    writeValue: async () => {},
    deleteValue: async () => {},
    readMonthlyAggregateEntries: async () => [],
    readJobRunEntries: async () => [],
  };
}

function createTeamsRuntimeStub(initialRoster = { version: 1, teams: [] }) {
  let roster = clone(initialRoster);

  return {
    reader: {
      getSourceKind: () => "relational-store",
      getHotPathKeys: () => [],
      getLegacyDbFile: () => null,
      readTeamRoster: vi.fn(async () => clone(roster)),
    },
    store: {
      writeRoster: vi.fn(async (nextRoster) => {
        roster = clone(nextRoster);
        return clone(roster);
      }),
    },
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
