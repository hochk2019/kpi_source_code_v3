import express from "express";

import { describe, expect, it, vi } from "vitest";

import { formatListenAddress, startApiServer } from "../apps/api/src/startApiServer.js";

describe("apps/api server launcher", () => {
  it("starts an injected app factory and forwards the db file", async () => {
    let receivedOptions = null;
    const disposePersistence = vi.fn(async () => {});

    const runtime = await startApiServer({
      dbFile: ":memory:",
      host: "127.0.0.1",
      port: 0,
      disableSignalHandlers: true,
      buildApp(options) {
        receivedOptions = options;
        const app = express();
        app.locals.runtimePersistenceDispose = disposePersistence;
        app.get("/api/v4/health", (_req, res) => {
          res.json({ ok: true });
        });
        return app;
      },
    });

    try {
      expect(receivedOptions).toEqual({
        dbFile: ":memory:",
        persistenceMode: "sqlite-dual-write",
        postgresUrl: null,
        postgresLegacySqliteFallback: false,
      });
      expect(runtime.config.dbFile).toBe(":memory:");
      expect(runtime.config.persistenceMode).toBe("sqlite-dual-write");
      expect(runtime.listenAddress).toMatch(/^127\.0\.0\.1:\d+$/);
      expect(formatListenAddress(runtime.server.address())).toBe(runtime.listenAddress);
    } finally {
      await runtime.close();
      expect(disposePersistence).toHaveBeenCalledTimes(1);
    }
  });

  it("requires an explicit postgres url when postgres mode is requested", async () => {
    await expect(
      startApiServer({
        persistenceMode: "postgres",
        disableSignalHandlers: true,
        buildApp() {
          return express();
        },
      }),
    ).rejects.toThrow(/KPI_API_POSTGRES_URL/i);
  });

  it("forwards postgres runtime config without a legacy db file by default", async () => {
    let receivedOptions = null;

    const runtime = await startApiServer({
      persistenceMode: "postgres",
      postgresUrl: "postgres://runtime/kpi",
      disableSignalHandlers: true,
      buildApp(options) {
        receivedOptions = options;
        return express();
      },
    });

    try {
      expect(receivedOptions).toEqual({
        dbFile: null,
        persistenceMode: "postgres",
        postgresUrl: "postgres://runtime/kpi",
        postgresLegacySqliteFallback: false,
      });
      expect(runtime.config.dbFile).toBeNull();
    } finally {
      await runtime.close();
    }
  });

  it("forwards explicit postgres sqlite-fallback guardrails to the runtime", async () => {
    let receivedOptions = null;

    const runtime = await startApiServer({
      dbFile: ":memory:",
      persistenceMode: "postgres",
      postgresUrl: "postgres://runtime/kpi",
      postgresLegacySqliteFallback: true,
      disableSignalHandlers: true,
      buildApp(options) {
        receivedOptions = options;
        return express();
      },
    });

    try {
      expect(receivedOptions).toEqual({
        dbFile: ":memory:",
        persistenceMode: "postgres",
        postgresUrl: "postgres://runtime/kpi",
        postgresLegacySqliteFallback: true,
      });
    } finally {
      await runtime.close();
    }
  });

  it("formats ipv6 and pipe addresses", () => {
    expect(formatListenAddress({ address: "::1", port: 3104 })).toBe("[::1]:3104");
    expect(formatListenAddress("\\\\.\\pipe\\kpi-api")).toBe("\\\\.\\pipe\\kpi-api");
  });
});
