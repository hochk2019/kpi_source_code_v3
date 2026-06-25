/**
 * Property-Based Test: Breadcrumb Generation from Route Path
 *
 * Feature: system-redesign-2026, Property 4: Breadcrumb Generation from Route Path
 *
 * For any valid route path, breadcrumbs produce ordered segments where each
 * segment's path is a prefix of the next, and the final segment's path equals
 * the input route path.
 *
 * **Validates: Requirements 4.2**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateBreadcrumbs } from '@/components/layout/Breadcrumbs';

// ─── Generators ─────────────────────────────────────────────────────────────

/** Lowercase alphanumeric chars for path segments */
const alphanumChars = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a valid route path segment: alphanumeric or kebab-case.
 * A word is 1–8 lowercase alphanumeric chars. A segment is 1–3 words joined by hyphens.
 */
const wordArb = fc
  .integer({ min: 1, max: 8 })
  .chain(len =>
    fc.array(fc.constantFrom(...alphanumChars.split('')), { minLength: len, maxLength: len })
      .map(chars => chars.join('')),
  );

const pathSegmentArb = fc
  .array(wordArb, { minLength: 1, maxLength: 3 })
  .map(words => words.join('-'));

/**
 * Generate a valid route path: "/" followed by 1–5 path segments joined by "/".
 */
const routePathArb = fc
  .array(pathSegmentArb, { minLength: 1, maxLength: 5 })
  .map(segments => '/' + segments.join('/'));

/**
 * Generate an optional routeLabels map: random subset of segments mapped to custom labels.
 */
const routeLabelsArb = fc
  .array(
    fc.tuple(pathSegmentArb, fc.string({ minLength: 1, maxLength: 20 })),
    { minLength: 0, maxLength: 5 },
  )
  .map(entries => Object.fromEntries(entries));

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Property 4: Breadcrumb Generation from Route Path', () => {
  it('each segment path is a prefix of the next segment path', () => {
    fc.assert(
      fc.property(routePathArb, routeLabelsArb, (routePath, routeLabels) => {
        const crumbs = generateBreadcrumbs(routePath, routeLabels);

        // Must produce at least 2 segments (Home + at least one path segment)
        expect(crumbs.length).toBeGreaterThanOrEqual(2);

        // Each segment's path is a prefix of the next
        for (let i = 0; i < crumbs.length - 1; i++) {
          const currentPath = crumbs[i].path;
          const nextPath = crumbs[i + 1].path;

          // The next path must start with the current path
          // For root "/", every path starts with "/"
          if (currentPath === '/') {
            expect(nextPath.startsWith('/')).toBe(true);
          } else {
            // The next path must start with currentPath followed by "/"
            expect(
              nextPath.startsWith(currentPath + '/') || nextPath === currentPath,
            ).toBe(true);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('final segment path equals the input route path', () => {
    fc.assert(
      fc.property(routePathArb, routeLabelsArb, (routePath, routeLabels) => {
        const crumbs = generateBreadcrumbs(routePath, routeLabels);

        // Final segment path must equal the input route path
        const lastCrumb = crumbs[crumbs.length - 1];
        expect(lastCrumb.path).toBe(routePath);
      }),
      { numRuns: 200 },
    );
  });

  it('first segment is always Home with path "/"', () => {
    fc.assert(
      fc.property(routePathArb, (routePath) => {
        const crumbs = generateBreadcrumbs(routePath);

        expect(crumbs[0]).toEqual({ label: 'Home', path: '/' });
      }),
      { numRuns: 100 },
    );
  });

  it('number of breadcrumb segments equals number of path segments + 1 (Home)', () => {
    fc.assert(
      fc.property(routePathArb, (routePath) => {
        const crumbs = generateBreadcrumbs(routePath);
        const expectedSegments = routePath.split('/').filter(Boolean).length;

        expect(crumbs.length).toBe(expectedSegments + 1);
      }),
      { numRuns: 100 },
    );
  });

  it('paths are strictly ordered by increasing length', () => {
    fc.assert(
      fc.property(routePathArb, routeLabelsArb, (routePath, routeLabels) => {
        const crumbs = generateBreadcrumbs(routePath, routeLabels);

        for (let i = 0; i < crumbs.length - 1; i++) {
          expect(crumbs[i].path.length).toBeLessThan(crumbs[i + 1].path.length);
        }
      }),
      { numRuns: 100 },
    );
  });
});
