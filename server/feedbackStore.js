import fs from 'node:fs/promises';

import path from 'node:path';

import { fileURLToPath } from 'node:url';

import crypto from 'node:crypto';



const moduleUrl = typeof import.meta !== 'undefined' ? import.meta.url || '' : '';

const __dirname = moduleUrl.startsWith('file:')

  ? fileURLToPath(new URL('.', moduleUrl))

  : path.resolve(process.cwd(), 'server');



const DATA_DIR = path.resolve(__dirname, 'data');

const FEEDBACK_FILE = path.resolve(DATA_DIR, 'feedback.json');



async function ensureDataDir() {

  try {

    await fs.mkdir(DATA_DIR, { recursive: true });

  } catch (err) {

    if (err?.code !== 'EEXIST') {

      console.warn('Không thể tạo thư mục data cho phản hồi người dùng.', err);

    }

  }

}



async function readFeedbackFile() {

  try {

    const raw = await fs.readFile(FEEDBACK_FILE, 'utf8');

    const parsed = JSON.parse(raw);

    if (parsed && Array.isArray(parsed.entries)) {

      return parsed.entries.map((entry) => ({ ...entry }));

    }

  } catch (err) {

    if (err?.code !== 'ENOENT') {

      console.warn('Không thể đọc feedback.json, trả về danh sách rỗng.', err);

    }

  }

  return [];

}



async function writeFeedbackFile(entries) {

  await ensureDataDir();

  const payload = JSON.stringify(

    {

      updatedAt: new Date().toISOString(),

      entries,

    },

    null,

    2

  );

  await fs.writeFile(FEEDBACK_FILE, payload, 'utf8');

}



export async function addFeedbackEntry(entry) {

  const now = new Date();

  const normalized = {

    id: crypto.randomUUID(),

    createdAt: now.toISOString(),

    updatedAt: now.toISOString(),

    category: entry?.category || 'khac',

    rating: Number.isFinite(Number(entry?.rating)) ? Number(entry.rating) : null,

    message: (entry?.message || '').toString().trim(),

    actor: (entry?.actor || '').toString().trim() || null,

    contact: (entry?.contact || '').toString().trim() || null,

    meta: entry?.meta && typeof entry.meta === 'object' ? entry.meta : null,

  };



  if (!normalized.message) {

    throw new Error('Thiếu nội dung phản hồi.');

  }



  const list = await readFeedbackFile();

  list.push(normalized);

  await writeFeedbackFile(list);

  return normalized;

}



export async function listFeedbackEntries({ limit = 100 } = {}) {

  const entries = await readFeedbackFile();

  const sorted = entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return sorted.slice(0, limit);

}



export async function getFeedbackSummary() {

  const entries = await readFeedbackFile();

  if (!entries.length) {

    return { total: 0, latestAt: null, averageRating: null };

  }

  const total = entries.length;

  const latestAt = entries.reduce((latest, entry) => {

    const ts = new Date(entry.createdAt).getTime();

    if (!Number.isFinite(ts)) {

      return latest;

    }

    return ts > latest ? ts : latest;

  }, 0);

  const ratingValues = entries

    .map((entry) => Number(entry.rating))

    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);

  const averageRating = ratingValues.length

    ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length

    : null;

  return {

    total,

    latestAt: Number.isFinite(latestAt) && latestAt > 0 ? new Date(latestAt).toISOString() : null,

    averageRating,

  };

}

