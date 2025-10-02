import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

function uniquePreserveOrder(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

const nodeEnv = process.env.NODE_ENV && process.env.NODE_ENV.trim()
  ? process.env.NODE_ENV.trim()
  : 'development';

export const envCandidates = uniquePreserveOrder([
  '.env',
  '.env.local',
  `.env.${nodeEnv}`,
  `.env.${nodeEnv}.local`,
  '.env.production',
  '.env.production.local',
]);

export function findFirstExisting(candidates = envCandidates, { cwd = projectRoot } = {}) {
  for (const candidate of candidates) {
    const absolute = resolve(cwd, candidate);
    if (existsSync(absolute)) {
      return {
        candidate,
        absolute,
        relative: relative(cwd, absolute) || candidate,
      };
    }
  }
  return null;
}

export function parseEnvFile(contents) {
  const env = {};
  if (!contents) return env;
  const normalized = contents.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;
    let key = trimmed.slice(0, equalsIndex).trim();
    if (!key) continue;
    if (key.startsWith('export ')) {
      key = key.slice('export '.length).trim();
    }
    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
      value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    }
    env[key] = value;
  }
  return env;
}

export function loadEnvCascade({
  cwd = projectRoot,
  candidates = envCandidates,
} = {}) {
  const merged = {};
  const origins = {};
  const filesRead = [];

  for (const candidate of candidates) {
    const absolute = resolve(cwd, candidate);
    if (!existsSync(absolute)) continue;
    const raw = readFileSync(absolute, 'utf8');
    const parsed = parseEnvFile(raw);
    const relativePath = relative(cwd, absolute) || candidate;
    filesRead.push({
      candidate,
      absolute,
      relative: relativePath,
      values: parsed,
    });
    for (const [key, value] of Object.entries(parsed)) {
      merged[key] = value;
      origins[key] = {
        file: relativePath,
        absolute,
        index: filesRead.length - 1,
      };
    }
  }

  return {
    merged,
    origins,
    filesRead,
  };
}

export function ensureRequiredEnvVariables(requiredVariables, {
  runtimeEnv = process.env,
  fileEnv = {},
  origins = {},
  filesRead = [],
  candidates = envCandidates,
} = {}) {
  const missing = [];
  const resolved = [];

  for (const entry of requiredVariables) {
    const descriptor = typeof entry === 'string' ? { key: entry } : entry || {};
    const key = descriptor.key;
    if (!key) continue;
    const description = descriptor.description || '';
    const optional = descriptor.optional === true;
    const runtimeValue = runtimeEnv?.[key];
    const fileValue = fileEnv?.[key];
    const finalValue = runtimeValue ?? fileValue;
    if (finalValue === undefined || finalValue === '') {
      if (!optional) {
        missing.push({ key, description });
      }
      resolved.push({
        key,
        description,
        optional,
        present: false,
      });
      continue;
    }
    const source = runtimeValue !== undefined ? 'runtime' : 'file';
    const origin = source === 'file' ? origins[key] ?? null : null;
    resolved.push({
      key,
      description,
      optional,
      present: true,
      value: finalValue,
      source,
      origin,
    });
  }

  const activeCandidates = candidates && candidates.length > 0 ? candidates : envCandidates;
  const recommendedFile = filesRead.length > 0
    ? filesRead[filesRead.length - 1].relative
    : activeCandidates[0] || '.env';

  const suggestedFilePerVariable = missing.reduce((acc, item) => {
    acc[item.key] = filesRead.length > 0
      ? filesRead[filesRead.length - 1].relative
      : recommendedFile;
    return acc;
  }, {});

  let fixSuggestion = '';
  if (missing.length > 0) {
    const missingLines = missing
      .map((item) => {
        const lines = [`- ${item.key}${item.description ? ` (${item.description})` : ''}`];
        const suggestion = suggestedFilePerVariable[item.key];
        if (suggestion) {
          lines.push(`  Goi y: them vao ${suggestion}`);
        }
        return lines.join('\n');
      })
      .join('\n');
    const filesLines = filesRead.length > 0
      ? filesRead.map((file, index) => `${index + 1}. ${file.relative}`).join('\n')
      : '- (chua tim thay file .env nao)';
    fixSuggestion = [
      'Chua tim thay du bien moi truong bat buoc:',
      missingLines,
      '',
      'Cac file .env da doc (thu tu uu tien tu thap toi cao):',
      filesLines,
      '',
      `Hay bo sung cac bien con thieu vao file uu tien cao nhat hien co (${recommendedFile}).`,
    ].filter(Boolean).join('\n');
  }

  return {
    ok: missing.length === 0,
    missing,
    resolved,
    filesRead,
    recommendedFile,
    suggestedFilePerVariable,
    fixSuggestion,
  };
}

export async function main() {
  const cascade = loadEnvCascade();
  const requiredVariables = [
    {
      key: 'VITE_API_BASE',
      description: 'URL backend cho frontend',
    },
  ];

  const result = ensureRequiredEnvVariables(requiredVariables, {
    runtimeEnv: process.env,
    fileEnv: cascade.merged,
    origins: cascade.origins,
    filesRead: cascade.filesRead,
  });

  if (!result.ok) {
    console.error(result.fixSuggestion);
    process.exit(1);
  }

  for (const entry of result.resolved) {
    if (!entry.present) continue;
    if (entry.source === 'runtime') {
      console.log(`- ${entry.key} lay tu bien moi truong hien tai.`);
    } else if (entry.origin?.file) {
      console.log(`- ${entry.key} doc tu ${entry.origin.file}.`);
    } else {
      console.log(`- ${entry.key} da duoc cau hinh.`);
    }
  }

  if (cascade.filesRead.length > 0) {
    console.log(`Da tai cac file .env: ${cascade.filesRead.map((file) => file.relative).join(', ')}`);
  } else {
    console.log('Khong tim thay file .env, su dung bien moi truong he thong.');
  }
}
