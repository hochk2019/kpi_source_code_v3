import { describe, expect, it } from "vitest";

import { PostgresAdjustmentAsyncReader } from "../../server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts";
import { PostgresKpiAdjustmentsStore } from "../../server-v4/src/modules/kpi-adjustments/postgresKpiAdjustmentsStore.ts";
import { SqliteKpiAdjustmentsStore } from "../../server-v4/src/modules/kpi-adjustments/sqliteKpiAdjustmentsStore.ts";
import { PostgresDeclarationAsyncReader } from "../../server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts";
import { PostgresDeclarationsStore } from "../../server-v4/src/modules/declarations/postgresDeclarationsStore.ts";
import { SqliteDeclarationsStore } from "../../server-v4/src/modules/declarations/sqliteDeclarationsStore.ts";
import { PostgresHqAgenciesAsyncReader } from "../../server-v4/src/modules/hq-agencies/postgresHqAgenciesAsyncReader.ts";
import { PostgresHqAgenciesStore } from "../../server-v4/src/modules/hq-agencies/postgresHqAgenciesStore.ts";
import { SqliteHqAgenciesStore } from "../../server-v4/src/modules/hq-agencies/sqliteHqAgenciesStore.ts";
import { PostgresKpiRulesAsyncReader } from "../../server-v4/src/modules/kpi-rules/postgresKpiRulesAsyncReader.ts";
import { PostgresMstAssignmentAsyncReader } from "../../server-v4/src/modules/mst-assignments/postgresMstAssignmentAsyncReader.ts";
import { PostgresTeamRosterAsyncReader } from "../../server-v4/src/modules/teams/postgresTeamRosterAsyncReader.ts";
import { PostgresTeamsStore } from "../../server-v4/src/modules/teams/postgresTeamsStore.ts";
import { SqliteTeamsStore } from "../../server-v4/src/modules/teams/sqliteTeamsStore.ts";
import { createRuntimePersistence } from "../../server-v4/src/persistence/runtimePersistence.ts";

describe("server-v4 runtime persistence", () => {
  it("defaults to sqlite dual-write runtime persistence", async () => {
    const persistence = createRuntimePersistence({
      dbFile: ":memory:",
      persistenceMode: "sqlite-dual-write",
      postgresUrl: null,
      postgresLegacySqliteFallback: false,
    });

    expect(persistence.mode).toBe("sqlite-dual-write");
    expect(persistence.sourceKind).toBe("dual-write");
    expect(persistence).not.toHaveProperty("reader");
    expect(typeof persistence.authStore.listAccounts).toBe("function");
    expect(typeof persistence.authStore.createSession).toBe("function");
    expect(persistence.adjustmentsReader.getSourceKind()).toBe("dual-write");
    expect(persistence.adjustmentsStore).toBeInstanceOf(SqliteKpiAdjustmentsStore);
    expect(persistence.declarationsReader.getSourceKind()).toBe("dual-write");
    expect(persistence.declarationsStore).toBeInstanceOf(SqliteDeclarationsStore);
    expect(persistence.hqAgenciesReader.getSourceKind()).toBe("dual-write");
    expect(persistence.hqAgenciesStore).toBeInstanceOf(SqliteHqAgenciesStore);
    expect(persistence.kpiRulesReader.getSourceKind()).toBe("dual-write");
    expect(typeof persistence.kpiRulesStore.writeRuleCollection).toBe("function");
    expect(persistence.mstAssignmentsReader.getSourceKind()).toBe("dual-write");
    expect(persistence.teamsReader.getSourceKind()).toBe("dual-write");
    expect(persistence.teamsStore).toBeInstanceOf(SqliteTeamsStore);
    expect(persistence.adjustmentsReader.getLegacyDbFile()).toBe(":memory:");
    expect(persistence.declarationsReader.getLegacyDbFile()).toBe(":memory:");
    expect(persistence.hqAgenciesReader.getLegacyDbFile()).toBe(":memory:");
    expect(persistence.kpiRulesReader.getLegacyDbFile()).toBe(":memory:");
    expect(persistence.mstAssignmentsReader.getLegacyDbFile()).toBe(":memory:");
    expect(persistence.teamsReader.getLegacyDbFile()).toBe(":memory:");
    await expect(persistence.adjustmentsReader.readAdjustmentRows()).resolves.toEqual([]);
    await expect(persistence.declarationsReader.readDeclarationRows()).resolves.toEqual([]);
    await expect(persistence.hqAgenciesReader.readBindings()).resolves.toEqual([]);
    await expect(persistence.hqAgenciesReader.readHistoryEntries()).resolves.toEqual([]);
    await expect(persistence.kpiRulesReader.readRuleCollection()).resolves.toEqual({});
    await expect(persistence.mstAssignmentsReader.readMstAssignmentRows()).resolves.toEqual([]);
    await expect(persistence.teamsReader.readTeamRoster()).resolves.toEqual({});
  });

  it("fails fast when postgres mode is requested without a runtime url", () => {
    expect(() =>
      createRuntimePersistence({
        dbFile: null,
        persistenceMode: "postgres",
        postgresUrl: null,
        postgresLegacySqliteFallback: false,
      }),
    ).toThrow(/KPI_API_POSTGRES_URL/i);
  });

  it("builds a postgres reporting persistence adapter without retaining the legacy sqlite compatibility reader", async () => {
    const persistence = createRuntimePersistence({
      dbFile: null,
      persistenceMode: "postgres",
      postgresUrl: "postgres://runtime/kpi",
      postgresLegacySqliteFallback: false,
    });

    expect(persistence.mode).toBe("postgres");
    expect(persistence.sourceKind).toBe("relational-store");
    expect(persistence).not.toHaveProperty("reader");
    expect(typeof persistence.authStore.listAccounts).toBe("function");
    expect(typeof persistence.authStore.createSession).toBe("function");
    expect(persistence.adjustmentsReader).toBeInstanceOf(PostgresAdjustmentAsyncReader);
    expect(persistence.adjustmentsStore).toBeInstanceOf(PostgresKpiAdjustmentsStore);
    expect(persistence.declarationsReader).toBeInstanceOf(PostgresDeclarationAsyncReader);
    expect(persistence.declarationsStore).toBeInstanceOf(PostgresDeclarationsStore);
    expect(persistence.hqAgenciesReader).toBeInstanceOf(PostgresHqAgenciesAsyncReader);
    expect(persistence.hqAgenciesStore).toBeInstanceOf(PostgresHqAgenciesStore);
    expect(persistence.kpiRulesReader).toBeInstanceOf(PostgresKpiRulesAsyncReader);
    expect(typeof persistence.kpiRulesStore.writeRuleCollection).toBe("function");
    expect(persistence.mstAssignmentsReader).toBeInstanceOf(PostgresMstAssignmentAsyncReader);
    expect(persistence.teamsReader).toBeInstanceOf(PostgresTeamRosterAsyncReader);
    expect(persistence.teamsStore).toBeInstanceOf(PostgresTeamsStore);
    expect(persistence.adjustmentsReader.getSourceKind()).toBe("relational-store");
    expect(persistence.declarationsReader.getSourceKind()).toBe("relational-store");
    expect(persistence.hqAgenciesReader.getSourceKind()).toBe("relational-store");
    expect(persistence.kpiRulesReader.getSourceKind()).toBe("relational-store");
    expect(persistence.mstAssignmentsReader.getSourceKind()).toBe("relational-store");
    expect(persistence.teamsReader.getSourceKind()).toBe("relational-store");
    expect(persistence.adjustmentsReader.getHotPathKeys()).toEqual([]);
    expect(persistence.declarationsReader.getHotPathKeys()).toEqual([]);
    expect(persistence.hqAgenciesReader.getHotPathKeys()).toEqual([]);
    expect(persistence.kpiRulesReader.getHotPathKeys()).toEqual([]);
    expect(persistence.mstAssignmentsReader.getHotPathKeys()).toEqual([]);
    expect(persistence.teamsReader.getHotPathKeys()).toEqual([]);
    expect(persistence.adjustmentsReader.getLegacyDbFile()).toBeNull();
    expect(persistence.declarationsReader.getLegacyDbFile()).toBeNull();
    expect(persistence.hqAgenciesReader.getLegacyDbFile()).toBeNull();
    expect(persistence.kpiRulesReader.getLegacyDbFile()).toBeNull();
    expect(persistence.mstAssignmentsReader.getLegacyDbFile()).toBeNull();
    expect(persistence.teamsReader.getLegacyDbFile()).toBeNull();
    expect(typeof persistence.projections.readValue).toBe("function");
    expect(typeof persistence.dispose).toBe("function");

    await expect(persistence.dispose()).resolves.toBeUndefined();
  });

  it("requires an explicit legacy db file when postgres sqlite fallback is enabled", () => {
    expect(() =>
      createRuntimePersistence({
        dbFile: null,
        persistenceMode: "postgres",
        postgresUrl: "postgres://runtime/kpi",
        postgresLegacySqliteFallback: true,
      }),
    ).toThrow(/KPI_API_DB_FILE/i);
  });

  it("keeps the HQ agencies sqlite fallback behind an explicit postgres rollback flag", async () => {
    const persistence = createRuntimePersistence({
      dbFile: ":memory:",
      persistenceMode: "postgres",
      postgresUrl: "postgres://runtime/kpi",
      postgresLegacySqliteFallback: true,
    });

    expect(persistence.hqAgenciesReader).toBeInstanceOf(PostgresHqAgenciesAsyncReader);
    expect(persistence.hqAgenciesReader.getSourceKind()).toBe("relational-store");
    expect(persistence.hqAgenciesReader.getLegacyDbFile()).toBe(":memory:");

    await expect(persistence.dispose()).resolves.toBeUndefined();
  });
});
