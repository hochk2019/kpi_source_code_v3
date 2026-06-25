#!/usr/bin/env node
/**
 * Legacy ↔ Server_V4 endpoint parity verification (Requirement 7.4).
 *
 * Confirms, endpoint-by-endpoint, that Server_V4 (`server-v4/`) handles every
 * route the retired Legacy_Server (`server/`) used to serve.
 *
 * The legacy `server/` directory was physically removed during the
 * server-retirement program, so the legacy API surface is read from a frozen
 * recorded inventory (`scripts/legacy-route-inventory.json`) instead of from a
 * live diff. Each legacy route is verified against the current Server_V4 route
 * surface, which is enumerated statically (no runtime import / server boot):
 *   - canonical `/api/v4/*` routes from the domain-module catalog
 *     (`server-v4/src/modules/<domain>/<domain>.module.ts`) plus the app-level
 *     v4 routes wired in `server-v4/src/app/build-v4-app.ts`
 *   - legacy-compatibility routes still served by the compat shim
 *     (`server-v4/src/app/legacyCompatRoutes.ts` + `legacy-compat/*.ts`)
 *
 * Run:  node --experimental-strip-types scripts/verify-legacy-parity.ts
 *       (exits non-zero if any recorded legacy route is unhandled by Server_V4)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type LegacyRouteCoverage = 'canonical' | 'legacy-compat';

export interface LegacyRouteEntry {
  method: HttpMethod;
  legacyPath: string;
  coverage: LegacyRouteCoverage;
  v4Path?: string;
  module?: string;
}

export interface LegacyRouteInventory {
  legacyDirectory: string;
  legacyDirectoryRemoved: boolean;
  routes: LegacyRouteEntry[];
}

export interface ServerV4Surface {
  canonical: Set<string>;
  legacyCompat: Set<string>;
}

export interface ParityResultRow {
  method: HttpMethod;
  legacyPath: string;
  coverage: LegacyRouteCoverage;
  expectedKey: string;
  covered: boolean;
}

export interface ParityResult {
  total: number;
  coveredCount: number;
  missing: ParityResultRow[];
  rows: ParityResultRow[];
  canonicalRouteCount: number;
  legacyCompatRouteCount: number;
}

const HTTP_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

/** Normalize an API path: strip query, template literals → `:param`, collapse slashes, drop trailing slash. */
export function normalizeRoutePath(rawPath: string): string {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    return '';
  }
  let value = rawPath.split('?')[0] ?? '';
  // `${expr}` template segments become a generic param placeholder.
  value = value.replace(/\$\{[^}]*\}/g, ':param');
  // Collapse duplicate slashes.
  value = value.replace(/\/{2,}/g, '/');
  // Drop trailing slash, but keep a lone root slash.
  if (value.length > 1 && value.endsWith('/')) {
    value = value.slice(0, -1);
  }
  return value;
}

/** Build a stable route key, e.g. `GET /api/v4/auth/login`. */
export function routeKey(method: string, routePath: string): string {
  return `${method.toUpperCase()} ${normalizeRoutePath(routePath)}`;
}

/** Join a domain-module basePath with a route path. */
export function joinRoute(basePath: string, routePath: string): string {
  const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  if (!routePath || routePath === '/') {
    return normalizeRoutePath(base);
  }
  const suffix = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return normalizeRoutePath(`${base}${suffix}`);
}

/**
 * Extract canonical route keys from a `*.module.ts` domain-module descriptor
 * source by reading its `basePath` and inline `{ method, path }` route entries.
 */
export function extractDomainModuleRoutes(source: string): string[] {
  if (typeof source !== 'string') {
    return [];
  }
  const baseMatch = source.match(/basePath:\s*['"]([^'"]+)['"]/);
  if (!baseMatch) {
    return [];
  }
  const basePath = baseMatch[1];
  const keys: string[] = [];
  const routeRegex =
    /method:\s*['"](GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*path:\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null = routeRegex.exec(source);
  while (match) {
    keys.push(routeKey(match[1], joinRoute(basePath, match[2])));
    match = routeRegex.exec(source);
  }
  return keys;
}

/**
 * Extract route keys from Express registration calls, e.g.
 * `router.post('/api/auth/login', ...)` or `app.get('/api/v4/health', ...)`.
 * Only `/api/*` paths are kept.
 */
export function extractExpressRoutes(source: string): string[] {
  if (typeof source !== 'string') {
    return [];
  }
  const keys: string[] = [];
  const callRegex =
    /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/gi;
  let match: RegExpExecArray | null = callRegex.exec(source);
  while (match) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    if (HTTP_METHODS.has(method) && routePath.startsWith('/api')) {
      keys.push(routeKey(method, routePath));
    }
    match = callRegex.exec(source);
  }
  return keys;
}

/** Build the Server_V4 route surface from categorized source inputs. */
export function buildServerV4Surface(inputs: {
  moduleSources: string[];
  appSources: string[];
  legacyCompatSources: string[];
}): ServerV4Surface {
  const canonical = new Set<string>();
  const legacyCompat = new Set<string>();

  for (const source of inputs.moduleSources) {
    for (const key of extractDomainModuleRoutes(source)) {
      canonical.add(key);
    }
  }

  // App-level Express routes: `/api/v4/*` are canonical, anything else legacy.
  for (const source of inputs.appSources) {
    for (const key of extractExpressRoutes(source)) {
      if (key.includes(' /api/v4/')) {
        canonical.add(key);
      } else {
        legacyCompat.add(key);
      }
    }
  }

  for (const source of inputs.legacyCompatSources) {
    for (const key of extractExpressRoutes(source)) {
      if (key.includes(' /api/v4/')) {
        canonical.add(key);
      } else {
        legacyCompat.add(key);
      }
    }
  }

  return { canonical, legacyCompat };
}

/** Compute endpoint-by-endpoint parity of the recorded legacy inventory vs Server_V4. */
export function computeParity(
  inventory: LegacyRouteInventory,
  surface: ServerV4Surface,
): ParityResult {
  const rows: ParityResultRow[] = inventory.routes.map((entry) => {
    const isCanonical = entry.coverage === 'canonical';
    const targetPath = isCanonical ? entry.v4Path ?? '' : entry.legacyPath;
    const expectedKey = routeKey(entry.method, targetPath);
    const pool = isCanonical ? surface.canonical : surface.legacyCompat;
    return {
      method: entry.method,
      legacyPath: entry.legacyPath,
      coverage: entry.coverage,
      expectedKey,
      covered: pool.has(expectedKey),
    };
  });

  const missing = rows.filter((row) => !row.covered);
  return {
    total: rows.length,
    coveredCount: rows.length - missing.length,
    missing,
    rows,
    canonicalRouteCount: surface.canonical.size,
    legacyCompatRouteCount: surface.legacyCompat.size,
  };
}

/** Render a human-readable parity report. */
export function formatParityReport(result: ParityResult): string {
  const lines: string[] = [];
  lines.push(
    `[legacy-parity] Server_V4 surface: ${result.canonicalRouteCount} canonical route(s), ${result.legacyCompatRouteCount} legacy-compat route(s)`,
  );
  lines.push(
    `[legacy-parity] legacy endpoints checked: ${result.total} | covered: ${result.coveredCount} | missing: ${result.missing.length}`,
  );
  for (const row of result.rows) {
    const status = row.covered ? 'OK  ' : 'MISS';
    lines.push(
      `  ${status} ${row.method.padEnd(6)} ${row.legacyPath}  ->  [${row.coverage}] ${row.expectedKey}`,
    );
  }
  if (result.missing.length > 0) {
    lines.push('[legacy-parity] FAIL: Server_V4 does not handle the legacy routes listed above.');
  } else {
    lines.push('[legacy-parity] PASS: Server_V4 handles every recorded legacy route.');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI wiring (filesystem access lives here so the logic above stays pure).
// ---------------------------------------------------------------------------

function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function collectModuleSources(modulesRoot: string): string[] {
  const sources: string[] = [];
  if (!fs.existsSync(modulesRoot)) {
    return sources;
  }
  for (const entry of fs.readdirSync(modulesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const moduleFile = path.join(modulesRoot, entry.name, `${entry.name}.module.ts`);
    if (fs.existsSync(moduleFile)) {
      sources.push(readFileSafe(moduleFile));
    }
  }
  return sources;
}

function collectLegacyCompatSources(appRoot: string): string[] {
  const sources: string[] = [readFileSafe(path.join(appRoot, 'legacyCompatRoutes.ts'))];
  const compatDir = path.join(appRoot, 'legacy-compat');
  if (fs.existsSync(compatDir)) {
    for (const entry of fs.readdirSync(compatDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        sources.push(readFileSafe(path.join(compatDir, entry.name)));
      }
    }
  }
  return sources;
}

export function loadInventory(inventoryPath: string): LegacyRouteInventory {
  const raw = fs.readFileSync(inventoryPath, 'utf8');
  return JSON.parse(raw) as LegacyRouteInventory;
}

export function runParityCheck(repoRoot: string): ParityResult {
  const serverV4Root = path.join(repoRoot, 'server-v4', 'src');
  const appRoot = path.join(serverV4Root, 'app');
  const inventory = loadInventory(path.join(repoRoot, 'scripts', 'legacy-route-inventory.json'));

  const surface = buildServerV4Surface({
    moduleSources: collectModuleSources(path.join(serverV4Root, 'modules')),
    appSources: [readFileSafe(path.join(appRoot, 'build-v4-app.ts'))],
    legacyCompatSources: collectLegacyCompatSources(appRoot),
  });

  return computeParity(inventory, surface);
}

function main(): void {
  const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const legacyDir = path.join(repoRoot, 'server');
  const legacyDirPresent = fs.existsSync(legacyDir);

  if (legacyDirPresent) {
    console.log('[legacy-parity] Legacy_Server directory present — verifying against recorded inventory.');
  } else {
    console.log(
      '[legacy-parity] Legacy_Server directory absent (already retired) — verifying Server_V4 against the recorded legacy route inventory.',
    );
  }

  const result = runParityCheck(repoRoot);
  console.log(formatParityReport(result));

  process.exitCode = result.missing.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
