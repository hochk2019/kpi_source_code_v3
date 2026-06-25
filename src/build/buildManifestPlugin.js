/**
 * Vite plugin that generates a BuildManifest JSON after production build.
 *
 * Reports per-chunk: name, files, sizeBytes, sizeGzip, modules list.
 * Reports criticalPathSize: sum of gzipped sizes for entry + shell + router chunks.
 * Outputs to dist/build-manifest.json.
 *
 * @module buildManifestPlugin
 */

import { gzipSync } from 'node:zlib';

/**
 * @typedef {Object} BuildManifestEntry
 * @property {string} chunkName
 * @property {string[]} files
 * @property {number} sizeBytes
 * @property {number} sizeGzip
 * @property {string[]} modules
 */

/**
 * @typedef {Object} BuildManifest
 * @property {string} timestamp
 * @property {number} totalSize
 * @property {number} totalGzip
 * @property {BuildManifestEntry[]} chunks
 * @property {number} criticalPathSize
 */

/**
 * Compute the gzipped size of a string or Buffer.
 *
 * @param {string | Buffer} content - Raw content to gzip
 * @returns {number} Size in bytes after gzip compression
 */
export function computeGzipSize(content) {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  return gzipSync(buffer).length;
}

/**
 * Determine whether a chunk is part of the critical path.
 * Critical path chunks are: entry points, chunks containing shell or router modules.
 *
 * @param {string} chunkName - The chunk/file name
 * @param {string[]} modules - List of module paths in the chunk
 * @param {boolean} isEntry - Whether the chunk is an entry point
 * @returns {boolean}
 */
export function isCriticalPathChunk(chunkName, modules, isEntry) {
  if (isEntry) return true;

  const lowerName = chunkName.toLowerCase();
  if (lowerName.includes('shell') || lowerName.includes('router')) return true;

  for (const mod of modules) {
    const lowerMod = mod.toLowerCase();
    if (
      lowerMod.includes('appshellframe') ||
      lowerMod.includes('shell') ||
      lowerMod.includes('router') ||
      lowerMod.includes('react-router')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Assemble the BuildManifest from raw chunk data.
 *
 * @param {Array<{ name: string; fileName: string; code: string; modules: string[]; isEntry: boolean }>} chunks
 * @param {string} [timestamp] - ISO timestamp (defaults to now)
 * @returns {BuildManifest}
 */
export function assembleBuildManifest(chunks, timestamp) {
  const ts = timestamp || new Date().toISOString();

  /** @type {BuildManifestEntry[]} */
  const entries = [];
  let totalSize = 0;
  let totalGzip = 0;
  let criticalPathSize = 0;

  for (const chunk of chunks) {
    const sizeBytes = Buffer.byteLength(chunk.code, 'utf-8');
    const sizeGzip = computeGzipSize(chunk.code);

    const entry = {
      chunkName: chunk.name,
      files: [chunk.fileName],
      sizeBytes,
      sizeGzip,
      modules: chunk.modules,
    };

    entries.push(entry);
    totalSize += sizeBytes;
    totalGzip += sizeGzip;

    if (isCriticalPathChunk(chunk.name, chunk.modules, chunk.isEntry)) {
      criticalPathSize += sizeGzip;
    }
  }

  return {
    timestamp: ts,
    totalSize,
    totalGzip,
    chunks: entries,
    criticalPathSize,
  };
}

/**
 * Create the Vite build manifest reporter plugin.
 *
 * The manifest is emitted via Vite's `emitFile`, which writes it to the
 * configured build output directory (default `dist/build-manifest.json`).
 *
 * @returns {import('vite').Plugin}
 */
export function buildManifestPlugin() {
  return {
    name: 'build-manifest-reporter',
    apply: 'build',
    enforce: 'post',

    generateBundle(_outputOptions, bundle) {
      const chunks = [];

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'chunk') continue;

        const moduleIds = Object.keys(asset.modules || {});
        chunks.push({
          name: asset.name || fileName.replace(/\.[a-f0-9]+\.js$/, ''),
          fileName,
          code: asset.code,
          modules: moduleIds,
          isEntry: asset.isEntry || false,
        });
      }

      const manifest = assembleBuildManifest(chunks);

      // Emit as an asset so Vite includes it in the output
      this.emitFile({
        type: 'asset',
        fileName: 'build-manifest.json',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}
