/**
 * Vite chunk categorization strategy.
 *
 * Separates vendor dependencies into stable, cache-friendly chunks
 * grouped by update frequency, and extracts shared code used by ≥3
 * page modules into a dedicated common chunk.
 *
 * @module chunkStrategy
 */

/**
 * @typedef {Object} ChunkCategory
 * @property {string} name - Chunk name for the output bundle
 * @property {(moduleId: string) => boolean} test - Predicate to match module IDs
 * @property {number} priority - Higher priority wins on conflict (range 1–10)
 */

/** @type {ChunkCategory[]} */
export const CHUNK_CATEGORIES = [
  { name: 'vendor-react-dom', test: id => /react-dom|scheduler/.test(id), priority: 10 },
  { name: 'vendor-radix', test: id => /radix-ui/.test(id), priority: 9 },
  { name: 'vendor-lucide', test: id => /lucide-react/.test(id), priority: 8 },
  { name: 'vendor-recharts', test: id => /recharts|d3/.test(id), priority: 7 },
  { name: 'vendor-form', test: id => /zod|hookform|react-hook-form/.test(id), priority: 6 },
  { name: 'vendor-motion', test: id => /framer-motion/.test(id), priority: 5 },
  { name: 'vendor-misc', test: id => /node_modules/.test(id), priority: 1 },
];

/**
 * Categories sorted by descending priority for fast iteration.
 * @type {ChunkCategory[]}
 */
const SORTED_CATEGORIES = [...CHUNK_CATEGORIES].sort((a, b) => b.priority - a.priority);

/**
 * Determine the vendor chunk name for a given module ID.
 *
 * Iterates categories in priority order (highest first). The first match wins,
 * which handles conflict resolution when a module matches multiple categories
 * (e.g. a module path containing both "radix-ui" and "node_modules").
 *
 * @param {string} moduleId - The resolved module path from Vite/Rollup
 * @returns {string | undefined} The chunk name, or undefined if not a vendor module
 */
export function categorizeVendorModule(moduleId) {
  if (!moduleId.includes('node_modules')) {
    return undefined;
  }
  for (const category of SORTED_CATEGORIES) {
    if (category.test(moduleId)) {
      return category.name;
    }
  }
  return undefined;
}

/**
 * Page module route keys (the 13 lazy-loaded Page_Modules).
 * Used to track which source modules are shared across pages.
 */
const PAGE_MODULE_MARKERS = [
  'DataImporter',
  'RulesEditor',
  'ReportViewer',
  'TeamManager',
  'MstHqContainer',
  'KPIAdjustmentsWorkflowPanel',
  'AccountManager',
  'HQAgencyManager',
  'DataHealthDashboard',
  'AuditLog',
  'AiAssistant',
  'ReportCenterPanel',
  'AppDashboardLanding',
];

/**
 * Track module usage across page chunks for common chunk extraction.
 * Records which page modules import each source module.
 *
 * @type {Map<string, Set<string>>}
 */
const modulePageUsage = new Map();

/**
 * Detect which page module (if any) a given importer belongs to.
 * @param {string} importerPath
 * @returns {string | undefined}
 */
function detectPageModule(importerPath) {
  for (const marker of PAGE_MODULE_MARKERS) {
    if (importerPath.includes(marker)) {
      return marker;
    }
  }
  return undefined;
}

/**
 * Record that a source module is imported by a given page module.
 * Called during module resolution to build the usage map.
 *
 * @param {string} moduleId - The source module path
 * @param {string} pageModule - The page module that imports it
 */
export function recordModuleUsage(moduleId, pageModule) {
  if (!modulePageUsage.has(moduleId)) {
    modulePageUsage.set(moduleId, new Set());
  }
  modulePageUsage.get(moduleId).add(pageModule);
}

/**
 * Check if a source module qualifies for the common chunk
 * (used by ≥3 page modules).
 *
 * @param {string} moduleId
 * @returns {boolean}
 */
export function isCommonModule(moduleId) {
  const pages = modulePageUsage.get(moduleId);
  return pages != null && pages.size >= 3;
}

/**
 * Reset the usage tracking map (useful for testing).
 */
export function resetModuleUsage() {
  modulePageUsage.clear();
}

/**
 * Get the current module usage map (for testing/debugging).
 * @returns {Map<string, Set<string>>}
 */
export function getModuleUsage() {
  return modulePageUsage;
}

/**
 * The complete manualChunks function for Vite's Rollup output configuration.
 *
 * Strategy:
 * 1. Vendor modules → categorized by CHUNK_CATEGORIES with priority-based conflict resolution
 * 2. Non-vendor source modules used by ≥3 pages → 'common' chunk
 * 3. Everything else → default Rollup behavior (per-page chunks)
 *
 * @param {string} id - Module ID
 * @param {{ getModuleInfo: (id: string) => { importers: string[] } }} meta - Rollup module metadata
 * @returns {string | undefined}
 */
export function manualChunks(id, meta) {
  // Step 1: Vendor categorization
  const vendorChunk = categorizeVendorModule(id);
  if (vendorChunk) {
    return vendorChunk;
  }

  // Step 2: Track page-module usage for non-vendor code
  if (meta && meta.getModuleInfo) {
    const info = meta.getModuleInfo(id);
    if (info && info.importers) {
      for (const importer of info.importers) {
        const page = detectPageModule(importer);
        if (page) {
          recordModuleUsage(id, page);
        }
      }
    }
  }

  // Step 3: Common chunk for shared code
  if (isCommonModule(id)) {
    return 'common';
  }

  return undefined;
}
