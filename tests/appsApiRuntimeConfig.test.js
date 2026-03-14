import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveApiProjectRoot,
  resolveApiRuntimeConfig,
} from "../apps/api/src/apiRuntimeConfig.js";

describe("apps/api runtime config", () => {
  it("defaults to the repo-level sqlite store path", () => {
    const projectRoot = resolveApiProjectRoot();
    const config = resolveApiRuntimeConfig({ projectRoot }, {});

    expect(config.projectRoot).toBe(projectRoot);
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(0);
    expect(config.dbFile).toBe(path.resolve(projectRoot, "server", "data", "storage.sqlite"));
    expect(config.persistenceMode).toBe("sqlite-dual-write");
    expect(config.postgresUrl).toBeNull();
    expect(config.postgresLegacySqliteFallback).toBe(false);
  });

  it("does not carry a default sqlite db path in postgres mode when legacy fallback is disabled", () => {
    const projectRoot = resolveApiProjectRoot();
    const config = resolveApiRuntimeConfig(
      { projectRoot },
      {
        KPI_API_PERSISTENCE_MODE: "postgres",
        KPI_API_POSTGRES_URL: "postgres://runtime/kpi",
      },
    );

    expect(config.dbFile).toBeNull();
    expect(config.persistenceMode).toBe("postgres");
    expect(config.postgresUrl).toBe("postgres://runtime/kpi");
    expect(config.postgresLegacySqliteFallback).toBe(false);
  });

  it("resolves host, port, db file, and explicit postgres runtime settings from env", () => {
    const projectRoot = resolveApiProjectRoot();
    const config = resolveApiRuntimeConfig(
      { projectRoot },
      {
        KPI_API_HOST: "0.0.0.0",
        KPI_API_PORT: "4014",
        KPI_API_DB_FILE: "tmp/runtime.sqlite",
        KPI_API_PERSISTENCE_MODE: "postgres",
        KPI_API_POSTGRES_URL: "postgres://runtime/kpi",
        KPI_API_POSTGRES_LEGACY_SQLITE_FALLBACK: "true",
      },
    );

    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(4014);
    expect(config.dbFile).toBe(path.resolve(projectRoot, "tmp", "runtime.sqlite"));
    expect(config.persistenceMode).toBe("postgres");
    expect(config.postgresUrl).toBe("postgres://runtime/kpi");
    expect(config.postgresLegacySqliteFallback).toBe(true);
  });

  it("preserves in-memory db files and rejects invalid ports", () => {
    const projectRoot = resolveApiProjectRoot();
    const config = resolveApiRuntimeConfig(
      {
        projectRoot,
        dbFile: ":memory:",
      },
      {},
    );

    expect(config.dbFile).toBe(":memory:");
    expect(() => resolveApiRuntimeConfig({ projectRoot }, { KPI_API_PORT: "99999" })).toThrow(
      /Invalid API port/i,
    );
  });

  it("rejects unsupported persistence modes", () => {
    const projectRoot = resolveApiProjectRoot();

    expect(() =>
      resolveApiRuntimeConfig({ projectRoot }, { KPI_API_PERSISTENCE_MODE: "sqlite-legacy" }),
    ).toThrow(/Invalid API persistence mode/i);
  });
});
