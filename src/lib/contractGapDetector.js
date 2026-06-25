/**
 * Contract gap detection logic.
 *
 * Computes missingBackend (F \ B) and unusedBackend (B \ F) gaps
 * from sets of frontend API calls and backend registered endpoints.
 *
 * @module contractGapDetector
 */

/**
 * @typedef {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} HttpMethod
 */

/**
 * @typedef {object} FrontendCall
 * @property {string} pageModule - The Page_Module that makes this call
 * @property {HttpMethod} method - HTTP method
 * @property {string} path - Normalized API path (e.g. /api/v4/teams/:param)
 * @property {string} source - Source file location
 */

/**
 * @typedef {object} BackendEndpoint
 * @property {string} moduleId - The domain module id
 * @property {HttpMethod} method - HTTP method
 * @property {string} path - Full endpoint path (basePath + route path)
 * @property {string} source - Source file that defines this module
 */

/**
 * @typedef {object} ContractGap
 * @property {'missing-backend'|'unused-backend'} type
 * @property {string} [pageModule] - Present for missing-backend gaps
 * @property {string} method
 * @property {string} path
 * @property {string} [source] - File location
 */

/**
 * @typedef {object} ContractReport
 * @property {string} timestamp
 * @property {number} totalFrontendCalls
 * @property {number} totalBackendEndpoints
 * @property {ContractGap[]} missingBackend
 * @property {ContractGap[]} unusedBackend
 * @property {ContractGap[]} newGapsSinceLastRun
 */

/**
 * Create a canonical key for comparing frontend calls to backend endpoints.
 * Normalizes param segments so /teams/:teamId matches /teams/:param.
 * @param {string} method
 * @param {string} path
 * @returns {string}
 */
export function makeEndpointKey(method, path) {
  const normalized = path
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':param')
    .replace(/\/+$/, '') || '/';
  return `${method.toUpperCase()} ${normalized}`;
}

/**
 * Detect HTTP method from the source context around an API path usage.
 * Scans both backwards and forwards from the path position for method indicators.
 * @param {string} sourceText - Full source content
 * @param {number} pathIndex - Start index of the API path in source
 * @returns {HttpMethod}
 */
export function inferHttpMethod(sourceText, pathIndex) {
  // Look at the statement context: backwards 300 chars, forward to next statement end
  const contextStart = Math.max(0, pathIndex - 300);
  const before = sourceText.slice(contextStart, pathIndex).toLowerCase();

  // Forward: find the end of the current statement (next semicolon)
  const afterFull = sourceText.slice(pathIndex, pathIndex + 500);
  const semiIndex = afterFull.indexOf(';');
  const after = (semiIndex > 0 ? afterFull.slice(0, semiIndex) : afterFull.slice(0, 200)).toLowerCase();

  // Check for explicit method property in the before context (same statement)
  // Find the start of the current statement by looking for previous semicolon
  const stmtStartSearch = before.lastIndexOf(';');
  const stmtBefore = stmtStartSearch >= 0 ? before.slice(stmtStartSearch) : before.slice(-200);

  const beforeMethodMatch = stmtBefore.match(/method\s*[:=]\s*['"]?(post|put|patch|delete|get)['"]?/i);
  if (beforeMethodMatch) {
    return beforeMethodMatch[1].toUpperCase();
  }

  // Check forward context (same statement up to semicolon)
  const afterMethodMatch = after.match(/method\s*[:=]\s*['"]?(post|put|patch|delete|get)['"]?/i);
  if (afterMethodMatch) {
    return afterMethodMatch[1].toUpperCase();
  }

  // Check for fetch-style calls or variable naming hints in nearby before-context
  if (/\b(post|submit|create)\b/.test(stmtBefore.slice(-80))) return 'POST';
  if (/\b(put|replace|update)\b/.test(stmtBefore.slice(-80)) && !/patch/i.test(stmtBefore.slice(-80))) return 'PUT';
  if (/\bpatch\b/.test(stmtBefore.slice(-80))) return 'PATCH';
  if (/\b(delete|remove)\b/.test(stmtBefore.slice(-80))) return 'DELETE';

  return 'GET';
}

/**
 * Infer the Page_Module from a source file path.
 * @param {string} filePath
 * @returns {string}
 */
export function inferPageModule(filePath) {
  const normalized = filePath.replace(/\\/g, '/');

  const PAGE_MODULE_MAP = [
    { pattern: /components\/dataImporter\b|DataImporter/i, module: 'DataImporter' },
    { pattern: /components\/rules-editor\b|RulesEditor/i, module: 'RulesEditor' },
    { pattern: /components\/reporting\b|ReportViewer/i, module: 'ReportViewer' },
    { pattern: /components\/team-manager\b|TeamManager/i, module: 'TeamManager' },
    { pattern: /components\/mst-assignment\b|Mst.*Container|MSTAssignment/i, module: 'MSTAssignment' },
    { pattern: /components\/kpi-adjustments\b|KPIAdjustments/i, module: 'KPIAdjustments' },
    { pattern: /components\/account-manager\b|AccountManager/i, module: 'AccountManager' },
    { pattern: /components\/hq-agency-manager\b|HQAgencyManager/i, module: 'HQAgencyManager' },
    { pattern: /components\/data-health-dashboard\b|DataHealthDashboard/i, module: 'DataHealthDashboard' },
    { pattern: /components\/audit-log\b|components\/auditLog\b|AuditLog/i, module: 'AuditLog' },
    { pattern: /components\/ai-assistant\b|AiAssistant/i, module: 'AiAssistant' },
    { pattern: /components\/workflows\/ReportCenter|ReportCenter/i, module: 'ReportCenter' },
    { pattern: /components\/appShell\/AppDashboard|AppDashboardLanding/i, module: 'AppDashboardLanding' },
    { pattern: /ExportAuditReport/i, module: 'ReportViewer' },
  ];

  for (const { pattern, module } of PAGE_MODULE_MAP) {
    if (pattern.test(normalized)) return module;
  }

  return 'Unknown';
}

/**
 * Extract frontend API calls from source file entries with method inference.
 * @param {{ filePath: string, sourceText: string }[]} fileEntries
 * @returns {FrontendCall[]}
 */
export function extractFrontendCalls(fileEntries) {
  const API_PATH_REGEX = /\/api\/[A-Za-z0-9_./:?${}=&%-]*/g;
  /** @type {FrontendCall[]} */
  const calls = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (const entry of fileEntries) {
    const { filePath, sourceText } = entry;
    if (!sourceText) continue;

    const pageModule = inferPageModule(filePath);
    let match;
    // Reset regex lastIndex
    API_PATH_REGEX.lastIndex = 0;
    while ((match = API_PATH_REGEX.exec(sourceText)) !== null) {
      const rawPath = match[0];
      if (rawPath.startsWith('/api//')) continue;

      // Strip query string
      const pathOnly = rawPath.split('?')[0] || '';
      // Only canonical /api/v4/ paths
      if (!pathOnly.startsWith('/api/v4/')) continue;

      // Normalize template expressions
      const normalized = pathOnly.replace(/\$\{[^}]+\}/g, ':param');
      const method = inferHttpMethod(sourceText, match.index);
      const key = `${method}|${normalized}|${filePath}`;
      if (seen.has(key)) continue;
      seen.add(key);

      calls.push({
        pageModule,
        method,
        path: normalized,
        source: filePath,
      });
    }
  }
  return calls;
}

/**
 * Build the set of backend endpoints from the module catalog data.
 * @param {{ id: string, basePath: string, routeGroups: { routes: { method: string, path: string }[] }[] }[]} modules
 * @param {string} [sourcePrefix] - Path prefix for source file references
 * @returns {BackendEndpoint[]}
 */
export function extractBackendEndpoints(modules, sourcePrefix = 'server-v4/src/modules') {
  /** @type {BackendEndpoint[]} */
  const endpoints = [];

  for (const mod of modules) {
    const source = `${sourcePrefix}/${mod.id}/${mod.id}.module.ts`;
    for (const group of mod.routeGroups) {
      for (const route of group.routes) {
        // Skip internal __meta routes
        if (route.path === '/__meta') continue;

        const fullPath = `${mod.basePath}${route.path}`;
        endpoints.push({
          moduleId: mod.id,
          method: route.method,
          path: fullPath,
          source,
        });
      }
    }
  }
  return endpoints;
}

/**
 * Compute contract gaps: F \ B (missingBackend) and B \ F (unusedBackend).
 * @param {FrontendCall[]} frontendCalls
 * @param {BackendEndpoint[]} backendEndpoints
 * @returns {{ missingBackend: ContractGap[], unusedBackend: ContractGap[] }}
 */
export function computeGaps(frontendCalls, backendEndpoints) {
  const backendKeys = new Set(
    backendEndpoints.map(ep => makeEndpointKey(ep.method, ep.path))
  );
  const frontendKeys = new Set(
    frontendCalls.map(fc => makeEndpointKey(fc.method, fc.path))
  );

  /** @type {ContractGap[]} */
  const missingBackend = [];
  const seenMissing = new Set();

  for (const fc of frontendCalls) {
    const key = makeEndpointKey(fc.method, fc.path);
    if (!backendKeys.has(key)) {
      // Deduplicate by method+path (report once per unique gap)
      const gapKey = `${fc.method}|${fc.path}`;
      if (seenMissing.has(gapKey)) continue;
      seenMissing.add(gapKey);

      missingBackend.push({
        type: 'missing-backend',
        pageModule: fc.pageModule,
        method: fc.method,
        path: fc.path,
        source: fc.source,
      });
    }
  }

  /** @type {ContractGap[]} */
  const unusedBackend = [];
  for (const ep of backendEndpoints) {
    const key = makeEndpointKey(ep.method, ep.path);
    if (!frontendKeys.has(key)) {
      unusedBackend.push({
        type: 'unused-backend',
        pageModule: ep.moduleId,
        method: ep.method,
        path: ep.path,
        source: ep.source,
      });
    }
  }

  return { missingBackend, unusedBackend };
}

/**
 * Compare current gaps with a previous report to find new gaps.
 * @param {ContractGap[]} currentGaps - All current gaps (missing + unused)
 * @param {ContractGap[]} previousGaps - All gaps from the previous report
 * @returns {ContractGap[]}
 */
export function findNewGaps(currentGaps, previousGaps) {
  const previousKeys = new Set(
    previousGaps.map(g => `${g.type}|${g.method}|${g.path}`)
  );

  return currentGaps.filter(g => {
    const key = `${g.type}|${g.method}|${g.path}`;
    return !previousKeys.has(key);
  });
}

/**
 * Build a full ContractReport from frontend calls and backend endpoints.
 * @param {FrontendCall[]} frontendCalls
 * @param {BackendEndpoint[]} backendEndpoints
 * @param {ContractReport|null} previousReport
 * @returns {ContractReport}
 */
export function buildContractReport(frontendCalls, backendEndpoints, previousReport) {
  const { missingBackend, unusedBackend } = computeGaps(frontendCalls, backendEndpoints);

  const allCurrentGaps = [...missingBackend, ...unusedBackend];
  const previousGaps = previousReport
    ? [...(previousReport.missingBackend || []), ...(previousReport.unusedBackend || [])]
    : [];

  const newGapsSinceLastRun = findNewGaps(allCurrentGaps, previousGaps);

  return {
    timestamp: new Date().toISOString(),
    totalFrontendCalls: frontendCalls.length,
    totalBackendEndpoints: backendEndpoints.length,
    missingBackend,
    unusedBackend,
    newGapsSinceLastRun,
  };
}
