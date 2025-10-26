import fs from 'node:fs';

import path from 'node:path';

import process from 'node:process';

import { fileURLToPath } from 'node:url';



const moduleUrl = typeof import.meta !== 'undefined' ? import.meta.url || '' : '';

const __dirname = moduleUrl.startsWith('file:')

  ? fileURLToPath(new URL('.', moduleUrl))

  : path.resolve(process.cwd(), 'server');



const DATA_DIR = path.resolve(__dirname, 'data');

const HISTORY_DIR = path.resolve(DATA_DIR, 'rules-history');

const RULES_FILE = path.resolve(DATA_DIR, 'kpi-rules.json');

const HISTORY_LIMIT = 30;



function ensureDir(dir) {

  try {

    fs.mkdirSync(dir, { recursive: true });

  } catch (err) {

    if (err?.code !== 'EEXIST') {

      throw err;

    }

  }

}



function safeParse(json) {

  if (!json) return null;

  try {

    return JSON.parse(json);

  } catch {

    return null;

  }

}



function buildSnapshot(data, { actor = 'system', source = 'storage' } = {}) {

  const savedAt = new Date().toISOString();

  return {

    savedAt,

    actor,

    source,

    rules: data,

  };

}



function writeSnapshotFile(snapshot, targetPath) {

  const payload = JSON.stringify(snapshot, null, 2);

  fs.writeFileSync(targetPath, payload, 'utf8');

}



function pruneHistory() {

  let entries = [];

  try {

    entries = fs

      .readdirSync(HISTORY_DIR)

      .filter((name) => name.endsWith('.json'))

      .map((name) => {

        const fullPath = path.resolve(HISTORY_DIR, name);

        const stat = fs.statSync(fullPath);

        return { name, fullPath, mtimeMs: stat.mtimeMs };

      })

      .sort((a, b) => b.mtimeMs - a.mtimeMs);

  } catch (err) {

    if (err?.code === 'ENOENT') {

      return;

    }

    throw err;

  }



  for (const entry of entries.slice(HISTORY_LIMIT)) {

    try {

      fs.rmSync(entry.fullPath, { force: true });

    } catch (err) {

      console.warn('Không thể xoá lịch sử quy tắc cũ', err);

    }

  }

}



export function loadRulesSnapshot() {

  try {

    const raw = fs.readFileSync(RULES_FILE, 'utf8');

    const parsed = safeParse(raw);

    if (!parsed) {

      return null;

    }

    if (parsed.rules && typeof parsed.rules === 'object') {

      return {

        savedAt: parsed.savedAt || null,

        actor: parsed.actor || null,

        source: parsed.source || null,

        rules: parsed.rules,

      };

    }

    return {

      savedAt: parsed.savedAt || null,

      actor: parsed.actor || null,

      source: parsed.source || null,

      rules: parsed.rules ?? parsed,

    };

  } catch (err) {

    if (err?.code !== 'ENOENT') {

      console.warn('Không thể đọc file lưu trữ quy tắc KPI', err);

    }

    return null;

  }

}



export function persistRulesSnapshot(jsonString, { actor = 'system', source = 'storage' } = {}) {

  if (typeof jsonString !== 'string' || !jsonString.trim()) {

    return null;

  }

  const parsed = safeParse(jsonString);

  if (!parsed || typeof parsed !== 'object') {

    console.warn('Dữ liệu quy tắc KPI không hợp lệ, bỏ qua ghi file.');

    return null;

  }



  try {

    ensureDir(DATA_DIR);

    ensureDir(HISTORY_DIR);

  } catch (err) {

    console.error('Không thể chuẩn bị thư mục lưu trữ quy tắc KPI', err);

    return null;

  }



  const snapshot = buildSnapshot(parsed, { actor, source });

  try {

    writeSnapshotFile(snapshot, RULES_FILE);

  } catch (err) {

    console.error('Không thể ghi file quy tắc KPI', err);

    return null;

  }



  const safeStamp = snapshot.savedAt.replace(/[:.]/g, '-');

  const historyPath = path.resolve(HISTORY_DIR, `${safeStamp}.json`);

  try {

    writeSnapshotFile(snapshot, historyPath);

  } catch (err) {

    console.warn('Không thể ghi lịch sử quy tắc KPI', err);

  }



  try {

    pruneHistory();

  } catch (err) {

    console.warn('Không thể dọn lịch sử quy tắc KPI', err);

  }



  return snapshot;

}



export function clearRulesSnapshot() {

  try {

    fs.rmSync(RULES_FILE, { force: true });

  } catch (err) {

    if (err?.code !== 'ENOENT') {

      console.warn('Không thể xoá file quy tắc KPI', err);

    }

  }

}



export function getRulesSeed(defaultValue) {

  const snapshot = loadRulesSnapshot();

  if (snapshot && snapshot.rules && typeof snapshot.rules === 'object') {

    return snapshot.rules;

  }

  return defaultValue;

}



export const RULES_SNAPSHOT_FILE = RULES_FILE;

export const RULES_HISTORY_DIR = HISTORY_DIR;



export function listRulesHistory(limit = 20) {

  let entries = [];

  try {

    entries = fs

      .readdirSync(HISTORY_DIR)

      .filter((name) => name.endsWith('.json'))

      .map((name) => {

        const fullPath = path.resolve(HISTORY_DIR, name);

        const stats = fs.statSync(fullPath);

        return { name, fullPath, mtime: stats.mtimeMs };

      })

      .sort((a, b) => b.mtime - a.mtime);

  } catch (err) {

    if (err?.code === 'ENOENT') {

      return [];

    }

    console.warn('Không thể đọc thư mục lịch sử quy tắc KPI', err);

    return [];

  }

  const limited = Number.isFinite(limit) && limit > 0 ? entries.slice(0, limit) : entries;

  const results = [];

  for (const entry of limited) {

    try {

      const raw = fs.readFileSync(entry.fullPath, 'utf8');

      const parsed = safeParse(raw) || {};

      results.push({

        savedAt: parsed.savedAt || new Date(entry.mtime).toISOString(),

        actor: parsed.actor || 'system',

        source: parsed.source || 'unknown',

        rules: parsed.rules || null,

        id: parsed.rules?.id || null,

        name: parsed.rules?.name || null,

      });

    } catch (err) {

      console.warn('Không thể đọc file lịch sử quy tắc', entry.fullPath, err);

    }

  }

  return results;

}

