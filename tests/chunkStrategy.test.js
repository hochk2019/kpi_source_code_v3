/**
 * Tests for the Vite chunk categorization strategy.
 *
 * Covers:
 * - Unit tests for each vendor category
 * - Priority-based conflict resolution
 * - Common chunk extraction (≥3 page modules)
 * - Property-based test for deterministic categorization (Property 1)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  CHUNK_CATEGORIES,
  categorizeVendorModule,
  manualChunks,
  recordModuleUsage,
  isCommonModule,
  resetModuleUsage,
} from '../src/build/chunkStrategy.js';

// ─── Unit Tests ────────────────────────────────────────────────────────────

describe('chunkStrategy — unit tests', () => {
  describe('categorizeVendorModule', () => {
    it('returns undefined for non-node_modules paths', () => {
      expect(categorizeVendorModule('/src/components/MyComponent.tsx')).toBeUndefined();
      expect(categorizeVendorModule('/src/lib/utils.ts')).toBeUndefined();
    });

    it('categorizes react-dom into vendor-react-dom', () => {
      expect(
        categorizeVendorModule('/project/node_modules/react-dom/cjs/react-dom.production.js'),
      ).toBe('vendor-react-dom');
    });

    it('categorizes scheduler into vendor-react-dom', () => {
      expect(
        categorizeVendorModule('/project/node_modules/scheduler/cjs/scheduler.production.js'),
      ).toBe('vendor-react-dom');
    });

    it('categorizes radix-ui into vendor-radix', () => {
      expect(
        categorizeVendorModule('/project/node_modules/@radix-ui/react-dialog/dist/index.mjs'),
      ).toBe('vendor-radix');
    });

    it('categorizes lucide-react into vendor-lucide', () => {
      expect(
        categorizeVendorModule('/project/node_modules/lucide-react/dist/esm/icons/check.js'),
      ).toBe('vendor-lucide');
    });

    it('categorizes recharts into vendor-recharts', () => {
      expect(
        categorizeVendorModule('/project/node_modules/recharts/es6/chart/LineChart.js'),
      ).toBe('vendor-recharts');
    });

    it('categorizes d3 into vendor-recharts', () => {
      expect(
        categorizeVendorModule('/project/node_modules/d3-scale/src/linear.js'),
      ).toBe('vendor-recharts');
    });

    it('categorizes zod into vendor-form', () => {
      expect(categorizeVendorModule('/project/node_modules/zod/lib/index.mjs')).toBe(
        'vendor-form',
      );
    });

    it('categorizes react-hook-form into vendor-form', () => {
      expect(
        categorizeVendorModule('/project/node_modules/react-hook-form/dist/index.esm.mjs'),
      ).toBe('vendor-form');
    });

    it('categorizes hookform resolvers into vendor-form', () => {
      expect(
        categorizeVendorModule('/project/node_modules/@hookform/resolvers/zod/dist/index.mjs'),
      ).toBe('vendor-form');
    });

    it('categorizes framer-motion into vendor-motion', () => {
      expect(
        categorizeVendorModule('/project/node_modules/framer-motion/dist/es/index.mjs'),
      ).toBe('vendor-motion');
    });

    it('categorizes unknown vendor into vendor-misc', () => {
      expect(categorizeVendorModule('/project/node_modules/lodash-es/chunk.js')).toBe(
        'vendor-misc',
      );
    });
  });

  describe('priority-based conflict resolution', () => {
    it('react-dom wins over vendor-misc (priority 10 > 1)', () => {
      // react-dom path also matches node_modules (vendor-misc)
      const id = '/project/node_modules/react-dom/index.js';
      expect(categorizeVendorModule(id)).toBe('vendor-react-dom');
    });

    it('radix-ui wins over vendor-misc (priority 9 > 1)', () => {
      const id = '/project/node_modules/@radix-ui/react-select/dist/index.mjs';
      expect(categorizeVendorModule(id)).toBe('vendor-radix');
    });

    it('d3 inside recharts still goes to vendor-recharts', () => {
      const id = '/project/node_modules/recharts/node_modules/d3-shape/src/arc.js';
      expect(categorizeVendorModule(id)).toBe('vendor-recharts');
    });

    it('hookform with zod — hookform resolvers get vendor-form (both match form)', () => {
      const id = '/project/node_modules/@hookform/resolvers/zod/dist/zod.mjs';
      expect(categorizeVendorModule(id)).toBe('vendor-form');
    });
  });

  describe('common chunk extraction', () => {
    beforeEach(() => {
      resetModuleUsage();
    });

    it('module used by fewer than 3 pages is NOT common', () => {
      recordModuleUsage('/src/lib/utils.ts', 'DataImporter');
      recordModuleUsage('/src/lib/utils.ts', 'RulesEditor');
      expect(isCommonModule('/src/lib/utils.ts')).toBe(false);
    });

    it('module used by exactly 3 pages IS common', () => {
      recordModuleUsage('/src/lib/utils.ts', 'DataImporter');
      recordModuleUsage('/src/lib/utils.ts', 'RulesEditor');
      recordModuleUsage('/src/lib/utils.ts', 'TeamManager');
      expect(isCommonModule('/src/lib/utils.ts')).toBe(true);
    });

    it('module used by more than 3 pages IS common', () => {
      recordModuleUsage('/src/hooks/useForm.ts', 'DataImporter');
      recordModuleUsage('/src/hooks/useForm.ts', 'RulesEditor');
      recordModuleUsage('/src/hooks/useForm.ts', 'TeamManager');
      recordModuleUsage('/src/hooks/useForm.ts', 'AccountManager');
      recordModuleUsage('/src/hooks/useForm.ts', 'AuditLog');
      expect(isCommonModule('/src/hooks/useForm.ts')).toBe(true);
    });

    it('duplicate page-module recordings do not inflate the count', () => {
      recordModuleUsage('/src/lib/api.ts', 'DataImporter');
      recordModuleUsage('/src/lib/api.ts', 'DataImporter');
      recordModuleUsage('/src/lib/api.ts', 'RulesEditor');
      expect(isCommonModule('/src/lib/api.ts')).toBe(false);
    });
  });

  describe('manualChunks integration', () => {
    beforeEach(() => {
      resetModuleUsage();
    });

    it('returns vendor chunk for node_modules paths', () => {
      const result = manualChunks('/project/node_modules/react-dom/index.js', null);
      expect(result).toBe('vendor-react-dom');
    });

    it('returns undefined for source code without enough page usage', () => {
      const meta = {
        getModuleInfo: () => ({ importers: ['/src/components/DataImporter.tsx'] }),
      };
      const result = manualChunks('/src/lib/helpers.ts', meta);
      // Only 1 page imports it, not enough for common
      expect(result).toBeUndefined();
    });

    it('returns "common" when module is imported by ≥3 pages', () => {
      // Pre-record usage to simulate previous resolution passes
      recordModuleUsage('/src/lib/shared.ts', 'DataImporter');
      recordModuleUsage('/src/lib/shared.ts', 'RulesEditor');
      recordModuleUsage('/src/lib/shared.ts', 'TeamManager');

      const meta = {
        getModuleInfo: () => ({ importers: [] }),
      };
      const result = manualChunks('/src/lib/shared.ts', meta);
      expect(result).toBe('common');
    });
  });
});

// ─── Property-Based Tests ──────────────────────────────────────────────────

describe('chunkStrategy — property tests', () => {
  /**
   * Property 1: Dependency Chunk Categorization
   *
   * For any npm package identifier string, the chunk categorization function
   * SHALL assign it to exactly one vendor chunk category based on its module
   * path, and that assignment SHALL be deterministic (same input always
   * produces same output).
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 1: Dependency Chunk Categorization', () => {
    // Arbitrary for generating realistic node_modules paths
    const vendorModuleIdArb = fc.oneof(
      // Specific known packages
      fc.constantFrom(
        '/project/node_modules/react-dom/cjs/react-dom.production.js',
        '/project/node_modules/scheduler/index.js',
        '/project/node_modules/@radix-ui/react-dialog/dist/index.mjs',
        '/project/node_modules/@radix-ui/react-select/dist/select.js',
        '/project/node_modules/lucide-react/dist/esm/icons/check.js',
        '/project/node_modules/recharts/es6/chart/LineChart.js',
        '/project/node_modules/d3-scale/src/linear.js',
        '/project/node_modules/d3-shape/src/arc.js',
        '/project/node_modules/zod/lib/index.mjs',
        '/project/node_modules/react-hook-form/dist/index.esm.mjs',
        '/project/node_modules/@hookform/resolvers/dist/index.mjs',
        '/project/node_modules/framer-motion/dist/es/index.mjs',
        '/project/node_modules/lodash-es/chunk.js',
        '/project/node_modules/clsx/dist/clsx.mjs',
        '/project/node_modules/date-fns/esm/index.js',
        '/project/node_modules/class-variance-authority/dist/index.mjs',
      ),
      // Random node_modules path
      fc.string({ minLength: 1, maxLength: 40 }).map(s => `/project/node_modules/${s}/index.js`),
    );

    const sourceModuleIdArb = fc.string({ minLength: 1, maxLength: 60 }).map(
      s => `/project/src/${s.replace(/node_modules/g, 'nm')}.ts`,
    );

    const anyModuleIdArb = fc.oneof(vendorModuleIdArb, sourceModuleIdArb);

    it(
      'assigns exactly one category to any node_modules path (no ambiguity)',
      () => {
        fc.assert(
          fc.property(vendorModuleIdArb, moduleId => {
            const result = categorizeVendorModule(moduleId);
            // Must return a string (one category)
            expect(result).toBeTypeOf('string');
            // Must be one of the known category names
            const validNames = CHUNK_CATEGORIES.map(c => c.name);
            expect(validNames).toContain(result);
          }),
          { numRuns: 200 },
        );
      },
    );

    it(
      'is deterministic — same input always produces same output',
      () => {
        fc.assert(
          fc.property(anyModuleIdArb, moduleId => {
            const result1 = categorizeVendorModule(moduleId);
            const result2 = categorizeVendorModule(moduleId);
            const result3 = categorizeVendorModule(moduleId);
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          }),
          { numRuns: 200 },
        );
      },
    );

    it(
      'non-vendor modules always return undefined',
      () => {
        fc.assert(
          fc.property(sourceModuleIdArb, moduleId => {
            const result = categorizeVendorModule(moduleId);
            expect(result).toBeUndefined();
          }),
          { numRuns: 200 },
        );
      },
    );

    it(
      'higher-priority category always wins when multiple match',
      () => {
        fc.assert(
          fc.property(vendorModuleIdArb, moduleId => {
            const result = categorizeVendorModule(moduleId);
            // Find all matching categories
            const matches = CHUNK_CATEGORIES.filter(c => c.test(moduleId));
            // The result should be the highest priority match
            if (matches.length > 0) {
              const highestPriority = matches.reduce((best, curr) =>
                curr.priority > best.priority ? curr : best,
              );
              expect(result).toBe(highestPriority.name);
            }
          }),
          { numRuns: 200 },
        );
      },
    );
  });
});
