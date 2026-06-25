/**
 * Property Test: Contract Verification Gap Detection (Property 25)
 *
 * Feature: system-redesign-2026, Property 25: Contract Verification Gap Detection
 *
 * For any set of frontend API calls F and backend registered endpoints B:
 * (a) every element in F \ B SHALL appear in the missingBackend report
 * (b) every element in B \ F SHALL appear in the unusedBackend report
 * (c) matched elements (F ∩ B) appear in neither report
 *
 * **Validates: Requirements 14.2, 14.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeGaps, makeEndpointKey } from '../../src/lib/contractGapDetector.js';

// --- Generators ---

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** Generate a valid HTTP method */
const arbMethod = fc.constantFrom(...HTTP_METHODS);

/** Generate a realistic API path segment (lowercase alphanumeric) */
const arbPathSegment = fc
  .string({ minLength: 1, maxLength: 12 })
  .map(s => s.replace(/[^a-z0-9]/g, 'x') || 'x');

/** Generate an API path like /api/v4/teams/:param/members */
const arbApiPath = fc
  .array(arbPathSegment, { minLength: 1, maxLength: 4 })
  .map(segments => '/api/v4/' + segments.join('/'));

/** Generate a FrontendCall object */
const arbFrontendCall = fc.record({
  pageModule: fc.constantFrom(
    'DataImporter', 'RulesEditor', 'ReportViewer', 'TeamManager',
    'MSTAssignment', 'KPIAdjustments', 'AccountManager'
  ),
  method: arbMethod,
  path: arbApiPath,
  source: fc.constant('src/components/SomePage.tsx'),
});

/** Generate a BackendEndpoint object */
const arbBackendEndpoint = fc.record({
  moduleId: fc.constantFrom('teams', 'rules', 'reports', 'accounts', 'imports', 'adjustments'),
  method: arbMethod,
  path: arbApiPath,
  source: fc.constant('server-v4/src/modules/mod/mod.module.ts'),
});

describe('Property 25: Contract Verification Gap Detection', () => {
  it('every element in F\\B appears in missingBackend', () => {
    fc.assert(
      fc.property(
        fc.array(arbFrontendCall, { minLength: 0, maxLength: 20 }),
        fc.array(arbBackendEndpoint, { minLength: 0, maxLength: 20 }),
        (frontendCalls, backendEndpoints) => {
          const { missingBackend } = computeGaps(frontendCalls, backendEndpoints);

          // Build backend key set for comparison
          const backendKeys = new Set(
            backendEndpoints.map(ep => makeEndpointKey(ep.method, ep.path))
          );

          // Every frontend call NOT matched by backend must appear in missingBackend
          const missingKeys = new Set(
            missingBackend.map(g => makeEndpointKey(g.method, g.path))
          );

          for (const fc_ of frontendCalls) {
            const key = makeEndpointKey(fc_.method, fc_.path);
            if (!backendKeys.has(key)) {
              expect(missingKeys.has(key)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every element in B\\F appears in unusedBackend', () => {
    fc.assert(
      fc.property(
        fc.array(arbFrontendCall, { minLength: 0, maxLength: 20 }),
        fc.array(arbBackendEndpoint, { minLength: 0, maxLength: 20 }),
        (frontendCalls, backendEndpoints) => {
          const { unusedBackend } = computeGaps(frontendCalls, backendEndpoints);

          // Build frontend key set for comparison
          const frontendKeys = new Set(
            frontendCalls.map(fc_ => makeEndpointKey(fc_.method, fc_.path))
          );

          // Every backend endpoint NOT matched by frontend must appear in unusedBackend
          const unusedKeys = new Set(
            unusedBackend.map(g => makeEndpointKey(g.method, g.path))
          );

          for (const ep of backendEndpoints) {
            const key = makeEndpointKey(ep.method, ep.path);
            if (!frontendKeys.has(key)) {
              expect(unusedKeys.has(key)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('matched elements (F ∩ B) appear in neither missingBackend nor unusedBackend', () => {
    fc.assert(
      fc.property(
        fc.array(arbFrontendCall, { minLength: 0, maxLength: 20 }),
        fc.array(arbBackendEndpoint, { minLength: 0, maxLength: 20 }),
        (frontendCalls, backendEndpoints) => {
          const { missingBackend, unusedBackend } = computeGaps(frontendCalls, backendEndpoints);

          // Build key sets
          const frontendKeys = new Set(
            frontendCalls.map(fc_ => makeEndpointKey(fc_.method, fc_.path))
          );
          const backendKeys = new Set(
            backendEndpoints.map(ep => makeEndpointKey(ep.method, ep.path))
          );

          // Intersection: elements present in both F and B
          const intersection = new Set(
            [...frontendKeys].filter(k => backendKeys.has(k))
          );

          // None of the matched keys should appear in gaps
          const missingKeys = new Set(
            missingBackend.map(g => makeEndpointKey(g.method, g.path))
          );
          const unusedKeys = new Set(
            unusedBackend.map(g => makeEndpointKey(g.method, g.path))
          );

          for (const key of intersection) {
            expect(missingKeys.has(key)).toBe(false);
            expect(unusedKeys.has(key)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('missingBackend and unusedBackend are disjoint sets', () => {
    fc.assert(
      fc.property(
        fc.array(arbFrontendCall, { minLength: 0, maxLength: 20 }),
        fc.array(arbBackendEndpoint, { minLength: 0, maxLength: 20 }),
        (frontendCalls, backendEndpoints) => {
          const { missingBackend, unusedBackend } = computeGaps(frontendCalls, backendEndpoints);

          const missingKeys = new Set(
            missingBackend.map(g => makeEndpointKey(g.method, g.path))
          );
          const unusedKeys = new Set(
            unusedBackend.map(g => makeEndpointKey(g.method, g.path))
          );

          // No key should appear in both sets
          for (const key of missingKeys) {
            expect(unusedKeys.has(key)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('gap detection is complete: |missingBackend| + |unusedBackend| + |matched| accounts for all unique keys', () => {
    fc.assert(
      fc.property(
        fc.array(arbFrontendCall, { minLength: 1, maxLength: 20 }),
        fc.array(arbBackendEndpoint, { minLength: 1, maxLength: 20 }),
        (frontendCalls, backendEndpoints) => {
          const { missingBackend, unusedBackend } = computeGaps(frontendCalls, backendEndpoints);

          const frontendKeys = new Set(
            frontendCalls.map(fc_ => makeEndpointKey(fc_.method, fc_.path))
          );
          const backendKeys = new Set(
            backendEndpoints.map(ep => makeEndpointKey(ep.method, ep.path))
          );

          // Union of all unique keys
          const allKeys = new Set([...frontendKeys, ...backendKeys]);

          const missingKeys = new Set(
            missingBackend.map(g => makeEndpointKey(g.method, g.path))
          );
          const unusedKeys = new Set(
            unusedBackend.map(g => makeEndpointKey(g.method, g.path))
          );

          // Matched = keys in both F and B
          const matchedKeys = new Set(
            [...frontendKeys].filter(k => backendKeys.has(k))
          );

          // Every key in the union should be in exactly one category
          for (const key of allKeys) {
            const inMissing = missingKeys.has(key);
            const inUnused = unusedKeys.has(key);
            const inMatched = matchedKeys.has(key);

            // Each key is in exactly one partition
            const count = (inMissing ? 1 : 0) + (inUnused ? 1 : 0) + (inMatched ? 1 : 0);
            expect(count).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
