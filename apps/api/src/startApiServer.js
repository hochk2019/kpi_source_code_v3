import path from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

import { resolveApiProjectRoot, resolveApiRuntimeConfig } from "./apiRuntimeConfig.js";

export async function loadCompiledBuildV4App(projectRoot = resolveApiProjectRoot()) {
  const modulePath = path.resolve(projectRoot, "dist", "server-v4", "index.js");

  try {
    const runtimeModule = await import(pathToFileURL(modulePath).href);
    if (typeof runtimeModule.buildV4App !== "function") {
      throw new Error(`Compiled server-v4 runtime is missing buildV4App(): ${modulePath}`);
    }

    return runtimeModule.buildV4App;
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

export async function startApiServer(options = {}) {
  const config = resolveApiRuntimeConfig(options);
  const buildApp = options.buildApp ?? (await loadCompiledBuildV4App(config.projectRoot));
  if (config.persistenceMode === "postgres" && !config.postgresUrl) {
    throw new Error("KPI_API_POSTGRES_URL is required when KPI_API_PERSISTENCE_MODE=postgres.");
  }

  const app = buildApp({
    dbFile: config.dbFile,
    importerCompatGuardMode: config.importerCompatGuardMode,
    persistenceMode: config.persistenceMode,
    postgresUrl: config.postgresUrl,
    postgresLegacySqliteFallback: config.postgresLegacySqliteFallback,
  });
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
