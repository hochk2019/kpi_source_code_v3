import path from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

import { resolveApiProjectRoot, resolveApiRuntimeConfig } from "./apiRuntimeConfig.js";

const EXPORT_AUDIT_DEFAULT_LIMIT = 50;
const EXPORT_AUDIT_MAX_LIMIT = 200;

function normalizeQueryString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampPositiveInt(value, { min = 1, max = Number.MAX_SAFE_INTEGER, fallback = 1 } = {}) {
  const numeric = Number.parseInt(`${value ?? ""}`, 10);
  if (!Number.isFinite(numeric) || numeric < min) {
    return fallback;
  }
  if (numeric > max) {
    return max;
  }
  return numeric;
}

export function createDefaultReportingRuntime() {
  return {
    exportReport: async (_req, res) => {
      res.status(501).json({
        ok: false,
        error: "Tính năng xuất báo cáo chưa được cấu hình cho runtime backend hiện tại.",
      });
    },
    listExportAudit: async (req, res) => {
      const rawLimit = Array.isArray(req?.query?.limit) ? req.query.limit[0] : req?.query?.limit;
      const rawPage = Array.isArray(req?.query?.page) ? req.query.page[0] : req?.query?.page;
      const rawFrom = Array.isArray(req?.query?.from) ? req.query.from[0] : req?.query?.from;
      const rawTo = Array.isArray(req?.query?.to) ? req.query.to[0] : req?.query?.to;
      const rawKind = Array.isArray(req?.query?.kind) ? req.query.kind[0] : req?.query?.kind;
      const rawSearch = Array.isArray(req?.query?.search) ? req.query.search[0] : req?.query?.search;

      const limit = clampPositiveInt(rawLimit, {
        min: 10,
        max: EXPORT_AUDIT_MAX_LIMIT,
        fallback: EXPORT_AUDIT_DEFAULT_LIMIT,
      });
      const page = clampPositiveInt(rawPage, { min: 1, max: 1000, fallback: 1 });
      const kind = normalizeQueryString(rawKind).toLowerCase();

      res.status(200).json({
        ok: true,
        entries: [],
        total: 0,
        page,
        pageSize: limit,
        pageCount: 1,
        summary: {
          total: 0,
          latestCreatedAt: null,
          byKind: [],
          topUsers: [],
          latestView: null,
          recentViews: [],
          totalViews: 0,
        },
        filters: {
          from: normalizeQueryString(rawFrom),
          to: normalizeQueryString(rawTo),
          kind: kind && kind !== "all" ? kind : "all",
          search: normalizeQueryString(rawSearch),
        },
        availableKinds: [],
      });
    },
    exportAdminAudit: async (_req, res) => {
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.status(200).send("ts,actor,action,detail\r\n");
    },
  };
}

async function loadCompiledRuntimeModule(projectRoot = resolveApiProjectRoot()) {
  const modulePath = path.resolve(projectRoot, "dist", "server-v4", "index.js");

  try {
    const runtimeModule = await import(pathToFileURL(modulePath).href);
    if (typeof runtimeModule.buildV4App !== "function") {
      throw new Error(`Compiled server-v4 runtime is missing buildV4App(): ${modulePath}`);
    }

    return runtimeModule;
  } catch (error) {
    const message = String(error?.message ?? "");
    const isMissingModuleError =
      error?.code === "ERR_MODULE_NOT_FOUND" ||
      message.includes("Cannot find module") ||
      message.includes("Cannot find package") ||
      message.includes("Failed to load url");

    if (isMissingModuleError) {
      if (!existsSync(modulePath)) {
        throw new Error(
          `Missing compiled server-v4 runtime at ${modulePath}. Run "pnpm build:server-v4" first.`,
        );
      }

      const missingDependency =
        message.match(/Cannot find module '([^']+)'/i)?.[1] ??
        message.match(/Cannot find package '([^']+)'/i)?.[1] ??
        message.match(/Failed to load url ([^\s)]+)/i)?.[1] ??
        null;
      const importedFrom = message.match(/imported from ([^\n]+)/i)?.[1]?.trim() ?? null;
      const dependencyHint = missingDependency
        ? `Missing dependency "${missingDependency}"` +
          (importedFrom ? ` imported from ${importedFrom}` : "")
        : "A dependency of the compiled runtime is missing";

      throw new Error(
        `Compiled server-v4 runtime at ${modulePath} cannot be loaded. ${dependencyHint}. Run "pnpm build:server-v4" and ensure JS companion files are emitted to dist/server-v4.`,
      );
    }

    throw error;
  }
}

export async function loadCompiledBuildV4App(projectRoot = resolveApiProjectRoot()) {
  const runtimeModule = await loadCompiledRuntimeModule(projectRoot);
  return runtimeModule.buildV4App;
}

export function formatListenAddress(address) {
  if (!address) {
    return "unknown";
  }

  if (typeof address === "string") {
    return address;
  }

  const host = address.address.includes(":") ? `[${address.address}]` : address.address;
  return `${host}:${address.port}`;
}

function resolveReportingReaders(persistence) {
  return {
    adjustmentsReader: persistence.adjustmentsReader,
    declarationsReader: persistence.declarationsReader,
    kpiRulesReader: persistence.kpiRulesReader,
    teamsReader: persistence.teamsReader,
  };
}

function resolveStandaloneReportingRuntime(options, config, runtimeModule) {
  if (options.reporting) {
    return { reportingRuntime: options.reporting, runtimePersistence: null };
  }

  if (options.buildApp) {
    return { reportingRuntime: createDefaultReportingRuntime(), runtimePersistence: null };
  }

  const createRuntimePersistence = runtimeModule?.createRuntimePersistence;
  const createStandaloneReportingRuntime = runtimeModule?.createStandaloneReportingRuntime;
  if (
    typeof createRuntimePersistence !== "function" ||
    typeof createStandaloneReportingRuntime !== "function"
  ) {
    return { reportingRuntime: createDefaultReportingRuntime(), runtimePersistence: null };
  }

  const runtimePersistence = createRuntimePersistence({
    dbFile: config.dbFile,
    persistenceMode: config.persistenceMode,
    postgresUrl: config.postgresUrl,
    postgresLegacySqliteFallback: config.postgresLegacySqliteFallback,
  });
  const reportingRuntime = createStandaloneReportingRuntime({
    authStore: runtimePersistence.authStore,
    projections: runtimePersistence.projections,
    readers: resolveReportingReaders(runtimePersistence),
  });

  return { reportingRuntime, runtimePersistence };
}

export async function startApiServer(options = {}) {
  const config = resolveApiRuntimeConfig(options);
  const runtimeModule =
    options.runtimeModule ?? (options.buildApp ? null : await loadCompiledRuntimeModule(config.projectRoot));
  const buildApp = options.buildApp ?? runtimeModule?.buildV4App;
  if (typeof buildApp !== "function") {
    throw new Error("Unable to resolve buildApp() from runtime module.");
  }
  const { reportingRuntime, runtimePersistence } = resolveStandaloneReportingRuntime(
    options,
    config,
    runtimeModule,
  );
  if (config.persistenceMode === "postgres" && !config.postgresUrl) {
    throw new Error("KPI_API_POSTGRES_URL is required when KPI_API_PERSISTENCE_MODE=postgres.");
  }

  const buildOptions = {
    dbFile: config.dbFile,
    importerCompatGuardMode: config.importerCompatGuardMode,
    persistenceMode: config.persistenceMode,
    postgresUrl: config.postgresUrl,
    postgresLegacySqliteFallback: config.postgresLegacySqliteFallback,
    reporting: reportingRuntime,
  };
  if (runtimePersistence) {
    buildOptions.persistence = runtimePersistence;
  }

  const app = buildApp(buildOptions);
  if (!app || typeof app.listen !== "function") {
    throw new Error("buildApp() must return an Express-compatible application with listen()");
  }

  const server = await listenApp(app, config);
  let cleanupProcessHandlers = () => {};
  const close = createClose(server, app, () => cleanupProcessHandlers());
  cleanupProcessHandlers = registerRuntimeProcessHandlers(close, {
    disableSignalHandlers: options.disableSignalHandlers,
  });

  return {
    app,
    server,
    close,
    config,
    listenAddress: formatListenAddress(server.address()),
  };
}

function listenApp(app, config) {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve(server);
    });

    server.once("error", reject);
  });
}

function createClose(server, app, cleanup = () => {}) {
  let closePromise = null;

  return () => {
    if (closePromise) {
      return closePromise;
    }

    closePromise = (async () => {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      if (typeof app?.locals?.runtimePersistenceDispose === "function") {
        await app.locals.runtimePersistenceDispose();
      }
    })().finally(() => {
      cleanup();
    });

    return closePromise;
  };
}

function registerRuntimeProcessHandlers(close, options = {}) {
  const stop = async () => {
    await close();
    process.exitCode ??= 0;
  };
  const logUnhandledRejection = (reason) => {
    console.error("[kpi-api] Unhandled promise rejection", reason);
  };
  const logUncaughtException = (error) => {
    console.error("[kpi-api] Uncaught exception", error);
  };

  if (!options.disableSignalHandlers) {
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }

  process.on("unhandledRejection", logUnhandledRejection);
  process.on("uncaughtExceptionMonitor", logUncaughtException);

  return () => {
    process.off("unhandledRejection", logUnhandledRejection);
    process.off("uncaughtExceptionMonitor", logUncaughtException);

    if (!options.disableSignalHandlers) {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
  };
}
