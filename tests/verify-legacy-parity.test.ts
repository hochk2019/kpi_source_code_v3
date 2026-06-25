import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildServerV4Surface,
  computeParity,
  extractDomainModuleRoutes,
  extractExpressRoutes,
  formatParityReport,
  joinRoute,
  loadInventory,
  normalizeRoutePath,
  routeKey,
  runParityCheck,
  type LegacyRouteInventory,
} from '../scripts/verify-legacy-parity.ts';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

describe('verify-legacy-parity path helpers', () => {
  it('normalizes query strings, template literals, and trailing slashes', () => {
    expect(normalizeRoutePath('/api/v4/auth/login?next=1')).toBe('/api/v4/auth/login');
    expect(normalizeRoutePath('/api/storage/${key}')).toBe('/api/storage/:param');
    expect(normalizeRoutePath('/api//import///alerts/')).toBe('/api/import/alerts');
    expect(normalizeRoutePath('/')).toBe('/');
  });

  it('builds stable, method-prefixed route keys', () => {
    expect(routeKey('post', '/api/v4/auth/login')).toBe('POST /api/v4/auth/login');
  });

  it('joins module base paths with route paths', () => {
    expect(joinRoute('/api/v4/auth', '/login')).toBe('/api/v4/auth/login');
    expect(joinRoute('/api/v4/auth', '/')).toBe('/api/v4/auth');
    expect(joinRoute('/api/v4/teams/', '/:teamId/members')).toBe('/api/v4/teams/:teamId/members');
  });
});

describe('verify-legacy-parity source extractors', () => {
  it('extracts canonical routes from a domain-module descriptor', () => {
    const source = `
      basePath: '/api/v4/auth',
      routeGroups: [
        { name: 'session', routes: [
          { method: 'GET', path: '/session', purpose: 'x' },
          { method: 'POST', path: '/login', purpose: 'y' },
        ] },
      ],
    `;
    expect(extractDomainModuleRoutes(source)).toEqual([
      'GET /api/v4/auth/session',
      'POST /api/v4/auth/login',
    ]);
  });

  it('extracts /api express routes and ignores non-api calls', () => {
    const source = `
      router.post('/api/auth/login', handler);
      app.get('/api/v4/health', handler);
      router.get('/internal/metrics', handler);
    `;
    expect(extractExpressRoutes(source)).toEqual([
      'POST /api/auth/login',
      'GET /api/v4/health',
    ]);
  });
});

describe('verify-legacy-parity computeParity', () => {
  const inventory: LegacyRouteInventory = {
    legacyDirectory: 'server',
    legacyDirectoryRemoved: true,
    routes: [
      { method: 'POST', legacyPath: '/api/auth/login', coverage: 'canonical', v4Path: '/api/v4/auth/login' },
      { method: 'GET', legacyPath: '/api/bootstrap', coverage: 'legacy-compat' },
    ],
  };

  it('marks routes covered when present in the matching surface pool', () => {
    const surface = buildServerV4Surface({
      moduleSources: [`basePath: '/api/v4/auth',\n{ method: 'POST', path: '/login', purpose: 'x' }`],
      appSources: [],
      legacyCompatSources: [`router.get('/api/bootstrap', handler);`],
    });
    const result = computeParity(inventory, surface);
    expect(result.missing).toHaveLength(0);
    expect(result.coveredCount).toBe(2);
  });

  it('reports a missing legacy route when Server_V4 lacks the equivalent', () => {
    const surface = buildServerV4Surface({
      moduleSources: [`basePath: '/api/v4/auth',\n{ method: 'POST', path: '/login', purpose: 'x' }`],
      appSources: [],
      legacyCompatSources: [],
    });
    const result = computeParity(inventory, surface);
    expect(result.missing.map((row) => row.legacyPath)).toEqual(['/api/bootstrap']);
    expect(formatParityReport(result)).toContain('FAIL');
  });
});

describe('verify-legacy-parity against the live Server_V4 tree', () => {
  it('confirms Server_V4 handles every recorded legacy route', () => {
    const result = runParityCheck(repoRoot);
    expect(result.total).toBeGreaterThan(0);
    expect(result.missing, formatParityReport(result)).toHaveLength(0);
  });

  it('keeps the recorded inventory consistent with the absent legacy directory', () => {
    const inventory = loadInventory(path.join(repoRoot, 'scripts', 'legacy-route-inventory.json'));
    expect(inventory.legacyDirectory).toBe('server');
    expect(inventory.legacyDirectoryRemoved).toBe(true);
    expect(inventory.routes.length).toBeGreaterThan(0);
  });
});
