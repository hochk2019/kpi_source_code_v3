import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const API_ENTRYPOINT_MODES = Object.freeze({
  legacy: "legacy",
  serverV4: "server-v4",
});

const VALID_API_ENTRYPOINT_MODES = new Set(Object.values(API_ENTRYPOINT_MODES));

export function resolveApiEntrypointMode({ envMode, flagMode } = {}) {
  const candidate = flagMode ?? envMode ?? API_ENTRYPOINT_MODES.serverV4;
  const normalized = String(candidate).trim().toLowerCase();

  if (!VALID_API_ENTRYPOINT_MODES.has(normalized)) {
    throw new Error(
      'KPI_API_ENTRYPOINT_MODE must be "legacy" or "server-v4".',
    );
  }

  return normalized;
}

export function resolveBackendEntrypointPlan({
  envMode = process.env.KPI_API_ENTRYPOINT_MODE,
  flagMode,
  rootDir = resolve(__dirname, "..", "..", ".."),
} = {}) {
  const mode = resolveApiEntrypointMode({ envMode, flagMode });
  const isLegacy = mode === API_ENTRYPOINT_MODES.legacy;

  return {
    mode,
    label: isLegacy ? "legacy-monolith" : "server-v4-standalone",
    rollbackMode: API_ENTRYPOINT_MODES.legacy,
    entryFile: isLegacy
      ? resolve(rootDir, "server", "index.js")
      : resolve(rootDir, "apps", "api", "src", "cli.js"),
  };
}
