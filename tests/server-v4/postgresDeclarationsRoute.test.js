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

  it("requires an authenticated session for ECUS import mutations when no bridge token is supplied", async () => {
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

    const previewResponse = await request(app)
      .post("/api/v4/declarations/imports/ecus-preview")
      .send({ rawRows: [] });

    expect(previewResponse.status).toBe(401);
    expect(previewResponse.body.error).toMatchObject({
      code: "auth_required",
    });

    const commitResponse = await request(app)
      .post("/api/v4/declarations/imports/ecus-commit")
      .send({ rawRows: [] });

    expect(commitResponse.status).toBe(401);
    expect(commitResponse.body.error).toMatchObject({
      code: "auth_required",
    });
  });

  it("supports detached ECUS commit via async job polling", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        declaration_id: "decl-existing",
        so_tk: "00000012345",
        so_tk_full: "12345",
        nhanh: "Chi nhanh A",
        date: "2026-02-14",
        mst: "01012345671",
        ma_loai_hinh: "A11",
        licenses: 0,
        so_luong_gp: 0,
        licenseManualCount: 0,
        license_count: 0,
        licenseCodes: [],
        licenseSourceCodes: [],
        agency: "",
        dai_ly: "",
        agency_text: "",
        nhan_vien: "",
        staff_name_snapshot: "",
        team: "",
        team_name_snapshot: "",
      }),
    ]);
    const authStore = createAuthStore([
      createAccount({
        username: "manager",
        role: MANAGER_ROLE,
        name: "Manager User",
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

    const asyncStart = await request(app)
      .post("/api/v4/declarations/imports/ecus-commit")
      .set(sessionHeaders("session-manager"))
      .send({
        async: true,
        rawRows: [
          {
            so_tk: "12345",
            nhanh: "Chi nhanh A",
            mst: "0101234567-1",
            date: "2026/02/14",
            loai_hinh: "A11",
            num_items: 5,
            license_codes: ["GP01", "ZN02"],
            agency: "Agency B",
            nhan_vien: "Tran Thi Lan",
            team: "Blue Team",
          },
        ],
        fetchedTotal: 1,
        reason: "manual",
      });

    expect(asyncStart.status).toBe(200);
    expect(asyncStart.body).toEqual({
      ok: true,
      job: expect.objectContaining({
        id: expect.any(String),
        status: expect.stringMatching(/^(queued|running|completed)$/),
        actor: "manager",
      }),
    });

    const jobId = asyncStart.body.job.id;
    let finalJobPayload = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const jobResponse = await request(app)
        .get(`/api/v4/declarations/imports/ecus-jobs/${jobId}`)
        .set(sessionHeaders("session-manager"));

      expect(jobResponse.status).toBe(200);
      expect(jobResponse.body?.ok).toBe(true);
      const status = jobResponse.body?.job?.status;
      if (status === "completed") {
        finalJobPayload = jobResponse.body.job;
        break;
      }
      if (status === "failed") {
        throw new Error(`Detached ECUS job failed unexpectedly: ${jobResponse.body?.job?.error?.message ?? "unknown"}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(finalJobPayload).toMatchObject({
      status: "completed",
      result: expect.objectContaining({
        fetched: 1,
        skipped: 0,
        reviewLocked: 0,
        actor: "manager",
      }),
    });
    expect((finalJobPayload?.result?.imported ?? 0) + (finalJobPayload?.result?.updated ?? 0)).toBe(1);
    expect(runtime.store.commitImportedDeclarations).toHaveBeenCalledTimes(1);
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
      .set(sessionHeaders("session-staff"))
      .send({
        teamName: "Forbidden Team",
      });

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error).toMatchObject({
      code: "forbidden",
    });

    const updateResponse = await request(app)
      .patch(`/api/v4/declarations/${declarationId}`)
      .set(sessionHeaders("session-manager"))
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

  it("owns ECUS import preview and commit routes behind session-backed syncManage permission", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        declaration_id: "decl-existing",
        so_tk: "00000012345",
        so_tk_full: "12345",
        nhanh: "Chi nhanh A",
        date: "2026-02-14",
        mst: "01012345671",
        ma_loai_hinh: "A11",
        licenses: 0,
        so_luong_gp: 0,
        licenseManualCount: 0,
        license_count: 0,
        licenseCodes: [],
        licenseSourceCodes: [],
        agency: "",
        dai_ly: "",
        agency_text: "",
        nhan_vien: "",
        staff_name_snapshot: "",
        team: "",
        team_name_snapshot: "",
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
    const rawRows = [
      {
        so_tk: "12345",
        nhanh: "Chi nhanh A",
        mst: "0101234567-1",
        date: "2026/02/14",
        loai_hinh: "A11",
        num_items: 5,
        license_codes: ["GP01", "ZN02"],
        agency: "Agency B",
        nhan_vien: "Tran Thi Lan",
        team: "Blue Team",
      },
      {
        so_tk: "99999",
        nhanh: "Chi nhanh B",
        mst: "0109999999",
        date: "2026-02-21",
        loai_hinh: "B11",
        num_items: 2,
        license_codes: ["GP77"],
        agency: "Agency C",
        nhan_vien: "Le Van New",
        team: "Green Team",
      },
    ];

    const forbiddenPreview = await request(app)
      .post("/api/v4/declarations/imports/ecus-preview")
      .set(sessionHeaders("session-staff"))
      .send({ rawRows });

    expect(forbiddenPreview.status).toBe(403);
    expect(forbiddenPreview.body.error).toMatchObject({
      code: "forbidden",
    });

    const previewResponse = await request(app)
      .post("/api/v4/declarations/imports/ecus-preview")
      .set(sessionHeaders("session-manager"))
      .send({ rawRows, limit: 10 });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body).toEqual({
      ok: true,
      preview: {
        rows: [
          expect.objectContaining({
            so_tk: "00000012345",
            nhanh: "Chi nhanh A",
            status: "existing",
            locked: false,
            changedFields: expect.arrayContaining(["licenseCodes", "agency", "nhan_vien", "team"]),
            licenseCodes: ["GP01", "ZN02"],
            licenseSourceCodes: ["GP01", "ZN02"],
            licenseExcludedCodes: [],
            licenses: 2,
            so_luong_gp: 2,
            agency: "Agency B",
            dai_ly: "Agency B",
            nhan_vien: "Tran Thi Lan",
            team: "Blue Team",
          }),
          expect.objectContaining({
            so_tk: "00000099999",
            nhanh: "Chi nhanh B",
            status: "new",
            locked: false,
            changedFields: expect.arrayContaining(["so_tk", "nhanh", "mst"]),
            licenseCodes: ["GP77"],
            licenseSourceCodes: ["GP77"],
            licenses: 1,
            so_luong_gp: 1,
            agency: "Agency C",
            nhan_vien: "Le Van New",
            team: "Green Team",
          }),
        ],
        limited: false,
        fetched: 2,
        range: expect.any(Object),
      },
    });

    const commitResponse = await request(app)
      .post("/api/v4/declarations/imports/ecus-commit")
      .set(sessionHeaders("session-manager"))
      .send({
        rawRows,
        fetchedTotal: 2,
        reason: "manual",
      });

    expect(commitResponse.status).toBe(200);
    expect(commitResponse.body).toEqual({
      ok: true,
      result: {
        fetched: 2,
        imported: 1,
        updated: 1,
        skipped: 0,
        reviewLocked: 0,
        runAt: expect.any(String),
        actor: "manager",
        reason: "manual",
        range: expect.any(Object),
      },
    });
    expect(runtime.store.commitImportedDeclarations).toHaveBeenCalledTimes(1);

    const listResponse = await request(app).get("/api/v4/declarations");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          so_tk: "00000012345",
          agency: "Agency B",
          team: "Blue Team",
          nhan_vien: "Tran Thi Lan",
          licenseCodes: ["GP01", "ZN02"],
        }),
        expect.objectContaining({
          so_tk: "00000099999",
          nhanh: "Chi nhanh B",
          mst: "0109999999",
          agency: "Agency C",
          team: "Green Team",
        }),
      ]),
    );
  });

  it("exposes canonical ECUS sync preview and run routes through the shared ECUS fetch seam", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        declaration_id: "decl-existing",
        so_tk: "00000012345",
        so_tk_full: "12345",
        nhanh: "Chi nhanh A",
        date: "2026-02-14",
        mst: "01012345671",
        ma_loai_hinh: "A11",
        licenses: 0,
        so_luong_gp: 0,
        licenseManualCount: 0,
        license_count: 0,
        licenseCodes: [],
        licenseSourceCodes: [],
        agency: "",
        dai_ly: "",
        agency_text: "",
        nhan_vien: "",
        staff_name_snapshot: "",
        team: "",
        team_name_snapshot: "",
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
    const rawRows = [
      {
        so_tk: "12345",
        nhanh: "Chi nhanh A",
        mst: "0101234567-1",
        date: "2026/02/14",
        loai_hinh: "A11",
        num_items: 5,
        license_codes: ["GP01", "ZN02"],
        agency: "Agency B",
        nhan_vien: "Tran Thi Lan",
        team: "Blue Team",
      },
      {
        so_tk: "99999",
        nhanh: "Chi nhanh B",
        mst: "0109999999",
        date: "2026-02-21",
        loai_hinh: "B11",
        num_items: 2,
        license_codes: ["GP77"],
        agency: "Agency C",
        nhan_vien: "Le Van New",
        team: "Green Team",
      },
    ];
    const ecusImportRunner = {
      fetch: vi.fn(async (range, options = {}) => ({
        rawRows,
        fetched: rawRows.length,
        limited: false,
        range: {
          from: range?.from || "2026-02-14",
          to: range?.to || "2026-02-21",
        },
        options,
      })),
    };
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
      declarations: {
        ecusImportRunner,
      },
    });

    const forbiddenPreview = await request(app)
      .post("/api/v4/declarations/imports/ecus-preview")
      .set(sessionHeaders("session-staff"))
      .send({
        from: "2026-02-14",
        to: "2026-02-21",
        limit: 100,
      });

    expect(forbiddenPreview.status).toBe(403);
    expect(forbiddenPreview.body.error).toMatchObject({
      code: "forbidden",
    });

    const previewResponse = await request(app)
      .post("/api/v4/declarations/imports/ecus-preview")
      .set(sessionHeaders("session-manager"))
      .send({
        from: "2026-02-14",
        to: "2026-02-21",
        limit: 100,
      });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body).toEqual({
      ok: true,
      preview: {
        rows: [
          expect.objectContaining({
            so_tk: "00000012345",
            nhanh: "Chi nhanh A",
            status: "existing",
            licenseCodes: ["GP01", "ZN02"],
            agency: "Agency B",
            nhan_vien: "Tran Thi Lan",
            team: "Blue Team",
          }),
          expect.objectContaining({
            so_tk: "00000099999",
            nhanh: "Chi nhanh B",
            status: "new",
            licenseCodes: ["GP77"],
            agency: "Agency C",
            nhan_vien: "Le Van New",
            team: "Green Team",
          }),
        ],
        limited: false,
        fetched: 2,
        range: {
          from: "2026-02-14",
          to: "2026-02-21",
        },
      },
    });

    const runResponse = await request(app)
      .post("/api/v4/declarations/imports/ecus-commit")
      .set(sessionHeaders("session-manager"))
      .send({
        from: "2026-02-14",
        to: "2026-02-21",
      });

    expect(runResponse.status).toBe(200);
    expect(runResponse.body).toEqual({
      ok: true,
      result: {
        fetched: 2,
        imported: 1,
        updated: 1,
        skipped: 0,
        reviewLocked: 0,
        runAt: expect.any(String),
        actor: "manager",
        reason: "manual",
        range: {
          from: "2026-02-14",
          to: "2026-02-21",
        },
      },
    });
    expect(runtime.store.commitImportedDeclarations).toHaveBeenCalledTimes(1);
    expect(ecusImportRunner.fetch).toHaveBeenNthCalledWith(
      1,
      {
        from: "2026-02-14",
        to: "2026-02-21",
      },
      {
        limit: 100,
        includeTaxCodes: undefined,
        excludeTaxCodes: undefined,
      },
    );
    expect(ecusImportRunner.fetch).toHaveBeenNthCalledWith(
      2,
      {
        from: "2026-02-14",
        to: "2026-02-21",
      },
      {
        limit: undefined,
        includeTaxCodes: undefined,
        excludeTaxCodes: undefined,
      },
    );

    const listResponse = await request(app).get("/api/v4/declarations");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          so_tk: "00000012345",
          agency: "Agency B",
          team: "Blue Team",
          nhan_vien: "Tran Thi Lan",
          licenseCodes: ["GP01", "ZN02"],
        }),
        expect.objectContaining({
          so_tk: "00000099999",
          nhanh: "Chi nhanh B",
          mst: "0109999999",
          agency: "Agency C",
          team: "Green Team",
        }),
      ]),
    );
  });

  it("accepts a configured ECUS bridge bearer token for import preview", async () => {
    const runtime = createDeclarationsRuntimeStub([]);
    const previousToken = process.env.ECUS_BRIDGE_TOKEN;
    process.env.ECUS_BRIDGE_TOKEN = "bridge-secret";

    try {
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

      const response = await request(app)
        .post("/api/v4/declarations/imports/ecus-preview")
        .set("Authorization", "Bearer bridge-secret")
        .send({
          rawRows: [
            {
              so_tk: "77777",
              nhanh: "Chi nhanh Token",
              mst: "0107777777",
              date: "2026-02-20",
              loai_hinh: "A11",
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.preview.rows).toEqual([
        expect.objectContaining({
          so_tk: "00000077777",
          nhanh: "Chi nhanh Token",
          status: "new",
        }),
      ]);
    } finally {
      if (previousToken === undefined) {
        delete process.env.ECUS_BRIDGE_TOKEN;
      } else {
        process.env.ECUS_BRIDGE_TOKEN = previousToken;
      }
    }
  });

  it("owns legacy ECUS config/status routes behind session-backed syncManage permission and exposes canonical bridge config reads", async () => {
    const runtime = createDeclarationsRuntimeStub([]);
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
    const sqlHealthCheck = vi.fn(async () => ({
      ok: true,
      state: "ready",
      server: "srv-health",
      database: "db-health",
      checkedAt: "2026-03-16T01:02:03.000Z",
    }));
    const previousToken = process.env.ECUS_BRIDGE_TOKEN;
    process.env.ECUS_BRIDGE_TOKEN = "bridge-secret";

    try {
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
        declarations: {
          sqlHealthCheck,
        },
      });

      const unauthorizedConfig = await request(app).get("/api/v4/declarations/imports/ecus-status");
      expect(unauthorizedConfig.status).toBe(401);
      expect(unauthorizedConfig.body.error).toMatchObject({
        code: "auth_required",
      });

      const configResponse = await request(app)
        .get("/api/v4/declarations/imports/ecus-config")
        .set("Authorization", "Bearer bridge-secret");

      expect(configResponse.status).toBe(200);
      expect(configResponse.body).toMatchObject({
        ok: true,
        config: {
          enabled: false,
          schedule: "0 3 * * *",
          scheduleMode: "daily",
          scheduleValue: 1,
          scheduleTime: "03:00",
          connection: {
            server: "Server",
            database: "ECUS5VNACCS",
            user: "sa",
            password: "",
          },
        },
      });
      expect(configResponse.body.config.schedulePreset).toEqual(
        expect.objectContaining({
          mode: "daily",
          value: 1,
          time: "03:00",
          cron: "0 3 * * *",
        }),
      );
      expect(typeof configResponse.body.config.connection.hasPassword).toBe("boolean");
      expect(typeof configResponse.body.config.scheduleDescription).toBe("string");

      const statusResponse = await request(app)
        .get("/api/v4/declarations/imports/ecus-status")
        .set(sessionHeaders("session-manager"));

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body).toMatchObject({
        ok: true,
        backend: {
          ok: true,
          state: "online",
        },
        database: {
          ok: true,
          state: "ready",
          server: "srv-health",
          database: "db-health",
          checkedAt: "2026-03-16T01:02:03.000Z",
        },
        config: expect.objectContaining({
          schedule: "0 3 * * *",
        }),
      });
      expect(typeof statusResponse.body.backend.checkedAt).toBe("string");
      expect(sqlHealthCheck).toHaveBeenCalledTimes(1);

      const retiredConfigAlias = await request(app)
        .get("/api/import/ecus/config")
        .set(sessionHeaders("session-manager"));
      expect(retiredConfigAlias.status).toBe(404);

      const retiredStatusAlias = await request(app)
        .get("/api/import/ecus/status")
        .set(sessionHeaders("session-manager"));
      expect(retiredStatusAlias.status).toBe(404);
    } finally {
      if (previousToken === undefined) {
        delete process.env.ECUS_BRIDGE_TOKEN;
      } else {
        process.env.ECUS_BRIDGE_TOKEN = previousToken;
      }
    }
  });

  it("updates legacy ECUS config, preserves hidden passwords, and keeps canonical config reads in sync", async () => {
    const runtime = createDeclarationsRuntimeStub([]);
    const authStore = createAuthStore([
      createAccount({
        username: "manager",
        role: MANAGER_ROLE,
        name: "Manager User",
      }),
    ]);
    const previousToken = process.env.ECUS_BRIDGE_TOKEN;
    process.env.ECUS_BRIDGE_TOKEN = "bridge-secret";

    try {
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

      const saveResponse = await request(app)
        .put("/api/v4/declarations/imports/ecus-config")
        .set(sessionHeaders("session-manager"))
        .send({
          config: {
            enabled: true,
            scheduleMode: "daily",
            scheduleValue: 2,
            scheduleTime: "06:15",
            rangeDays: 3,
            preferMonthFirst: true,
            connection: {
              server: "srv01",
              database: "ecus-prod",
              user: "runner",
              password: "secret-1",
            },
            includeTaxCodes: ["0312345678"],
            excludeTaxCodes: ["0399999999"],
          },
          preservePassword: false,
        });

      expect(saveResponse.status).toBe(200);
      expect(saveResponse.body).toMatchObject({
        ok: true,
        config: {
          enabled: true,
          schedule: "15 6 */2 * *",
          scheduleMode: "daily",
          scheduleValue: 2,
          scheduleTime: "06:15",
          rangeDays: 3,
          preferMonthFirst: true,
          includeTaxCodes: ["0312345678"],
          excludeTaxCodes: ["0399999999"],
          connection: {
            server: "srv01",
            database: "ecus-prod",
            user: "runner",
            password: "",
            hasPassword: true,
          },
        },
      });

      const preserveResponse = await request(app)
        .put("/api/v4/declarations/imports/ecus-config")
        .set(sessionHeaders("session-manager"))
        .send({
          config: {
            connection: {
              server: "srv02",
            },
            rangeDays: 5,
          },
          preservePassword: true,
        });

      expect(preserveResponse.status).toBe(200);
      expect(preserveResponse.body).toMatchObject({
        ok: true,
        config: {
          schedule: "15 6 */2 * *",
          rangeDays: 5,
          connection: {
            server: "srv02",
            database: "ecus-prod",
            user: "runner",
            password: "",
            hasPassword: true,
          },
        },
      });

      const legacyWriteAlias = await request(app)
        .put("/api/import/ecus/config")
        .set(sessionHeaders("session-manager"));

      expect(legacyWriteAlias.status).toBe(404);

      const canonicalReadResponse = await request(app)
        .get("/api/v4/declarations/imports/ecus-config")
        .set("Authorization", "Bearer bridge-secret");

      expect(canonicalReadResponse.status).toBe(200);
      expect(canonicalReadResponse.body).toMatchObject({
        ok: true,
        config: {
          schedule: "15 6 */2 * *",
          rangeDays: 5,
          connection: {
            server: "srv02",
            database: "ecus-prod",
            user: "runner",
            password: "",
            hasPassword: true,
          },
        },
      });
    } finally {
      if (previousToken === undefined) {
        delete process.env.ECUS_BRIDGE_TOKEN;
      } else {
        process.env.ECUS_BRIDGE_TOKEN = previousToken;
      }
    }
  });

  it("owns legacy declaration search behind authenticated sessions and preserves importer pagination filters", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        declaration_id: "decl-1",
        so_tk: "00000012345",
        so_tk_full: "12345",
        mst: "01012345671",
        cong_ty: "Cong ty Match 1",
        company: "Cong ty Match 1",
        nhan_vien: "",
        staff_name_snapshot: "",
      }),
      createDeclarationRow({
        declaration_id: "decl-2",
        so_tk: "00000012346",
        so_tk_full: "12346",
        mst: "01012345671",
        cong_ty: "Cong ty Match 2",
        company: "Cong ty Match 2",
        nhan_vien: "",
        staff_name_snapshot: "",
      }),
      createDeclarationRow({
        declaration_id: "decl-3",
        so_tk: "00000012347",
        so_tk_full: "12347",
        mst: "01012345671",
        cong_ty: "Cong ty Deleted",
        company: "Cong ty Deleted",
        nhan_vien: "",
        staff_name_snapshot: "",
        deleted_at: "2026-03-16T00:00:00.000Z",
      }),
      createDeclarationRow({
        declaration_id: "decl-4",
        so_tk: "00000099999",
        so_tk_full: "99999",
        mst: "09999999999",
        cong_ty: "Khac",
        company: "Khac",
      }),
    ]);
    const authStore = createAuthStore([
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

    const unauthorizedResponse = await request(app).get("/api/v4/declarations/imports/search").query({
      mst: "0101234567",
    });
    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedResponse.body.error).toMatchObject({
      code: "auth_required",
    });

    const searchResponse = await request(app)
      .get("/api/v4/declarations/imports/search")
      .set(sessionHeaders("session-staff"))
      .query({
        query: "Cong ty",
        mst: "0101234567",
        noStaff: "1",
        pageSize: "1",
        page: "3",
      });

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body).toEqual({
      ok: true,
      total: 2,
      page: 2,
      pageSize: 1,
      rows: [
        expect.objectContaining({
          declaration_id: "decl-2",
          so_tk: "00000012346",
          mst: "01012345671",
          cong_ty: "Cong ty Match 2",
          nhan_vien: "",
        }),
      ],
    });

    const retiredSearchAlias = await request(app)
      .get("/api/import/search")
      .set(sessionHeaders("session-staff"))
      .query({
        query: "Cong ty",
        mst: "0101234567",
      });
    expect(retiredSearchAlias.status).toBe(404);
  });

  it("lists canonical deleted declarations behind authenticated sessions and retires the legacy alias", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        declaration_id: "decl-1",
        so_tk: "00000012345",
        so_tk_full: "12345",
        mst: "01012345671",
        cong_ty: "Cong ty Hard Deleted",
        company: "Cong ty Hard Deleted",
        deleted_at: "2026-03-04T10:00:00.000Z",
        deleted_by: "manager",
        deleted_type: "hard",
      }),
      createDeclarationRow({
        declaration_id: "decl-2",
        so_tk: "00000012346",
        so_tk_full: "12346",
        mst: "01012345672",
        cong_ty: "Cong ty Soft Deleted",
        company: "Cong ty Soft Deleted",
        deleted_at: "2026-03-04T12:00:00.000Z",
        deleted_by: "manager",
        deleted_type: "soft",
      }),
    ]);
    const authStore = createAuthStore([
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

    const unauthorizedResponse = await request(app)
      .get("/api/v4/declarations/imports/deleted-declarations")
      .query({
        type: "hard",
        from: "2026-03-01",
        to: "2026-03-05",
      });
    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedResponse.body.error).toMatchObject({
      code: "auth_required",
    });

    const response = await request(app)
      .get("/api/v4/declarations/imports/deleted-declarations")
      .set(sessionHeaders("session-staff"))
      .query({
        type: "hard",
        from: "2026-03-01",
        to: "2026-03-05",
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      rows: [
        expect.objectContaining({
          so_tk: "00000012345",
          mst: "01012345671",
          company: "Cong ty Hard Deleted",
          type: "hard",
          deleted_at: "2026-03-04T10:00:00.000Z",
          deleted_by: "manager",
        }),
      ],
    });

    const retiredAliasResponse = await request(app)
      .get("/api/import/deleted-declarations")
      .set(sessionHeaders("session-staff"))
      .query({
        type: "hard",
        from: "2026-03-01",
        to: "2026-03-05",
      });
    expect(retiredAliasResponse.status).toBe(404);
  });

  it("owns C/O monitoring config routes behind session-backed syncManage permission", async () => {
    const runtime = createDeclarationsRuntimeStub([]);
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

    const unauthorizedCodes = await request(app).get("/api/v4/declarations/imports/co-codes");
    expect(unauthorizedCodes.status).toBe(401);
    expect(unauthorizedCodes.body.error).toMatchObject({
      code: "auth_required",
    });

    const forbiddenCodes = await request(app)
      .get("/api/v4/declarations/imports/co-codes")
      .set(sessionHeaders("session-staff"));
    expect(forbiddenCodes.status).toBe(403);
    expect(forbiddenCodes.body.error).toMatchObject({
      code: "forbidden",
    });

    const codesResponse = await request(app)
      .get("/api/v4/declarations/imports/co-codes")
      .set(sessionHeaders("session-manager"));
    expect(codesResponse.status).toBe(200);
    expect(codesResponse.body).toEqual({
      ok: true,
      config: {
        version: 1,
        whitelist: [],
        blacklist: ["B01", "B03", "B30", "B02"],
        updatedAt: null,
        updatedBy: null,
      },
    });

    const saveCodesResponse = await request(app)
      .put("/api/v4/declarations/imports/co-codes")
      .set(sessionHeaders("session-manager"))
      .send({
        config: {
          whitelist: [" a1 ", "A1", "b2"],
          blacklist: ["b01", " B01 ", "c3"],
        },
      });
    expect(saveCodesResponse.status).toBe(200);
    expect(saveCodesResponse.body).toEqual({
      ok: true,
      config: {
        version: 1,
        whitelist: ["A1", "B2"],
        blacklist: ["B01", "C3"],
        updatedAt: expect.any(String),
        updatedBy: "manager",
      },
    });
    expect(runtime.store.writeCoCodeConfig).toHaveBeenCalledTimes(1);

    const legacyCodesResponse = await request(app)
      .get("/api/import/co-codes")
      .set(sessionHeaders("session-manager"));
    expect(legacyCodesResponse.status).toBe(404);

    const discrepancyResponse = await request(app)
      .get("/api/v4/declarations/imports/co-discrepancy")
      .set(sessionHeaders("session-manager"));
    expect(discrepancyResponse.status).toBe(200);
    expect(discrepancyResponse.body).toEqual({
      ok: true,
      config: {
        enabled: false,
        cron: "30 4 * * *",
        rangeDays: 3,
        threshold: 10,
        sampleLimit: 500,
        updatedAt: null,
        updatedBy: null,
      },
      state: {
        lastRunAt: null,
        range: null,
        mismatchCount: 0,
        totalChecked: 0,
        status: "idle",
        error: null,
        durationMs: 0,
        mismatches: [],
        triggered: false,
        limited: false,
        actor: null,
        reason: null,
      },
    });

    const saveDiscrepancyConfigResponse = await request(app)
      .put("/api/v4/declarations/imports/co-discrepancy/config")
      .set(sessionHeaders("session-manager"))
      .send({
        config: {
          enabled: true,
          cron: " 15 1 * * * ",
          rangeDays: 0,
          threshold: "17",
          sampleLimit: -10,
        },
      });
    expect(saveDiscrepancyConfigResponse.status).toBe(200);
    expect(saveDiscrepancyConfigResponse.body).toEqual({
      ok: true,
      config: {
        enabled: true,
        cron: "15 1 * * *",
        rangeDays: 1,
        threshold: 17,
        sampleLimit: 0,
        updatedAt: expect.any(String),
        updatedBy: "manager",
      },
    });
    expect(runtime.store.writeCoDiscrepancyConfig).toHaveBeenCalledTimes(1);

    const legacyDiscrepancyResponse = await request(app)
      .get("/api/import/co-discrepancy")
      .set(sessionHeaders("session-manager"));
    expect(legacyDiscrepancyResponse.status).toBe(404);
  });

  it("owns C/O discrepancy run routes behind session-backed syncManage permission", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        so_tk: "00000012345",
        nhanh: "Chi nhanh A",
        mst: "01012345671",
        date: "2026-02-14",
        co_line_count: 0,
        has_co: false,
        co: "",
        co_codes: [],
      }),
      createDeclarationRow({
        so_tk: "00000054321",
        nhanh: "Chi nhanh B",
        mst: "01054321671",
        date: "2026-02-15",
        co_line_count: 1,
        has_co: true,
        co: "Có",
        co_codes: ["B05"],
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
    const coDiscrepancyRunner = {
      fetch: vi.fn(async (range) => ({
        rawRows: [
          {
            so_tk: "12345",
            nhanh: "Chi nhanh A",
            mst: "0101234567-1",
            date: "2026-02-14",
            co_line_count: 2,
            co_codes: ["B05", "B07"],
          },
          {
            so_tk: "54321",
            nhanh: "Chi nhanh B",
            mst: "0105432167-1",
            date: "2026-02-15",
            co_line_count: 1,
            co_codes: ["B05"],
          },
        ],
        fetched: 2,
        limited: false,
        range,
      })),
    };
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
      declarations: {
        coDiscrepancyRunner,
      },
    });

    const unauthorizedResponse = await request(app)
      .post("/api/v4/declarations/imports/co-discrepancy/run")
      .send({
        range: {
          from: "2026-02-13",
          to: "2026-02-15",
        },
      });
    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedResponse.body.error).toMatchObject({
      code: "auth_required",
    });

    const forbiddenResponse = await request(app)
      .post("/api/v4/declarations/imports/co-discrepancy/run")
      .set(sessionHeaders("session-staff"))
      .send({
        range: {
          from: "2026-02-13",
          to: "2026-02-15",
        },
      });
    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error).toMatchObject({
      code: "forbidden",
    });

    const runResponse = await request(app)
      .post("/api/v4/declarations/imports/co-discrepancy/run")
      .set(sessionHeaders("session-manager"))
      .send({
        range: {
          from: "2026-02-13",
          to: "2026-02-15",
        },
      });

    expect(runResponse.status).toBe(200);
    expect(runResponse.body).toEqual({
      ok: true,
      result: {
        config: {
          enabled: false,
          cron: "30 4 * * *",
          rangeDays: 3,
          threshold: 10,
          sampleLimit: 500,
          updatedAt: null,
          updatedBy: null,
        },
        state: {
          lastRunAt: expect.any(String),
          range: {
            from: "2026-02-13",
            to: "2026-02-15",
          },
          mismatchCount: 1,
          totalChecked: 2,
          status: "ok",
          error: null,
          durationMs: expect.any(Number),
          mismatches: [
            expect.objectContaining({
              key: "00000012345_Chi nhanh A",
              so_tk: "00000012345",
              nhanh: "Chi nhanh A",
              stored: expect.objectContaining({
                co_line_count: 0,
                has_co: false,
              }),
              remote: expect.objectContaining({
                co_line_count: 2,
                has_co: true,
              }),
            }),
          ],
          triggered: false,
          limited: false,
          actor: "manager",
          reason: "manual",
        },
      },
    });
    expect(coDiscrepancyRunner.fetch).toHaveBeenCalledTimes(1);
    expect(runtime.store.writeCoDiscrepancyState).toHaveBeenCalledTimes(1);

    const legacyRunResponse = await request(app)
      .post("/api/import/co-discrepancy/run")
      .set(sessionHeaders("session-manager"))
      .send({
        range: {
          from: "2026-02-13",
          to: "2026-02-15",
        },
      });
    expect(legacyRunResponse.status).toBe(404);
  });

  it("owns declaration alerts routes behind session-backed alertsManage permission", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        so_tk: "00000012345",
        nhanh: "Chi nhanh A",
        mst: "01012345671",
        cong_ty: "Cong ty Alert",
        company_name: "Cong ty Alert",
        date: "2024-01-01",
        nhan_vien: "",
        staff_name_snapshot: "",
        team: "",
        team_name_snapshot: "",
        reviewed: false,
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

    const unauthorizedResponse = await request(app).get("/api/v4/declarations/imports/alerts");
    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedResponse.body.error).toMatchObject({
      code: "auth_required",
    });

    const forbiddenResponse = await request(app)
      .get("/api/v4/declarations/imports/alerts")
      .set(sessionHeaders("session-staff"));
    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.error).toMatchObject({
      code: "forbidden",
    });

    const alertsResponse = await request(app)
      .get("/api/v4/declarations/imports/alerts")
      .set(sessionHeaders("session-manager"));

    expect(alertsResponse.status).toBe(200);
    expect(alertsResponse.body).toEqual({
      ok: true,
      config: {
        enabled: true,
        thresholdDays: 2,
        autoResolveReviewed: true,
        channel: "audit",
      },
      alerts: [
        expect.objectContaining({
          key: "00000012345_Chi nhanh A",
          so_tk: "00000012345",
          mst: "01012345671",
          company: "Cong ty Alert",
          team: "",
          staff: "",
          missing: ["nhân viên", "tổ đội"],
          resolved: false,
        }),
      ],
      summary: {
        outstanding: 1,
        totalTracked: 1,
        lastEvaluatedAt: expect.any(String),
      },
    });

    const configResponse = await request(app)
      .put("/api/v4/declarations/imports/alerts/config")
      .set(sessionHeaders("session-manager"))
      .send({
        config: {
          thresholdDays: 9999,
        },
      });

    expect(configResponse.status).toBe(200);
    expect(configResponse.body).toEqual({
      ok: true,
      config: {
        enabled: true,
        thresholdDays: 9999,
        autoResolveReviewed: true,
        channel: "audit",
      },
      summary: {
        total: 1,
        outstanding: 0,
        triggered: 0,
      },
    });
  });

  it("supports alert review and unreview workflows for overdue declarations", async () => {
    const runtime = createDeclarationsRuntimeStub([
      createDeclarationRow({
        so_tk: "00000012345",
        nhanh: "Chi nhanh A",
        mst: "01012345671",
        cong_ty: "Cong ty Alert",
        company_name: "Cong ty Alert",
        date: "2024-01-01",
        nhan_vien: "",
        staff_name_snapshot: "",
        team: "",
        team_name_snapshot: "",
        reviewed: false,
      }),
    ]);
    const authStore = createAuthStore([
      createAccount({
        username: "manager",
        role: MANAGER_ROLE,
        name: "Manager User",
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

    const reviewResponse = await request(app)
      .post("/api/v4/declarations/imports/alerts/review")
      .set(sessionHeaders("session-manager"))
      .send({
        keys: ["00000012345_Chi nhanh A"],
      });

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body).toEqual({
      ok: true,
      updated: 1,
      summary: {
        total: 1,
        outstanding: 0,
        triggered: 0,
      },
    });

    const reviewedAlertsResponse = await request(app)
      .get("/api/v4/declarations/imports/alerts")
      .set(sessionHeaders("session-manager"));

    expect(reviewedAlertsResponse.status).toBe(200);
    expect(reviewedAlertsResponse.body.summary).toEqual({
      outstanding: 0,
      totalTracked: 0,
      lastEvaluatedAt: expect.any(String),
    });
    expect(reviewedAlertsResponse.body.alerts).toEqual([]);

    const unreviewResponse = await request(app)
      .post("/api/v4/declarations/imports/alerts/unreview")
      .set(sessionHeaders("session-manager"))
      .send({
        keys: ["00000012345_Chi nhanh A"],
      });

    expect(unreviewResponse.status).toBe(200);
    expect(unreviewResponse.body).toEqual({
      ok: true,
      updated: 1,
      summary: {
        total: 1,
        outstanding: 1,
        triggered: 1,
      },
    });

    const unreveiwedAlertsResponse = await request(app)
      .get("/api/v4/declarations/imports/alerts")
      .set(sessionHeaders("session-manager"));

    expect(unreveiwedAlertsResponse.status).toBe(200);
    expect(unreveiwedAlertsResponse.body.summary).toEqual({
      outstanding: 1,
      totalTracked: 1,
      lastEvaluatedAt: expect.any(String),
    });
    expect(unreveiwedAlertsResponse.body.alerts).toEqual([
      expect.objectContaining({
        key: "00000012345_Chi nhanh A",
        resolved: false,
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
      .set(sessionHeaders("session-manager"))
      .send({
        teamName: "Blocked Team",
      });

    expect(managerResponse.status).toBe(409);
    expect(managerResponse.body.error).toMatchObject({
      code: "review_locked",
    });

    const adminResponse = await request(app)
      .patch(`/api/v4/declarations/${declarationId}`)
      .set(sessionHeaders("session-admin"))
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
  let ecusSyncConfig = null;
  let coCodeConfig = null;
  let coDiscrepancyConfig = null;
  let coDiscrepancyState = null;
  let alertConfig = null;
  let alertState = null;

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
      commitImportedDeclarations: vi.fn(async (input) => {
        for (const entry of input.entries ?? []) {
          const currentKey = `${entry.key ?? ""}`;
          const nextRow = clone(entry.nextRecord);
          const index = rows.findIndex(
            (row) => `${row.so_tk ?? ""}_${row.nhanh ?? row.branch ?? ""}` === currentKey,
          );

          if (index >= 0) {
            rows[index] = nextRow;
            continue;
          }

          rows.push(nextRow);
        }
      }),
      listDeclarationEvents: vi.fn(async (target) => clone(eventMap.get(target.key) ?? [])),
      listDeletedDeclarations: vi.fn(async (filters = {}) =>
        rows
          .filter((row) => row.deleted_at)
          .filter((row) => {
            if (!filters.type) {
              return true;
            }
            return `${row.deleted_type ?? row.type ?? ""}` === `${filters.type}`;
          })
          .filter((row) => {
            if (!filters.from) {
              return true;
            }
            return `${row.deleted_at}` >= `${filters.from}`;
          })
          .filter((row) => {
            if (!filters.to) {
              return true;
            }
            return `${row.deleted_at}` <= `${filters.to}T23:59:59.999Z`;
          })
          .map((row) => ({
            so_tk: row.so_tk,
            nhanh: row.nhanh ?? row.branch ?? "",
            mst: row.mst ?? "",
            company: row.company ?? row.cong_ty ?? row.ten_dn ?? "",
            ten_dn: row.ten_dn ?? row.company ?? row.cong_ty ?? "",
            type: row.deleted_type ?? row.type ?? "hard",
            deleted_at: row.deleted_at,
            deleted_by: row.deleted_by ?? "",
          })),
      ),
      readEcusSyncConfig: vi.fn(async () => clone(ecusSyncConfig)),
      writeEcusSyncConfig: vi.fn(async (config) => {
        ecusSyncConfig = clone(config);
        return clone(ecusSyncConfig);
      }),
      readCoCodeConfig: vi.fn(async () => clone(coCodeConfig)),
      writeCoCodeConfig: vi.fn(async (config) => {
        coCodeConfig = clone(config);
        return clone(coCodeConfig);
      }),
      readCoDiscrepancyConfig: vi.fn(async () => clone(coDiscrepancyConfig)),
      writeCoDiscrepancyConfig: vi.fn(async (config) => {
        coDiscrepancyConfig = clone(config);
        return clone(coDiscrepancyConfig);
      }),
      readCoDiscrepancyState: vi.fn(async () => clone(coDiscrepancyState)),
      writeCoDiscrepancyState: vi.fn(async (state) => {
        coDiscrepancyState = clone(state);
        return clone(coDiscrepancyState);
      }),
      readDeclarationAlertConfig: vi.fn(async () => clone(alertConfig)),
      writeDeclarationAlertConfig: vi.fn(async (config) => {
        alertConfig = clone(config);
        return clone(alertConfig);
      }),
      readDeclarationAlertState: vi.fn(async () => clone(alertState)),
      writeDeclarationAlertState: vi.fn(async (state) => {
        alertState = clone(state);
        return clone(alertState);
      }),
      markDeclarationsReviewed: vi.fn(async (keys, actor) => {
        const keySet = new Set((Array.isArray(keys) ? keys : []).map((key) => `${key ?? ""}`.trim()).filter(Boolean));
        if (keySet.size === 0) {
          return 0;
        }

        let updated = 0;
        const reviewedAt = new Date().toISOString();
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          const key = `${row.so_tk ?? ""}_${row.nhanh ?? row.branch ?? ""}`;
          if (!keySet.has(key) || row.reviewed === true) {
            continue;
          }

          updated += 1;
          rows[index] = {
            ...clone(row),
            reviewed: true,
            reviewed_at: reviewedAt,
            reviewed_by: actor,
          };
        }

        return updated;
      }),
      unmarkDeclarationsReviewed: vi.fn(async (keys) => {
        const keySet = new Set((Array.isArray(keys) ? keys : []).map((key) => `${key ?? ""}`.trim()).filter(Boolean));
        if (keySet.size === 0) {
          return 0;
        }

        let updated = 0;
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          const key = `${row.so_tk ?? ""}_${row.nhanh ?? row.branch ?? ""}`;
          if (!keySet.has(key) || row.reviewed !== true) {
            continue;
          }

          const nextRow = { ...clone(row), reviewed: false };
          delete nextRow.reviewed_at;
          delete nextRow.reviewed_by;
          rows[index] = nextRow;
          updated += 1;
        }

        return updated;
      }),
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

const TEST_CSRF_TOKEN = "test-csrf-token";

function sessionHeaders(sessionToken) {
  return {
    Cookie: `kpi_session=${sessionToken}; kpi_csrf=${TEST_CSRF_TOKEN}`,
    "X-CSRF-Token": TEST_CSRF_TOKEN,
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

