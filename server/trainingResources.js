import fs from 'node:fs/promises';

import path from 'node:path';

import { fileURLToPath } from 'node:url';



const moduleUrl = typeof import.meta !== 'undefined' ? import.meta.url || '' : '';

const __dirname = moduleUrl.startsWith('file:')

  ? fileURLToPath(new URL('.', moduleUrl))

  : path.resolve(process.cwd(), 'server');



const DATA_DIR = path.resolve(__dirname, 'data');

const TRAINING_FILE = path.resolve(DATA_DIR, 'training-resources.json');



const DEFAULT_RESOURCES = [

  {

    id: 'kpi-dashboard-101',

    title: 'Làm quen dashboard KPI',

    description:

      'Giới thiệu cấu trúc dashboard mới, cách đọc các thẻ KPI nhanh và mẹo lọc dữ liệu theo nhu cầu từng tổ đội.',

    duration: '15 phút',

    level: 'Cơ bản',

    format: 'Video + Slide',

    tags: ['dashboard', 'kpi', 'onboarding'],

    link: 'https://example.com/dao-tao/dashboard-kpi',

  },

  {

    id: 'data-hygiene-checklist',

    title: 'Checklist làm sạch dữ liệu tờ khai',

    description:

      'Các bước rà soát tờ khai trùng 11 số đầu, xử lý giấy phép thiếu và cách ghi chú kết quả cho bộ phận vận hành.',

    duration: '10 phút',

    level: 'Trung cấp',

    format: 'Checklist tương tác',

    tags: ['data-quality', 'import', 'operations'],

    link: 'https://example.com/dao-tao/checklist-du-lieu',

  },

  {

    id: 'ai-assistant-playbook',

    title: 'Sổ tay sử dụng trợ lý AI',

    description:

      'Hướng dẫn đặt câu hỏi hiệu quả, lưu trữ lịch sử hội thoại và chia sẻ câu trả lời chuẩn hoá giữa các nhóm.',

    duration: '12 phút',

    level: 'Trung cấp',

    format: 'Bài viết',

    tags: ['ai', 'hỗ trợ nghiệp vụ'],

    link: 'https://example.com/dao-tao/ai-assistant',

  },

  {

    id: 'advanced-reporting-labs',

    title: 'Phân tích KPI nâng cao với bộ lọc tuỳ chỉnh',

    description:

      'Thực hành tạo bộ lọc yêu thích, so sánh KPI theo kỳ và xuất báo cáo phù hợp với từng phòng ban.',

    duration: '20 phút',

    level: 'Nâng cao',

    format: 'Workshop',

    tags: ['reports', 'analytics'],

    link: 'https://example.com/dao-tao/bao-cao-nang-cao',

  },

];



async function readTrainingFile() {

  try {

    const raw = await fs.readFile(TRAINING_FILE, 'utf8');

    const parsed = JSON.parse(raw);

    if (parsed && Array.isArray(parsed.resources)) {

      return parsed.resources.map((item) => ({ ...item }));

    }

  } catch (err) {

    if (err?.code !== 'ENOENT') {

      console.warn('Không thể đọc training-resources.json, sử dụng dữ liệu mặc định.', err);

    }

  }

  return DEFAULT_RESOURCES.slice();

}



let cachedResources = null;

let lastLoadedAt = 0;

const CACHE_TTL_MS = 5 * 60 * 1000;



export async function getTrainingResources({ forceRefresh = false } = {}) {

  const now = Date.now();

  if (!forceRefresh && cachedResources && now - lastLoadedAt < CACHE_TTL_MS) {

    return cachedResources;

  }

  const resources = await readTrainingFile();

  cachedResources = Array.isArray(resources) ? resources : DEFAULT_RESOURCES.slice();

  lastLoadedAt = now;

  return cachedResources;

}



export function getTrainingCacheMeta() {

  return {

    lastLoadedAt,

    source: cachedResources ? 'cache' : 'cold',

    items: cachedResources ? cachedResources.length : DEFAULT_RESOURCES.length,

  };

}

