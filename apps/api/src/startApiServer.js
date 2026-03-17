import path from "node:path";
import { pathToFileURL } from "node:url";

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
    if (
      error?.code === "ERR_MODULE_NOT_FOUND" ||
      String(error?.message ?? "").includes("Cannot find module")
    ) {
      throw new Error(
        `Missing compiled server-v4 runtime at ${modulePath}. Run "pnpm build:server-v4" first.`,
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
    persistenceMode: config.persistenceMode,
    postgresUrl: config.postgresUrl,
    postgresLegacySqliteFallback: config.postgresLegacySqliteFallback,
    importerCompat: {
      guardMode: config.importerCompatGuardMode,
    },
  });
  if (!app || typeof app.listen !== "function") {
    throw new Error("buildApp() must return an Express-compatible application with listen()");
  }

  const server = await listenApp(app, config);
  const close = createClose(server, app);

  if (!options.disableSignalHandlers) {
    const stop = async () => {
      await close();
      process.exitCode ??= 0;
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }

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

function createClose(server, app) {
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
    })();

    return closePromise;
  };
}
