/**
 * Property Test: Dependency Chunk Categorization (Property 1)
 *
 * Feature: system-redesign-2026, Property 1: Dependency Chunk Categorization
 *
 * For any npm package identifier string, the categorization function assigns
 * exactly one vendor chunk, deterministically (same input always produces same output).
 *
 * **Validates: Requirements 2.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { categorizeVendorModule, CHUNK_CATEGORIES } from '../../src/build/chunkStrategy.js';

/** All valid vendor chunk names that the function can return. */
const VALID_CHUNK_NAMES = CHUNK_CATEGORIES.map(c => c.name);

/**
 * Helper: generate a string from an allowed character set.
 */
const charString = (chars, min, max) =>
  fc.array(fc.constantFrom(...chars.split('')), { minLength: min, maxLength: max })
    .map(arr => arr.join(''));

const pkgNameChars = 'abcdefghijklmnopqrstuvwxyz-_0123456789';
const pathChars = 'abcdefghijklmnopqrstuvwxyz/._';
const srcPathChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/._-0123456789';

/**
 * Arbitrary that generates realistic npm module paths within node_modules.
 * Simulates paths like: /project/node_modules/package-name/dist/index.js
 */
const npmModuleIdArb = fc.oneof(
  // Specific known packages that match higher-priority categories
  fc.constantFrom(
    '/project/node_modules/react-dom/index.js',
    '/project/node_modules/scheduler/cjs/scheduler.production.min.js',
    '/project/node_modules/@radix-ui/react-dialog/dist/index.mjs',
    '/project/node_modules/@radix-ui/react-popover/dist/index.mjs',
    '/project/node_modules/lucide-react/dist/esm/icons/check.js',
    '/project/node_modules/recharts/es6/chart/LineChart.js',
    '/project/node_modules/d3/src/index.js',
    '/project/node_modules/zod/lib/index.mjs',
    '/project/node_modules/react-hook-form/dist/index.esm.mjs',
    '/project/node_modules/framer-motion/dist/es/index.mjs',
  ),
  // Random npm packages (will fall into vendor-misc)
  fc.tuple(
    charString(pkgNameChars, 1, 30),
    charString(pathChars, 0, 20),
  ).map(([pkg, subpath]) => `/project/node_modules/${pkg}/${subpath || 'index.js'}`),
  // Scoped packages (@org/pkg)
  fc.tuple(
    charString('abcdefghijklmnopqrstuvwxyz-', 1, 15),
    charString('abcdefghijklmnopqrstuvwxyz-', 1, 15),
    charString(pathChars, 0, 20),
  ).map(([org, pkg, subpath]) => `/project/node_modules/@${org}/${pkg}/${subpath || 'dist/index.mjs'}`),
);

/**
 * Arbitrary for paths that do NOT contain node_modules (source code).
 * These should always return undefined from categorizeVendorModule.
 */
const nonVendorModuleIdArb = charString(srcPathChars, 1, 80)
  .filter(s => !s.includes('node_modules'));

describe('Property 1: Dependency Chunk Categorization', () => {
  it('assigns exactly one vendor chunk to any npm package path (deterministic)', () => {
    fc.assert(
      fc.property(npmModuleIdArb, (moduleId) => {
        const result = categorizeVendorModule(moduleId);

        // Must return a valid chunk name (exactly one assignment)
        expect(result).toBeDefined();
        expect(VALID_CHUNK_NAMES).toContain(result);
      }),
      { numRuns: 200 },
    );
  });

  it('is deterministic — same input always produces same output', () => {
    fc.assert(
      fc.property(npmModuleIdArb, (moduleId) => {
        const result1 = categorizeVendorModule(moduleId);
        const result2 = categorizeVendorModule(moduleId);
        const result3 = categorizeVendorModule(moduleId);

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      }),
      { numRuns: 200 },
    );
  });

  it('returns undefined for non-vendor (non-node_modules) paths', () => {
    fc.assert(
      fc.property(nonVendorModuleIdArb, (moduleId) => {
        const result = categorizeVendorModule(moduleId);
        expect(result).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('every node_modules path maps to exactly one chunk (no multi-assignment)', () => {
    fc.assert(
      fc.property(npmModuleIdArb, (moduleId) => {
        const result = categorizeVendorModule(moduleId);

        // Count how many categories match this moduleId
        const matchingCategories = CHUNK_CATEGORIES.filter(c => c.test(moduleId));

        // The function must assign exactly one chunk regardless of how many categories match
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');

        // If multiple categories match, the result should still be a single string
        // (priority-based resolution ensures exactly one winner)
        if (matchingCategories.length > 1) {
          // The chosen chunk should be the highest-priority match
          const sorted = [...matchingCategories].sort((a, b) => b.priority - a.priority);
          expect(result).toBe(sorted[0].name);
        }
      }),
      { numRuns: 200 },
    );
  });
});
