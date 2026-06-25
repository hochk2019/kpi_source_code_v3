/**
 * Tests for the build manifest reporter plugin.
 *
 * Covers:
 * - computeGzipSize returns correct compressed size
 * - isCriticalPathChunk identifies entry, shell, and router chunks
 * - assembleBuildManifest computes totals and critical path size
 * - Plugin generateBundle hook emits build-manifest.json
 */
import { describe, it, expect } from 'vitest';
import { gzipSync } from 'node:zlib';
import {
  computeGzipSize,
  isCriticalPathChunk,
  assembleBuildManifest,
  buildManifestPlugin,
} from '../src/build/buildManifestPlugin.js';

// ─── Unit Tests ────────────────────────────────────────────────────────────

describe('buildManifestPlugin — unit tests', () => {
  describe('computeGzipSize', () => {
    it('returns the gzipped byte length for a string', () => {
      const content = 'console.log("hello world");';
      const expected = gzipSync(Buffer.from(content, 'utf-8')).length;
      expect(computeGzipSize(content)).toBe(expected);
    });

    it('returns the gzipped byte length for a Buffer', () => {
      const buffer = Buffer.from('export default function() {}', 'utf-8');
      const expected = gzipSync(buffer).length;
      expect(computeGzipSize(buffer)).toBe(expected);
    });

    it('returns a positive number for non-empty content', () => {
      expect(computeGzipSize('x')).toBeGreaterThan(0);
    });

    it('handles empty string', () => {
      // gzip of empty still has headers
      expect(computeGzipSize('')).toBeGreaterThan(0);
    });
  });

  describe('isCriticalPathChunk', () => {
    it('returns true for entry chunks', () => {
      expect(isCriticalPathChunk('index', [], true)).toBe(true);
    });

    it('returns true when chunk name contains "shell"', () => {
      expect(isCriticalPathChunk('AppShellFrame', [], false)).toBe(true);
    });

    it('returns true when chunk name contains "router"', () => {
      expect(isCriticalPathChunk('router-chunk', [], false)).toBe(true);
    });

    it('returns true when modules include shell-related paths', () => {
      const modules = ['/src/components/appShell/AppShellFrame.tsx'];
      expect(isCriticalPathChunk('some-chunk', modules, false)).toBe(true);
    });

    it('returns true when modules include react-router', () => {
      const modules = ['/node_modules/react-router-dom/dist/index.js'];
      expect(isCriticalPathChunk('vendor-misc', modules, false)).toBe(true);
    });

    it('returns false for a regular page chunk', () => {
      const modules = ['/src/components/DataImporter.tsx'];
      expect(isCriticalPathChunk('DataImporter', modules, false)).toBe(false);
    });

    it('returns false for vendor chunks without router/shell', () => {
      const modules = ['/node_modules/recharts/es6/index.js'];
      expect(isCriticalPathChunk('vendor-recharts', modules, false)).toBe(false);
    });
  });

  describe('assembleBuildManifest', () => {
    const makeChunk = (name, code, modules = [], isEntry = false) => ({
      name,
      fileName: `assets/${name}-abc123.js`,
      code,
      modules,
      isEntry,
    });

    it('produces correct totalSize and totalGzip', () => {
      const chunk1 = makeChunk('index', 'const a = 1;', [], true);
      const chunk2 = makeChunk('DataImporter', 'export default {};');

      const manifest = assembleBuildManifest([chunk1, chunk2], '2026-06-15T10:00:00Z');

      const expectedSize1 = Buffer.byteLength(chunk1.code, 'utf-8');
      const expectedSize2 = Buffer.byteLength(chunk2.code, 'utf-8');
      expect(manifest.totalSize).toBe(expectedSize1 + expectedSize2);
      expect(manifest.totalGzip).toBe(
        computeGzipSize(chunk1.code) + computeGzipSize(chunk2.code),
      );
    });

    it('computes criticalPathSize from entry + shell + router chunks only', () => {
      const entry = makeChunk('index', 'import "./app";', [], true);
      const shell = makeChunk('AppShellFrame', 'export const Shell = {};', [
        '/src/components/appShell/AppShellFrame.tsx',
      ]);
      const routerChunk = makeChunk('router', 'export const routes = [];', [
        '/node_modules/react-router-dom/index.js',
      ]);
      const page = makeChunk('DataImporter', 'export default function() {}', [
        '/src/components/DataImporter.tsx',
      ]);

      const manifest = assembleBuildManifest(
        [entry, shell, routerChunk, page],
        '2026-06-15T10:00:00Z',
      );

      const expectedCritical =
        computeGzipSize(entry.code) +
        computeGzipSize(shell.code) +
        computeGzipSize(routerChunk.code);

      expect(manifest.criticalPathSize).toBe(expectedCritical);
    });

    it('includes timestamp in output', () => {
      const manifest = assembleBuildManifest([], '2026-01-01T00:00:00Z');
      expect(manifest.timestamp).toBe('2026-01-01T00:00:00Z');
    });

    it('defaults timestamp to current time when not provided', () => {
      const before = new Date().toISOString();
      const manifest = assembleBuildManifest([]);
      const after = new Date().toISOString();
      expect(manifest.timestamp >= before).toBe(true);
      expect(manifest.timestamp <= after).toBe(true);
    });

    it('reports per-chunk entry with correct fields', () => {
      const code = 'const x = 42;';
      const modules = ['/src/lib/math.ts', '/src/lib/constants.ts'];
      const chunk = makeChunk('utils', code, modules);

      const manifest = assembleBuildManifest([chunk], '2026-06-15T10:00:00Z');

      expect(manifest.chunks).toHaveLength(1);
      const entry = manifest.chunks[0];
      expect(entry.chunkName).toBe('utils');
      expect(entry.files).toEqual(['assets/utils-abc123.js']);
      expect(entry.sizeBytes).toBe(Buffer.byteLength(code, 'utf-8'));
      expect(entry.sizeGzip).toBe(computeGzipSize(code));
      expect(entry.modules).toEqual(modules);
    });

    it('returns empty chunks array and zero totals for empty input', () => {
      const manifest = assembleBuildManifest([], '2026-06-15T10:00:00Z');
      expect(manifest.chunks).toEqual([]);
      expect(manifest.totalSize).toBe(0);
      expect(manifest.totalGzip).toBe(0);
      expect(manifest.criticalPathSize).toBe(0);
    });
  });

  describe('buildManifestPlugin integration', () => {
    it('creates a plugin with correct name and apply setting', () => {
      const plugin = buildManifestPlugin();
      expect(plugin.name).toBe('build-manifest-reporter');
      expect(plugin.apply).toBe('build');
    });

    it('generateBundle emits build-manifest.json asset', () => {
      const plugin = buildManifestPlugin();
      const emittedFiles = [];

      const context = {
        emitFile(fileInfo) {
          emittedFiles.push(fileInfo);
        },
      };

      const bundle = {
        'assets/index-abc123.js': {
          type: 'chunk',
          name: 'index',
          code: 'console.log("entry");',
          modules: { '/src/main.tsx': {} },
          isEntry: true,
        },
        'assets/DataImporter-def456.js': {
          type: 'chunk',
          name: 'DataImporter',
          code: 'export default {};',
          modules: { '/src/components/DataImporter.tsx': {} },
          isEntry: false,
        },
        'assets/style.css': {
          type: 'asset',
          source: 'body { margin: 0; }',
        },
      };

      plugin.generateBundle.call(context, {}, bundle);

      expect(emittedFiles).toHaveLength(1);
      const emitted = emittedFiles[0];
      expect(emitted.type).toBe('asset');
      expect(emitted.fileName).toBe('build-manifest.json');

      const manifest = JSON.parse(emitted.source);
      expect(manifest.chunks).toHaveLength(2);
      expect(manifest.totalSize).toBeGreaterThan(0);
      expect(manifest.totalGzip).toBeGreaterThan(0);
      expect(manifest.criticalPathSize).toBeGreaterThan(0);
      expect(manifest.timestamp).toBeDefined();

      // Entry chunk should contribute to critical path
      const indexEntry = manifest.chunks.find(c => c.chunkName === 'index');
      expect(indexEntry).toBeDefined();
      expect(indexEntry.sizeGzip).toBe(manifest.criticalPathSize);
    });

    it('skips non-chunk assets in the bundle', () => {
      const plugin = buildManifestPlugin();
      const emittedFiles = [];

      const context = {
        emitFile(fileInfo) {
          emittedFiles.push(fileInfo);
        },
      };

      const bundle = {
        'assets/logo.svg': { type: 'asset', source: '<svg></svg>' },
        'assets/style.css': { type: 'asset', source: '.x {}' },
      };

      plugin.generateBundle.call(context, {}, bundle);

      const manifest = JSON.parse(emittedFiles[0].source);
      expect(manifest.chunks).toEqual([]);
      expect(manifest.totalSize).toBe(0);
    });
  });
});
