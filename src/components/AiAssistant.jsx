import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';

import { toast } from '@/shared/toast';

import {

  clearAiCache,

  fetchAiConfig,

  fetchAiProfile,

  fetchAiHistory,

  requestAiCompletion,

  updateAiConfig,

  saveAiHistory,

  clearAiHistory,

  testAiProvider,

  pingAiConnection,

  fetchAiDataSnapshot,

  fetchAiInsights,

  fetchAiSnapshotHistory,

  fetchAiSnapshotHistoryEntry,

  runAiInsightJob,

  submitAiInsightFeedback,

  updateAiInsightSettings,

} from '@/lib/aiClient.js';

import { computeQuickRange } from '@/lib/reports.js';



const SNAPSHOT_CACHE_STORAGE_KEY = 'aiSnapshotCache.v1';

const SNAPSHOT_CACHE_VERSION = 1;

const SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1000;

const SNAPSHOT_CACHE_MAX_ENTRIES = 6;



function getSnapshotCacheStorage() {

  if (typeof window === 'undefined') {

    return null;

  }

  try {

    return window.sessionStorage || null;

  } catch {

    return null;

  }

}



function readLocalSnapshotCache() {

  const storage = getSnapshotCacheStorage();

  if (!storage) {

    return { version: SNAPSHOT_CACHE_VERSION, entries: [] };

  }

  try {

    const raw = storage.getItem(SNAPSHOT_CACHE_STORAGE_KEY);

    if (!raw) {

      return { version: SNAPSHOT_CACHE_VERSION, entries: [] };

    }

    const parsed = JSON.parse(raw);

    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];

    return { version: SNAPSHOT_CACHE_VERSION, entries };

  } catch {

    return { version: SNAPSHOT_CACHE_VERSION, entries: [] };

  }

}



function writeLocalSnapshotCache(cache) {

  const storage = getSnapshotCacheStorage();

  if (!storage) {

    return;

  }

  try {

    storage.setItem(SNAPSHOT_CACHE_STORAGE_KEY, JSON.stringify(cache));

  } catch {

    // bỏ qua lỗi ghi bộ nhớ phiên

  }

}



function pruneLocalSnapshotCache(now = Date.now()) {

  const cache = readLocalSnapshotCache();

  const entries = [];

  for (const entry of cache.entries) {

    if (!entry || typeof entry !== 'object') {

      continue;

    }

    const key = typeof entry.key === 'string' ? entry.key : '';

    if (!key) {

      continue;

    }

    const cachedAt = Number(entry.cachedAt);

    if (!Number.isFinite(cachedAt)) {

      continue;

    }

    if (SNAPSHOT_CACHE_TTL_MS > 0 && now - cachedAt > SNAPSHOT_CACHE_TTL_MS) {

      continue;

    }

    if (!entry.snapshot || typeof entry.snapshot !== 'object') {

      continue;

    }

    entries.push({ key, cachedAt, snapshot: entry.snapshot });

  }

  entries.sort((a, b) => b.cachedAt - a.cachedAt);

  if (entries.length > SNAPSHOT_CACHE_MAX_ENTRIES) {

    entries.length = SNAPSHOT_CACHE_MAX_ENTRIES;

  }

  if (entries.length !== cache.entries.length) {

    writeLocalSnapshotCache({ version: SNAPSHOT_CACHE_VERSION, entries });

  }

  return { version: SNAPSHOT_CACHE_VERSION, entries };

}



function getLocalSnapshotCacheEntry(cacheKey, now = Date.now()) {

  if (!cacheKey) {

    return null;

  }

  const cache = pruneLocalSnapshotCache(now);

  const entry = cache.entries.find((item) => item.key === cacheKey);

  if (!entry) {

    return null;

  }

  try {

    return {

      key: entry.key,

      cachedAt: entry.cachedAt,

      snapshot: JSON.parse(JSON.stringify(entry.snapshot)),

    };

  } catch {

    return null;

  }

}



function storeLocalSnapshotCacheEntry(cacheKey, snapshot, now = Date.now()) {

  if (!cacheKey || !snapshot || typeof snapshot !== 'object') {

    return;

  }

  let serialized = null;

  try {

    serialized = JSON.parse(JSON.stringify(snapshot));

  } catch {

    return;

  }

  const cache = pruneLocalSnapshotCache(now);

  const entries = cache.entries.filter((entry) => entry.key !== cacheKey);

  entries.unshift({ key: cacheKey, cachedAt: now, snapshot: serialized });

  if (entries.length > SNAPSHOT_CACHE_MAX_ENTRIES) {

    entries.length = SNAPSHOT_CACHE_MAX_ENTRIES;

  }

  writeLocalSnapshotCache({ version: SNAPSHOT_CACHE_VERSION, entries });

}



function buildSnapshotCacheKey(params = {}) {

  const from = typeof params.from === 'string' ? params.from : '';

  const to = typeof params.to === 'string' ? params.to : '';

  return `${from}|${to}`;

}



function formatDateTime(value) {

  if (!value) {

    return 'Chưa có';

  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {

    return 'Chưa có';

  }

  return date.toLocaleString('vi-VN');

}



function formatUsage(usage) {

  if (!usage || typeof usage !== 'object') {

    return null;

  }

  const prompt = usage.prompt_tokens ?? usage.promptTokens;

  const completion = usage.completion_tokens ?? usage.completionTokens;

  const total = usage.total_tokens ?? usage.totalTokens;

  const parts = [];

  if (Number.isFinite(prompt)) {

    parts.push(`Prompt: ${prompt}`);

  }

  if (Number.isFinite(completion)) {

    parts.push(`Hoàn thành: ${completion}`);

  }

  if (Number.isFinite(total)) {

    parts.push(`Tổng: ${total}`);

  }

  if (parts.length === 0) {

    return null;

  }

  return parts.join(' • ');

}



function resolveProviderLabel(profile, config, providerId) {

  if (!providerId) {

    return 'Mặc định';

  }

  const fromProfile = profile?.providers?.find((entry) => entry.id === providerId);

  if (fromProfile) {

    return fromProfile.label || fromProfile.id;

  }

  const fromConfig = config?.providers?.find((entry) => entry.id === providerId);

  if (fromConfig) {

    return fromConfig.label || fromConfig.id;

  }

  return providerId;

}



function resolveProviderDetails(profile, config, providerId) {

  if (!providerId) {

    return null;

  }

  const fromProfile = profile?.providers?.find((entry) => entry.id === providerId);

  if (fromProfile) {

    return fromProfile;

  }

  const fromConfig = config?.providers?.find((entry) => entry.id === providerId);

  if (fromConfig) {

    return fromConfig;

  }

  return null;

}



function isOllamaProvider(provider) {

  if (!provider) {

    return false;

  }

  const type = `${provider.type || ''}`.toLowerCase();

  const id = `${provider.id || ''}`.toLowerCase();

  if (type.includes('ollama')) {

    return true;

  }

  return id.includes('ollama');

}



function resolveProviderHealth(testState) {

  if (!testState) {

    return {

      label: 'Chưa kiểm tra',

      className: 'border border-gray-200 bg-gray-100 text-gray-700',

    };

  }

  switch (testState.status) {

    case 'success':

      return {

        label: 'Trực tuyến',

        className: 'border border-emerald-200 bg-emerald-100 text-emerald-700',

      };

    case 'error':

      return {

        label: 'Ngoại tuyến',

        className: 'border border-red-200 bg-red-100 text-red-700',

      };

    case 'testing':

      return {

        label: 'Đang kiểm tra…',

        className: 'border border-amber-200 bg-amber-100 text-amber-700',

      };

    case 'stale':

      return {

        label: 'Cần kiểm tra lại',

        className: 'border border-amber-200 bg-amber-50 text-amber-700',

      };

    default:

      return {

        label: 'Không rõ',

        className: 'border border-gray-200 bg-gray-100 text-gray-700',

      };

  }

}



function createDraftFromConfig(config) {

  if (!config || typeof config !== 'object') {

    return null;

  }

  return {

    enabled: config.enabled !== false,

    defaultProvider: config.defaultProvider || '',

    fallbackProvider: config.fallbackProvider || '',

    temperature: config.temperature ?? '',

    maxTokens: config.maxTokens ?? '',

    maxInputLength: config.maxInputLength ?? '',

    timeoutMs: config.timeoutMs ?? '',

    systemPrompt: config.systemPrompt ?? '',

    caching: {

      enabled: config.caching?.enabled !== false,

      ttlMinutes: config.caching?.ttlMinutes ?? '',

      maxEntries: config.caching?.maxEntries ?? '',

    },

    providers: Array.isArray(config.providers)

      ? config.providers.map((provider) => ({

          id: provider.id,

          type: provider.type || 'custom',

          label: provider.label || '',

          enabled: provider.enabled !== false,

          endpoint: provider.endpoint || '',

          deployment: provider.deployment || '',

          apiVersion: provider.apiVersion || '',

          apiKeyEnv: provider.apiKeyEnv || '',

          model: provider.model || '',

          temperature: provider.temperature ?? '',

          maxTokens: provider.maxTokens ?? '',

          apiKey: '',

          apiKeyPreview: provider.apiKeyPreview || '',

          hasStoredKey: provider.hasApiKey || false,

          clearStoredKey: false,

        }))

      : [],

  };

}



function parseNumberInput(value) {

  if (value === null || value === undefined) {

    return undefined;

  }

  const text = `${value}`.trim();

  if (!text) {

    return undefined;

  }

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : undefined;

}



function prepareConfigPayload(draft) {

  if (!draft) {

    return {};

  }

  const fallback = `${draft.fallbackProvider || ''}`.trim();

  return {

    enabled: draft.enabled !== false,

    defaultProvider: `${draft.defaultProvider || ''}`.trim(),

    fallbackProvider: fallback || null,

    temperature: parseNumberInput(draft.temperature),

    maxTokens: parseNumberInput(draft.maxTokens),

    maxInputLength: parseNumberInput(draft.maxInputLength),

    timeoutMs: parseNumberInput(draft.timeoutMs),

    systemPrompt: `${draft.systemPrompt || ''}`.trim(),

    caching: {

      enabled: draft.caching?.enabled !== false,

      ttlMinutes: parseNumberInput(draft.caching?.ttlMinutes),

      maxEntries: parseNumberInput(draft.caching?.maxEntries),

    },

    providers: Array.isArray(draft.providers)

      ? draft.providers.map((provider) => {

          const entry = {

            id: provider.id,

            type: provider.type,

            label: provider.label,

            enabled: provider.enabled !== false,

            endpoint: provider.endpoint || undefined,

            deployment: provider.deployment || undefined,

            apiVersion: provider.apiVersion || undefined,

            apiKeyEnv: provider.apiKeyEnv || undefined,

            model: provider.model || undefined,

            temperature: parseNumberInput(provider.temperature),

            maxTokens: parseNumberInput(provider.maxTokens),

          };

          const keyInput = typeof provider.apiKey === 'string' ? provider.apiKey.trim() : '';

          if (provider.clearStoredKey) {

            entry.clearStoredKey = true;

            entry.apiKey = '';

          } else if (keyInput) {

            entry.apiKey = keyInput;

          }

          return entry;

        })

      : [],

  };

}



function createMessageId() {

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

}



const MAX_HISTORY_MESSAGES = 50;

const MAX_HISTORY_TEXT_LENGTH = 6000;

const MAX_HISTORY_SCOPE_LENGTH = 120;

const MAX_HISTORY_PROVIDER_LENGTH = 120;

const LOCAL_HISTORY_KEY = 'ai_chat_history_guest_v1';

const LOCAL_HISTORY_USER_PREFIX = 'ai_chat_history_user_';



const AI_PROVIDER_PRESETS = [

  {

    key: 'openai-gpt4o',

    label: 'OpenAI GPT-4o mini',

    idBase: 'openai-gpt4o',

    type: 'openai',

    endpoint: 'https://api.openai.com/v1',

    model: 'gpt-4o-mini',

    apiKeyEnv: 'OPENAI_API_KEY',

    temperature: 0.2,

    maxTokens: 1024,

  },

  {

    key: 'anthropic-claude',

    label: 'Anthropic Claude 3.5 Sonnet',

    idBase: 'anthropic-claude',

    type: 'anthropic',

    endpoint: 'https://api.anthropic.com',

    model: 'claude-3-5-sonnet-20241022',

    apiKeyEnv: 'ANTHROPIC_API_KEY',

    apiVersion: '2023-06-01',

    temperature: 0.2,

    maxTokens: 1024,

  },

  {

    key: 'google-gemini',

    label: 'Google AI Studio Gemini',

    idBase: 'google-ai-studio',

    type: 'google-ai-studio',

    endpoint: 'https://generativelanguage.googleapis.com',

    model: 'gemini-1.5-flash',

    apiKeyEnv: 'GOOGLE_AI_STUDIO_API_KEY',

    temperature: 0.3,

    maxTokens: 1024,

  },

  {

    key: 'azure-custom',

    label: 'Azure OpenAI (tùy chỉnh)',

    idBase: 'azure-openai',

    type: 'azure',

    endpoint: '',

    deployment: '',

    apiVersion: '2024-08-01-preview',

    apiKeyEnv: 'AZURE_OPENAI_KEY',

    temperature: 0.2,

    maxTokens: 2048,

  },

  {

    key: 'deepseek',

    label: 'DeepSeek Chat',

    idBase: 'deepseek-chat',

    type: 'deepseek',

    endpoint: 'https://api.deepseek.com/v1',

    model: 'deepseek-chat',

    apiKeyEnv: 'DEEPSEEK_API_KEY',

    temperature: 0.2,

    maxTokens: 2048,

  },

  {

    key: 'qwen',

    label: 'Alibaba Qwen',

    idBase: 'qwen-plus',

    type: 'qwen',

    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',

    model: 'qwen-plus',

    apiKeyEnv: 'QWEN_API_KEY',

    temperature: 0.2,

    maxTokens: 2048,

  },

  {

    key: 'baidu',

    label: 'Baidu Qianfan ERNIE',

    idBase: 'baidu-ernie',

    type: 'baidu',

    endpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',

    model: 'ernie-speed-128k',

    apiKeyEnv: 'BAIDU_QIANFAN_ACCESS_TOKEN',

    temperature: 0.2,

    maxTokens: 1024,

  },

  {

    key: 'zai',

    label: 'Z.AI Chat',

    idBase: 'zai-chat',

    type: 'zai',

    endpoint: 'https://api.z-ai.com/v1',

    model: 'zai-chat-pro',

    apiKeyEnv: 'ZAI_API_KEY',

    temperature: 0.2,

    maxTokens: 2048,

  },

  {

    key: 'custom',

    label: 'Nhà cung cấp tùy chỉnh',

    idBase: 'custom-provider',

    type: 'custom',

    endpoint: '',

    model: '',

  },

];



const ASSISTANT_MODES = [

  {

    id: 'business',

    label: 'Tư vấn nghiệp vụ',

    scope: 'business',

    description: 'Giải đáp quy trình nghiệp vụ, chính sách KPI và phối hợp giữa các bộ phận.',

    systemPrompt:

      'Bạn là chuyên gia nghiệp vụ hải quan tại Golden Logistics. Hãy cung cấp câu trả lời chi tiết, bám sát quy trình nội bộ, ' +

      'đưa ra khuyến nghị hành động rõ ràng và nhấn mạnh các bước kiểm soát rủi ro.',

    prefillContext:

      'Ưu tiên nhắc lại bước phê duyệt KPI, trách nhiệm từng vai trò và thời gian xử lý theo quy định nội bộ.',

    suggestions: [

      {

        label: 'Quy trình duyệt KPI tháng',

        prompt: 'Tóm tắt quy trình duyệt KPI tháng cho tổ đội mới tham gia hệ thống.',

      },

      {

        label: 'Chuẩn hóa phân công nhân viên',

        prompt: 'Gợi ý cách phân công nhân viên phụ trách tờ khai khi thiếu thông tin từ ECUS.',

      },

      {

        label: 'Checklist bàn giao dữ liệu',

        prompt: 'Liệt kê checklist bàn giao dữ liệu giữa bộ phận nhập liệu và trưởng nhóm.',

      },

    ],

  },

  {

    id: 'analytics',

    label: 'Thống kê nhanh',

    scope: 'analytics',

    description: 'Thực hiện tổng hợp số liệu KPI, so sánh xu hướng và nêu điểm bất thường.',

    systemPrompt:

      'Bạn là chuyên gia phân tích dữ liệu KPI. Hãy sử dụng giọng điệu súc tích, cung cấp số liệu theo bảng/bullet, ' +

      'nhấn mạnh các chênh lệch đáng chú ý và đề xuất hành động xử lý.',

    prefillContext:

      'Sử dụng dữ liệu KPI đã đồng bộ 6 kỳ gần nhất. Ưu tiên hiển thị số liệu dạng bảng, phần trăm tăng/giảm.',

    suggestions: [

      {

        label: 'So sánh KPI theo tổ',

        prompt: 'So sánh KPI 3 tháng gần nhất của các tổ đội và đánh giá xu hướng tăng/giảm.',

      },

      {

        label: 'Top nhân viên tăng trưởng',

        prompt: 'Liệt kê top 5 nhân viên có mức tăng KPI cao nhất so với kỳ trước.',

      },

      {

        label: 'Cảnh báo tụt hạng',

        prompt: 'Phát hiện tổ đội nào đang tụt hạng KPI liên tiếp và đề xuất cách cải thiện.',

      },

    ],

  },

  {

    id: 'data-entry',

    label: 'Trợ giúp nhập liệu',

    scope: 'data-entry',

    description: 'Hướng dẫn chuẩn hóa tờ khai, loại trừ trùng lặp và cập nhật giấy phép nhanh chóng.',

    systemPrompt:

      'Bạn là trợ lý hỗ trợ nhập liệu tờ khai. Hãy cung cấp hướng dẫn từng bước, nêu rõ vị trí thao tác trong hệ thống và ' +

      'nhắc nhở kiểm tra dữ liệu trùng hoặc thiếu.',

    prefillContext:

      'Tập trung vào module Import Data, chức năng làm sạch trùng 11 số đầu và xử lý cảnh báo thiếu nhân viên/tổ đội.',

    suggestions: [

      {

        label: 'Làm sạch trùng 11 số',

        prompt: 'Hướng dẫn thao tác xóa bản trùng 11 số đầu nhưng vẫn giữ bản mới nhất.',

      },

      {

        label: 'Đối soát giấy phép',

        prompt: 'Các bước rà soát lại giấy phép sau khi import Excel để tránh cộng trùng.',

      },

      {

        label: 'Xử lý cảnh báo thiếu thông tin',

        prompt: 'Chi tiết từng bước xử lý cảnh báo tờ khai thiếu nhân viên hoặc tổ đội.',

      },

    ],

  },

];



function sanitizeHistoryUsage(usage) {

  if (!usage || typeof usage !== 'object') {

    return null;

  }

  const prompt = Number(usage.promptTokens ?? usage.prompt_tokens);

  const completion = Number(usage.completionTokens ?? usage.completion_tokens);

  const total = Number(usage.totalTokens ?? usage.total_tokens);

  const normalized = {};

  if (Number.isFinite(prompt) && prompt >= 0) {

    normalized.promptTokens = Math.trunc(prompt);

  }

  if (Number.isFinite(completion) && completion >= 0) {

    normalized.completionTokens = Math.trunc(completion);

  }

  if (Number.isFinite(total) && total >= 0) {

    normalized.totalTokens = Math.trunc(total);

  }

  return Object.keys(normalized).length ? normalized : null;

}



function sanitizeHistoryMessage(message) {

  if (!message || typeof message !== 'object') {

    return null;

  }

  const role = message.role === 'user' || message.role === 'assistant' || message.role === 'error'

    ? message.role

    : null;

  if (!role) {

    return null;

  }

  const rawText = message.text === undefined || message.text === null ? '' : String(message.text);

  const text = rawText.length > MAX_HISTORY_TEXT_LENGTH

    ? rawText.slice(0, MAX_HISTORY_TEXT_LENGTH)

    : rawText;

  const scope = typeof message.scope === 'string' ? message.scope.trim().slice(0, MAX_HISTORY_SCOPE_LENGTH) : '';

  const providerId = typeof message.providerId === 'string'

    ? message.providerId.trim().slice(0, MAX_HISTORY_PROVIDER_LENGTH)

    : '';

  const createdAt = (() => {

    const source = message.createdAt ? new Date(message.createdAt) : new Date();

    if (Number.isNaN(source.getTime())) {

      return new Date().toISOString();

    }

    return source.toISOString();

  })();

  return {

    id:

      typeof message.id === 'string' && message.id.trim()

        ? message.id.trim()

        : createMessageId(),

    role,

    text,

    scope,

    providerId: providerId || null,

    cached: message.cached === true,

    usage: sanitizeHistoryUsage(message.usage),

    createdAt,

  };

}



function limitHistory(messages) {

  if (!Array.isArray(messages)) {

    return [];

  }

  if (messages.length <= MAX_HISTORY_MESSAGES) {

    return messages.slice();

  }

  return messages.slice(messages.length - MAX_HISTORY_MESSAGES);

}



function prepareMessagesForStorage(messages) {

  if (!Array.isArray(messages)) {

    return [];

  }

  const sanitized = [];

  for (const entry of messages) {

    const normalized = sanitizeHistoryMessage(entry);

    if (normalized) {

      sanitized.push(normalized);

    }

  }

  return limitHistory(sanitized);

}



function readLocalHistory(storageKey) {

  if (typeof window === 'undefined' || !window.localStorage) {

    return [];

  }

  try {

    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {

      return [];

    }

    const parsed = JSON.parse(raw);

    return prepareMessagesForStorage(parsed);

  } catch {

    return [];

  }

}



function writeLocalHistory(storageKey, messages) {

  if (typeof window === 'undefined' || !window.localStorage) {

    return;

  }

  const sanitized = prepareMessagesForStorage(messages);

  try {

    if (!sanitized.length) {

      window.localStorage.removeItem(storageKey);

    } else {

      window.localStorage.setItem(storageKey, JSON.stringify(sanitized));

    }

  } catch (err) {

    console.warn('Không thể lưu lịch sử AI vào localStorage', err);

  }

}



function removeLocalHistory(storageKey) {

  if (typeof window === 'undefined' || !window.localStorage) {

    return;

  }

  try {

    window.localStorage.removeItem(storageKey);

  } catch {

    // ignore

  }

}



function getLocalHistoryKey(username) {

  if (username && typeof username === 'string') {

    return `${LOCAL_HISTORY_USER_PREFIX}${username}`;

  }

  return LOCAL_HISTORY_KEY;

}



const CONTROL_CLASS =

  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0";

const CONTROL_CLASS_COMPACT =

  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0";

const SECONDARY_BUTTON_CLASS =

  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-[color:var(--ds-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const SUMMARY_RANGE_OPTIONS = [

  { value: 'this_month', label: 'Tháng này' },

  { value: 'last_month', label: 'Tháng trước' },

  { value: 'this_quarter', label: 'Quý này' },

];



export default function AiAssistant({ currentUser }) {

  const permissions = currentUser?.permissions || {};

  const canUse = permissions.aiAssistUse === true || permissions.aiAssistManage === true;

  const canManage = permissions.aiAssistManage === true;



  const username = currentUser?.username || '';

  const isAuthenticated = !!username;

  const historyStorageKey = useMemo(() => getLocalHistoryKey(username), [username]);

  const defaultMode = ASSISTANT_MODES[0];



  const [profile, setProfile] = useState(null);

  const [profileLoading, setProfileLoading] = useState(false);

  const [profileError, setProfileError] = useState('');



  const [config, setConfig] = useState(null);

  const [draft, setDraft] = useState(null);

  const [cacheSummary, setCacheSummary] = useState([]);

  const [configLoading, setConfigLoading] = useState(false);

  const [configSaving, setConfigSaving] = useState(false);

  const [configError, setConfigError] = useState('');

  const [clearCacheLoading, setClearCacheLoading] = useState(false);

  const [newProviderPreset, setNewProviderPreset] = useState(

    AI_PROVIDER_PRESETS[0]?.key || 'custom'

  );

  const [providerTests, setProviderTests] = useState({});

  const [pingProviderId, setPingProviderId] = useState('');

  const [pingPrompt, setPingPrompt] = useState('Ping hệ thống');

  const [pingState, setPingState] = useState({ status: 'idle' });

  const [pingLoading, setPingLoading] = useState(false);

  const [snapshotRange, setSnapshotRange] = useState('this_month');

  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const [snapshotError, setSnapshotError] = useState('');

  const [snapshotData, setSnapshotData] = useState(null);

  const [summaryLoading, setSummaryLoading] = useState(false);

  const [summaryError, setSummaryError] = useState('');

  const [summaryResult, setSummaryResult] = useState(null);

  const [insights, setInsights] = useState([]);

  const [insightsMeta, setInsightsMeta] = useState(null);

  const [insightsLoading, setInsightsLoading] = useState(false);

  const [insightsError, setInsightsError] = useState('');

  const [insightRunLoading, setInsightRunLoading] = useState(false);

  const [feedbackSubmitting, setFeedbackSubmitting] = useState({});

  const [snapshotHistory, setSnapshotHistory] = useState([]);

  const [snapshotHistoryLoading, setSnapshotHistoryLoading] = useState(false);

  const [snapshotHistoryError, setSnapshotHistoryError] = useState('');

  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);

  const [notifyOnAnomaly, setNotifyOnAnomaly] = useState(false);

  const [notifySaving, setNotifySaving] = useState(false);



  const [messages, setMessages] = useState([]);

  const [prompt, setPrompt] = useState('');

  const [context, setContext] = useState(defaultMode?.prefillContext ?? '');

  const [scope, setScope] = useState(defaultMode?.scope || 'general');

  const [selectedProviderId, setSelectedProviderId] = useState('');

  const [modeId, setModeId] = useState(ASSISTANT_MODES[0].id);

  const activeMode = useMemo(

    () => ASSISTANT_MODES.find((mode) => mode.id === modeId) || ASSISTANT_MODES[0],

    [modeId]

  );

  const [historyKeyword, setHistoryKeyword] = useState('');

  const [sending, setSending] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);

  const [historyReady, setHistoryReady] = useState(false);

  const historyLoadErrorShownRef = useRef(false);

  const historyPersistErrorShownRef = useRef(false);

  const lastSavedSnapshotRef = useRef(JSON.stringify([]));

  const autoHealthCheckedRef = useRef(new Set());



  const appendMessage = useCallback((entry) => {

    const sanitized = sanitizeHistoryMessage(entry);

    if (!sanitized) {

      return;

    }

    setMessages((prev) => {

      const next = Array.isArray(prev) ? prev.slice() : [];

      next.push(sanitized);

      return limitHistory(next);

    });

  }, []);



  const handleModeChange = useCallback((nextModeId) => {

    setModeId(nextModeId);

    const preset = ASSISTANT_MODES.find((mode) => mode.id === nextModeId);

    if (preset?.scope) {

      setScope(preset.scope);

    }

    if (preset) {

      setContext(preset.prefillContext ?? '');

    }

  }, []);



  const handleSuggestionClick = useCallback((suggestion) => {

    if (!suggestion) {

      return;

    }

    if (suggestion.scope) {

      setScope(suggestion.scope);

    }

    if (suggestion.context !== undefined) {

      setContext(suggestion.context);

    }

    if (suggestion.prompt) {

      setPrompt(suggestion.prompt);

    }

  }, []);



  const loadProfile = useCallback(async () => {

    if (!canUse) {

      return;

    }

    setProfileLoading(true);

    setProfileError('');

    try {

      const data = await fetchAiProfile();

      setProfile(data);

      if (data?.defaultProvider) {

        setSelectedProviderId((current) => current || data.defaultProvider);

      }

    } catch (err) {

      const message = err?.message || 'Không thể tải trạng thái trợ lý AI.';

      setProfileError(message);

    } finally {

      setProfileLoading(false);

    }

  }, [canUse]);



  const loadConfig = useCallback(async () => {

    if (!canManage) {

      return;

    }

    setConfigLoading(true);

    setConfigError('');

    try {

      const { config: fetchedConfig, cacheSummary: summary } = await fetchAiConfig();

      setConfig(fetchedConfig);

      setDraft(createDraftFromConfig(fetchedConfig));

      setCacheSummary(summary);

    } catch (err) {

      const message = err?.message || 'Không thể tải cấu hình AI.';

      setConfigError(message);

      toast.error(message);

    } finally {

      setConfigLoading(false);

    }

  }, [canManage]);



  const loadInsights = useCallback(async () => {

    if (!canUse) {

      return;

    }

    setInsightsLoading(true);

    setInsightsError('');

    try {

      const { insights: fetchedInsights, meta } = await fetchAiInsights({ limit: 6, historyLimit: 6 });

      setInsights(Array.isArray(fetchedInsights) ? fetchedInsights : []);

      setInsightsMeta(meta || null);

      if (meta?.history?.entries) {

        setSnapshotHistory(meta.history.entries);

      }

      if (meta?.settings) {

        setNotifyOnAnomaly(meta.settings.notifyOnAnomaly === true);

      }

    } catch (err) {

      const message = err?.message || 'Không thể tải insight AI.';

      setInsightsError(message);

      toast.error(message);

    } finally {

      setInsightsLoading(false);

    }

  }, [canUse]);



  const loadSnapshotHistory = useCallback(

    async (limit = 6) => {

      if (!canUse) {

        return;

      }

      setSnapshotHistoryLoading(true);

      setSnapshotHistoryError('');

      try {

        const entries = await fetchAiSnapshotHistory({ limit });

        setSnapshotHistory(entries);

        setSelectedHistoryEntry((prev) => {

          if (!prev) {

            return prev;

          }

          const match = entries.find((item) => item.id === prev.id);

          return match || null;

        });

      } catch (err) {

        const message = err?.message || 'Không thể tải lịch sử snapshot KPI.';

        setSnapshotHistoryError(message);

        toast.error(message);

      } finally {

        setSnapshotHistoryLoading(false);

      }

    },

    [canUse]

  );



  const handleToggleNotify = useCallback(async () => {

    if (!canManage) {

      return;

    }

    const nextValue = !notifyOnAnomaly;

    setNotifySaving(true);

    try {

      const settings = await updateAiInsightSettings({ notifyOnAnomaly: nextValue });

      setNotifyOnAnomaly(settings?.notifyOnAnomaly === true);

      toast.success(

        settings?.notifyOnAnomaly === true

          ? 'Đã bật thông báo khi insight cảnh báo bất thường.'

          : 'Đã tắt thông báo insight bất thường.'

      );

    } catch (err) {

      const message = err?.message || 'Không thể cập nhật tuỳ chọn insight bất thường.';

      toast.error(message);

    } finally {

      setNotifySaving(false);

    }

  }, [canManage, notifyOnAnomaly]);



  const handleViewHistoryEntry = useCallback(

    async (entryId) => {

      if (!entryId) {

        return;

      }

      const existing = snapshotHistory.find((item) => item.id === entryId);

      if (existing && existing.snapshot) {

        setSelectedHistoryEntry(existing);

        return;

      }

      try {

        setSnapshotHistoryLoading(true);

        const fetched = await fetchAiSnapshotHistoryEntry(entryId);

        if (fetched) {

          setSnapshotHistory((prev) => {

            const next = Array.isArray(prev) ? prev.slice() : [];

            const index = next.findIndex((item) => item.id === fetched.id);

            if (index !== -1) {

              next[index] = fetched;

            } else {

              next.unshift(fetched);

            }

            return next;

          });

          setSelectedHistoryEntry(fetched);

        }

      } catch (err) {

        const message = err?.message || 'Không thể tải snapshot KPI đã lưu.';

        toast.error(message);

      } finally {

        setSnapshotHistoryLoading(false);

      }

    },

    [snapshotHistory]

  );



  const handleCloseHistoryEntry = useCallback(() => {

    setSelectedHistoryEntry(null);

  }, []);



  useEffect(() => {

    if (canUse) {

      loadProfile();

    }

  }, [canUse, loadProfile]);



  useEffect(() => {

    if (canUse) {

      loadInsights();

    }

  }, [canUse, loadInsights]);



  useEffect(() => {

    if (canManage) {

      loadConfig();

    }

  }, [canManage, loadConfig]);



  const numberFormatter = useMemo(() => new Intl.NumberFormat('vi-VN'), []);

  const kpiFormatter = useMemo(

    () =>

      new Intl.NumberFormat('vi-VN', {

        minimumFractionDigits: 1,

        maximumFractionDigits: 1,

      }),

    []

  );



  const buildRangeParams = useCallback(() => {

    const option = SUMMARY_RANGE_OPTIONS.find((item) => item.value === snapshotRange);

    const range = computeQuickRange(snapshotRange);

    const params = {};

    if (range.from) {

      params.from = range.from;

    }

    if (range.to) {

      params.to = range.to;

    }

    return {

      params,

      label: option?.label || 'Khoảng đã chọn',

      range,

    };

  }, [snapshotRange]);



  const buildSnapshotSummaryPrompt = useCallback(

    (snapshot, rangeLabel) => {

      if (!snapshot || !snapshot.summary) {

        return 'Không có dữ liệu KPI để tóm tắt.';

      }

      const summary = snapshot.summary;

      const adjustments = snapshot.adjustments?.totals || {};

      const topStaff = (snapshot.topStaff || [])

        .slice(0, 3)

        .map(

          (item) =>

            `${item.name || 'Chưa gán'}: ${kpiFormatter.format(item.totalKpi || 0)} điểm (${numberFormatter.format(

              item.declarations || 0

            )} tờ khai)`

        )

        .join('; ') || 'Không có dữ liệu nhân viên nổi bật';

      const topTeams = (snapshot.topTeams || [])

        .slice(0, 3)

        .map(

          (item) =>

            `${item.name || 'Chưa gán tổ đội'}: ${kpiFormatter.format(item.totalKpi || 0)} điểm (${numberFormatter.format(

              item.declarations || 0

            )} tờ khai)`

        )

        .join('; ') || 'Không có dữ liệu tổ đội nổi bật';

      const monthlyTrend = (snapshot.trends?.monthly || [])

        .slice(-3)

        .map(

          (item) =>

            `${item.month}: ${numberFormatter.format(item.declarations || 0)} tờ khai, ${kpiFormatter.format(

              item.kpi || 0

            )} điểm`

        )

        .join('; ') || 'Chưa có dữ liệu xu hướng';

      const licenseSamples =

        (summary.licenseSamples || []).slice(0, 5).join(', ') || 'Không có mã giấy phép tiêu biểu';



      const rangeText =

        snapshot.range?.from && snapshot.range?.to

          ? `${snapshot.range.from} → ${snapshot.range.to}`

          : rangeLabel;

      const lines = [

        `Khoảng thời gian phân tích: ${rangeText} (${numberFormatter.format(summary.declarations || 0)} tờ khai)`,

        `Tổng tờ khai: ${numberFormatter.format(summary.declarations || 0)} (Nhập: ${numberFormatter.format(

          summary.import || 0

        )}, Xuất: ${numberFormatter.format(summary.export || 0)})`,

        `Điểm KPI cộng dồn: ${kpiFormatter.format(summary.kpi || 0)} • Mục hàng: ${numberFormatter.format(

          summary.items || 0

        )} • Giấy phép: ${numberFormatter.format(summary.licenses || 0)}`,

        `Điều chỉnh KPI - Đang chờ: ${numberFormatter.format(adjustments.pending || 0)} (≈ ${kpiFormatter.format(

          adjustments.pointsPending || 0

        )} điểm), Đã duyệt: ${numberFormatter.format(adjustments.approved || 0)} (≈ ${kpiFormatter.format(

          adjustments.pointsApproved || 0

        )} điểm)`,

        `Top nhân viên: ${topStaff}`,

        `Top tổ đội: ${topTeams}`,

        `Xu hướng 3 kỳ gần nhất: ${monthlyTrend}`,

        `Mã giấy phép nổi bật: ${licenseSamples}`,

      ];



      return `Bạn là chuyên gia KPI nội bộ. Hãy tóm tắt dữ liệu dưới đây bằng 4-6 gạch đầu dòng tiếng Việt, nêu rõ điểm mạnh, điểm yếu và rủi ro nếu có. Kết thúc bằng một câu khuyến nghị hành động cụ thể.\nDữ liệu:\n${lines.join(

        '\n'

      )}`;

    },

    [kpiFormatter, numberFormatter]

  );



  const handleFetchSnapshot = useCallback(

    async ({ force = false } = {}) => {

      const { params, label } = buildRangeParams();

      const cacheKey = buildSnapshotCacheKey(params);

      if (!force) {

        const cached = getLocalSnapshotCacheEntry(cacheKey);

        if (cached?.snapshot) {

          setSnapshotData(cached.snapshot);

          setSnapshotError('');

          toast.success('Đã dùng snapshot KPI đã lưu tạm trong phiên.');

          return;

        }

      }



      setSnapshotLoading(true);

      setSnapshotError('');

      try {

        const snapshot = await fetchAiDataSnapshot(params);

        setSnapshotData(snapshot);

        if (!snapshot || (snapshot.summary?.declarations ?? 0) === 0) {

          const message = 'Không tìm thấy dữ liệu KPI trong khoảng đã chọn.';

          setSnapshotError(message);

          toast.error(message);

        } else {

          storeLocalSnapshotCacheEntry(cacheKey, snapshot);

          toast.success(`Đã lấy snapshot KPI (${label.toLowerCase()}).`);

        }

      } catch (err) {

        const message = err?.message || 'Không thể lấy snapshot dữ liệu.';

        setSnapshotError(message);

        toast.error(message);

      } finally {

        setSnapshotLoading(false);

      }

    },

    [buildRangeParams]

  );



  const handleGenerateSummary = useCallback(async () => {

    setSummaryError('');

    setSummaryResult(null);

    setSummaryLoading(true);

    try {

      const { params, label } = buildRangeParams();

      const cacheKey = buildSnapshotCacheKey(params);

      let snapshot = snapshotData;

      if (!snapshot) {

        const cached = getLocalSnapshotCacheEntry(cacheKey);

        if (cached?.snapshot) {

          snapshot = cached.snapshot;

          setSnapshotData(snapshot);

        } else {

          try {

            setSnapshotLoading(true);

            snapshot = await fetchAiDataSnapshot(params);

            setSnapshotData(snapshot);

            storeLocalSnapshotCacheEntry(cacheKey, snapshot);

          } finally {

            setSnapshotLoading(false);

          }

        }

      }

      if (!snapshot || (snapshot.summary?.declarations ?? 0) === 0) {

        throw new Error('Không có dữ liệu KPI trong khoảng đã chọn để tóm tắt.');

      }

      const prompt = buildSnapshotSummaryPrompt(snapshot, label);

      const result = await requestAiCompletion({

        scope: 'report_summary',

        providerId: selectedProviderId || undefined,

        prompt,

      });

      setSummaryResult({

        text: result.message || '',

        providerId: result.providerId || selectedProviderId || null,

        usage: result.usage || null,

        cached: !!result.cached,

        generatedAt: new Date().toISOString(),

        rangeLabel: label,

      });

      toast.success(result.cached ? 'Đã lấy tóm tắt KPI từ cache AI.' : 'Đã tạo tóm tắt KPI.');

    } catch (err) {

      const message = err?.message || 'Không thể tạo tóm tắt KPI.';

      setSummaryError(message);

      toast.error(message);

    } finally {

      setSummaryLoading(false);

    }

  }, [buildRangeParams, buildSnapshotSummaryPrompt, requestAiCompletion, selectedProviderId, snapshotData]);



  const snapshotPreviewMetrics = useMemo(() => {

    if (!snapshotData || !snapshotData.summary) {

      return null;

    }

    const summary = snapshotData.summary;

    const adjustments = snapshotData.adjustments?.totals || {};

    const topStaff = (snapshotData.topStaff || [])

      .slice(0, 2)

      .map(

        (item) =>

          `${item.name || 'Chưa gán'} (${kpiFormatter.format(item.totalKpi || 0)} điểm, ${numberFormatter.format(

            item.declarations || 0

          )} tờ khai)`

      )

      .join(', ') || 'Không có';

    const topTeams = (snapshotData.topTeams || [])

      .slice(0, 2)

      .map(

        (item) =>

          `${item.name || 'Chưa gán tổ đội'} (${kpiFormatter.format(item.totalKpi || 0)} điểm, ${numberFormatter.format(

            item.declarations || 0

          )} tờ khai)`

      )

      .join(', ') || 'Không có';



    return [

      `Tờ khai: ${numberFormatter.format(summary.declarations || 0)} (Nhập ${numberFormatter.format(

        summary.import || 0

      )} / Xuất ${numberFormatter.format(summary.export || 0)})`,

      `Điểm KPI: ${kpiFormatter.format(summary.kpi || 0)} • Mục hàng: ${numberFormatter.format(

        summary.items || 0

      )} • Giấy phép: ${numberFormatter.format(summary.licenses || 0)}`,

      `Điều chỉnh - Đang chờ: ${numberFormatter.format(adjustments.pending || 0)}, Đã duyệt: ${numberFormatter.format(

        adjustments.approved || 0

      )}`,

      `Top nhân viên: ${topStaff}`,

      `Top tổ đội: ${topTeams}`,

    ];

  }, [kpiFormatter, numberFormatter, snapshotData]);



  const selectedHistoryMetrics = useMemo(() => {

    if (!selectedHistoryEntry?.snapshot?.summary) {

      return [];

    }

    const snapshot = selectedHistoryEntry.snapshot;

    const summary = snapshot.summary;

    const adjustments = snapshot.adjustments?.totals || {};

    const lines = [];

    lines.push(

      `Tổng tờ khai: ${numberFormatter.format(summary.declarations || 0)} (Nhập ${numberFormatter.format(

        summary.import || 0

      )} / Xuất ${numberFormatter.format(summary.export || 0)})`

    );

    lines.push(`Điểm KPI: ${kpiFormatter.format(summary.kpi || 0)}`);

    lines.push(

      `Điều chỉnh KPI: ${numberFormatter.format(adjustments.approved || 0)} duyệt · ${numberFormatter.format(

        adjustments.pending || 0

      )} chờ · ${numberFormatter.format(adjustments.rejected || 0)} từ chối (tổng ảnh hưởng ${kpiFormatter.format(

        adjustments.totalPoints || 0

      )})`

    );

    const topStaffLine = (snapshot.topStaff || [])

      .slice(0, 3)

      .map(

        (item) =>

          `${item.name || 'Chưa gán'} (${numberFormatter.format(item.declarations || 0)} tờ khai, ${kpiFormatter.format(

            item.totalKpi || 0

          )} KPI)`

      )

      .join('; ');

    if (topStaffLine) {

      lines.push(`Nhân sự nổi bật: ${topStaffLine}`);

    }

    const topTeamsLine = (snapshot.topTeams || [])

      .slice(0, 3)

      .map(

        (item) =>

          `${item.name || 'Chưa gán tổ'} (${numberFormatter.format(item.declarations || 0)} tờ khai, ${kpiFormatter.format(

            item.totalKpi || 0

          )} KPI)`

      )

      .join('; ');

    if (topTeamsLine) {

      lines.push(`Tổ đội nổi bật: ${topTeamsLine}`);

    }

    return lines;

  }, [kpiFormatter, numberFormatter, selectedHistoryEntry]);



  useEffect(() => {

    if (!canUse) {

      setMessages([]);

      setHistoryLoading(false);

      setHistoryReady(false);

      lastSavedSnapshotRef.current = JSON.stringify([]);

      historyLoadErrorShownRef.current = false;

      historyPersistErrorShownRef.current = false;

      return;

    }

    let cancelled = false;

    setHistoryLoading(true);

    setHistoryReady(false);

    historyLoadErrorShownRef.current = false;

    (async () => {

      try {

        let loaded = [];

        if (isAuthenticated) {

          const serverMessages = await fetchAiHistory();

          loaded = prepareMessagesForStorage(serverMessages);

        } else {

          loaded = readLocalHistory(historyStorageKey);

        }

        if (cancelled) {

          return;

        }

        setMessages(loaded);

        lastSavedSnapshotRef.current = JSON.stringify(prepareMessagesForStorage(loaded));

      } catch (err) {

        if (cancelled) {

          return;

        }

        console.error('Không thể tải lịch sử trợ lý AI', err);

        if (!historyLoadErrorShownRef.current) {

          toast.error(err?.message || 'Không thể tải lịch sử trò chuyện AI.');

          historyLoadErrorShownRef.current = true;

        }

        const fallback = isAuthenticated ? [] : readLocalHistory(historyStorageKey);

        setMessages(fallback);

        lastSavedSnapshotRef.current = JSON.stringify(prepareMessagesForStorage(fallback));

      } finally {

        if (!cancelled) {

          setHistoryLoading(false);

          setHistoryReady(true);

        }

      }

    })();

    return () => {

      cancelled = true;

    };

  }, [canUse, isAuthenticated, historyStorageKey]);



  useEffect(() => {

    if (!canUse || !historyReady) {

      return;

    }

    const sanitized = prepareMessagesForStorage(messages);

    const snapshot = JSON.stringify(sanitized);

    if (snapshot === lastSavedSnapshotRef.current) {

      return;

    }

    let cancelled = false;

    const persist = async () => {

      try {

        if (isAuthenticated) {

          if (sanitized.length === 0) {

            await clearAiHistory();

          } else {

            await saveAiHistory(sanitized);

          }

        } else if (sanitized.length === 0) {

          removeLocalHistory(historyStorageKey);

        } else {

          writeLocalHistory(historyStorageKey, sanitized);

        }

        if (!cancelled) {

          lastSavedSnapshotRef.current = snapshot;

          historyPersistErrorShownRef.current = false;

        }

      } catch (err) {

        console.error('Không thể lưu lịch sử trợ lý AI', err);

        if (!historyPersistErrorShownRef.current) {

          toast.error(err?.message || 'Không thể lưu lịch sử trò chuyện AI.');

          historyPersistErrorShownRef.current = true;

        }

      }

    };

    persist();

    return () => {

      cancelled = true;

    };

  }, [messages, canUse, historyReady, isAuthenticated, historyStorageKey]);



  const providerOptions = useMemo(() => {

    if (!profile?.providers) {

      return [];

    }

    return profile.providers.filter((entry) => entry.enabled !== false);

  }, [profile]);

  const availableProviders = providerOptions;

  const profileDefaultProvider = useMemo(

    () => resolveProviderDetails(profile, config, profile?.defaultProvider),

    [profile, config]

  );

  const draftDefaultProvider = useMemo(() => {

    if (!draft || !draft.defaultProvider) {

      return null;

    }

    const providers = Array.isArray(draft.providers) ? draft.providers : [];

    const inDraft = providers.find((entry) => entry.id === draft.defaultProvider);

    if (inDraft) {

      return inDraft;

    }

    return resolveProviderDetails(profile, config, draft.defaultProvider);

  }, [draft, profile, config]);

  const pingUsageSummary = pingState.usage ? formatUsage(pingState.usage) : null;



  useEffect(() => {

    if (!availableProviders.length) {

      if (pingProviderId) {

        setPingProviderId('');

      }

      return;

    }

    if (!pingProviderId || !availableProviders.some((provider) => provider.id === pingProviderId)) {

      const defaultOption = availableProviders.find((provider) => provider.id === profile?.defaultProvider);

      const nextId = defaultOption?.id || availableProviders[0].id;

      if (nextId) {

        setPingProviderId(nextId);

      }

    }

  }, [availableProviders, pingProviderId, profile]);



  const handlePingConnection = useCallback(async () => {

    if (pingLoading) {

      return;

    }

    if (!availableProviders.length) {

      const message = 'Chưa có nhà cung cấp nào được cấu hình để kiểm tra.';

      setPingState({ status: 'error', error: message });

      toast.error(message);

      return;

    }

    const defaultOption = availableProviders.find((provider) => provider.id === profile?.defaultProvider);

    const fallbackId = defaultOption?.id || availableProviders[0]?.id || '';

    const providerId = (pingProviderId || fallbackId || '').trim();

    if (!providerId) {

      const message = 'Chưa chọn nhà cung cấp để kiểm tra.';

      setPingState({ status: 'error', error: message });

      toast.error(message);

      return;

    }

    const promptText = pingPrompt.trim() || 'Ping';

    setPingLoading(true);

    setPingState({ status: 'testing' });

    try {

      const result = await pingAiConnection({ providerId, prompt: promptText });

      setPingState({

        status: 'success',

        provider: result?.provider || null,

        message: result?.message || '',

        usage: result?.usage || null,

        timestamp: new Date().toISOString(),

      });

      toast.success('Kết nối trợ lý AI hoạt động.');

    } catch (error) {

      const message = error?.message || 'Không thể kiểm tra kết nối trợ lý AI.';

      setPingState({

        status: 'error',

        error: message,

        timestamp: new Date().toISOString(),

      });

      toast.error(message);

    } finally {

      setPingLoading(false);

    }

  }, [availableProviders, pingLoading, pingPrompt, pingProviderId, profile]);



  useEffect(() => {

    if (!selectedProviderId && profile?.defaultProvider) {

      setSelectedProviderId(profile.defaultProvider);

    }

  }, [profile, selectedProviderId]);



  const filteredMessages = useMemo(() => {

    const keyword = historyKeyword.trim().toLowerCase();

    if (!keyword) {

      return messages;

    }

    return messages.filter((message) => {

      const text = `${message?.text || ''}`.toLowerCase();

      const scopeText = `${message?.scope || ''}`.toLowerCase();

      return text.includes(keyword) || scopeText.includes(keyword);

    });

  }, [messages, historyKeyword]);



  const hasHistoryFilter = historyKeyword.trim().length > 0;



  const handleSendPrompt = async (event) => {

    event.preventDefault();

    if (!canUse || sending) {

      return;

    }

    if (!historyReady) {

      toast.error('Đang tải lịch sử hội thoại, vui lòng thử lại sau vài giây.');

      return;

    }

    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {

      toast.error('Vui lòng nhập nội dung câu hỏi.');

      return;

    }

    const scopeValue = (activeMode?.scope || scope || 'general').trim() || 'general';

    const contextText = context.trim();

    const providerId = selectedProviderId || undefined;

    const userMessage = {

      id: createMessageId(),

      role: 'user',

      text: trimmedPrompt,

      scope: scopeValue,

      createdAt: new Date().toISOString(),

    };

    appendMessage(userMessage);

    setPrompt('');

    setSending(true);

    try {

      const result = await requestAiCompletion({

        prompt: trimmedPrompt,

        context: contextText,

        providerId,

        scope: scopeValue,

        systemPrompt: activeMode?.systemPrompt,

      });

      const assistantMessage = {

        id: createMessageId(),

        role: 'assistant',

        text: result.message || '',

        providerId: result.providerId || providerId || profile?.defaultProvider || null,

        cached: !!result.cached,

        usage: result.usage || null,

        scope: result.scope || scopeValue,

        createdAt: new Date().toISOString(),

      };

      appendMessage(assistantMessage);

      toast.success(result.cached ? 'Đã trả lời từ cache.' : 'Đã nhận phản hồi từ trợ lý AI.');

    } catch (err) {

      const errorMessage = err?.message || 'Không thể gọi trợ lý AI.';

      const errorEntry = {

        id: createMessageId(),

        role: 'error',

        text: errorMessage,

        scope: scopeValue,

        createdAt: new Date().toISOString(),

      };

      appendMessage(errorEntry);

      toast.error(errorMessage);

    } finally {

      setSending(false);

    }

  };



  const handleClearHistory = () => {

    setMessages([]);

  };



  const handleDraftFieldChange = (field, value) => {

    setDraft((prev) => {

      if (!prev) {

        return prev;

      }

      return { ...prev, [field]: value };

    });

  };



  const handleCachingChange = (field, value) => {

    setDraft((prev) => {

      if (!prev) {

        return prev;

      }

      const nextCaching = { ...(prev.caching || { enabled: true, ttlMinutes: '', maxEntries: '' }), [field]: value };

      return { ...prev, caching: nextCaching };

    });

  };



  const handleProviderChange = (providerId, patch) => {

    setDraft((prev) => {

      if (!prev) {

        return prev;

      }

      const providers = Array.isArray(prev.providers) ? prev.providers.slice() : [];

      const index = providers.findIndex((entry) => entry.id === providerId);

      if (index < 0) {

        return prev;

      }

      providers[index] = { ...providers[index], ...patch };

      return { ...prev, providers };

    });

    setProviderTests((prev) => {

      if (!prev || !prev[providerId]) {

        return prev;

      }

      const next = { ...prev };

      next[providerId] = {

        ...prev[providerId],

        status: 'stale',

      };

      return next;

    });

  };



  const handleAddProvider = useCallback(

    (presetKey) => {

      setDraft((prev) => {

        if (!prev) {

          return prev;

        }

        const providers = Array.isArray(prev.providers) ? prev.providers.slice() : [];

        const preset = AI_PROVIDER_PRESETS.find((item) => item.key === presetKey) || AI_PROVIDER_PRESETS[AI_PROVIDER_PRESETS.length - 1];

        const baseId = (preset?.idBase || 'provider').trim() || 'provider';

        const used = new Set(providers.map((item) => item.id));

        let candidate = baseId;

        let counter = 1;

        while (used.has(candidate)) {

          candidate = `${baseId}-${counter++}`;

        }

        const nextProvider = {

          id: candidate,

          type: preset?.type || 'custom',

          label: preset?.label || `Nhà cung cấp ${providers.length + 1}`,

          enabled: true,

          endpoint: preset?.endpoint || '',

          deployment: preset?.deployment || '',

          apiVersion: preset?.apiVersion || '',

          apiKeyEnv: preset?.apiKeyEnv || '',

          model: preset?.model || '',

          temperature: preset?.temperature ?? '',

          maxTokens: preset?.maxTokens ?? '',

          apiKey: '',

          apiKeyPreview: '',

          hasStoredKey: false,

          clearStoredKey: false,

        };

        return { ...prev, providers: [...providers, nextProvider] };

      });

    },

    []

  );



  const handleRemoveProvider = useCallback((providerId) => {

    setDraft((prev) => {

      if (!prev) {

        return prev;

      }

      const providers = Array.isArray(prev.providers)

        ? prev.providers.filter((provider) => provider.id !== providerId)

        : [];

      const nextDefault = prev.defaultProvider === providerId ? providers[0]?.id || '' : prev.defaultProvider;

      const nextFallback = prev.fallbackProvider === providerId ? '' : prev.fallbackProvider;

      return {

        ...prev,

        providers,

        defaultProvider: nextDefault,

        fallbackProvider: nextFallback,

      };

    });

    setProviderTests((prev) => {

      if (!prev || !prev[providerId]) {

        return prev;

      }

      const next = { ...prev };

      delete next[providerId];

      return next;

    });

  }, []);



  const handleTestProvider = useCallback(

    async (providerId, { silentSuccess = false } = {}) => {

      if (!draft) {

        toast.error('Chưa có cấu hình để kiểm tra.');

        return;

      }

      const providers = Array.isArray(draft.providers) ? draft.providers : [];

      const provider = providers.find((entry) => entry.id === providerId);

      if (!provider) {

        toast.error('Không tìm thấy nhà cung cấp tương ứng.');

        return;

      }

      const payload = { ...provider };

      if (payload.apiKey !== undefined && payload.apiKey !== null) {

        payload.apiKey = `${payload.apiKey}`.trim();

      }

      delete payload.apiKeyPreview;

      delete payload.hasStoredKey;

      setProviderTests((prev) => ({

        ...prev,

        [providerId]: { status: 'testing', startedAt: new Date().toISOString() },

      }));

      try {

        const result = await testAiProvider(payload);

        setProviderTests((prev) => ({

          ...prev,

          [providerId]: {

            status: 'success',

            message: result?.message || 'Đã phản hồi',

            usage: result?.usage || null,

            checkedAt: new Date().toISOString(),

          },

        }));

        if (!silentSuccess) {

          toast.success('Đã kiểm tra kết nối thành công.');

        }

      } catch (error) {

        const errorMessage = error?.message || 'Không thể kiểm thử nhà cung cấp AI.';

        setProviderTests((prev) => ({

          ...prev,

          [providerId]: {

            status: 'error',

            error: errorMessage,

            checkedAt: new Date().toISOString(),

          },

        }));

        toast.error(errorMessage);

      }

    },

    [draft],

  );



  useEffect(() => {

    if (!draft) {

      return;

    }

    const providers = Array.isArray(draft.providers) ? draft.providers : [];

    const activeIds = new Set();

    providers.forEach((provider) => {

      if (!provider?.id) {

        return;

      }

      if (provider.enabled === false) {

        autoHealthCheckedRef.current.delete(provider.id);

        return;

      }

      if (!isOllamaProvider(provider)) {

        return;

      }

      activeIds.add(provider.id);

      if (autoHealthCheckedRef.current.has(provider.id)) {

        return;

      }

      autoHealthCheckedRef.current.add(provider.id);

      handleTestProvider(provider.id, { silentSuccess: true }).catch((error) => {

        console.error('Kiểm tra nhà cung cấp Ollama thất bại', error);

      });

    });

    for (const key of Array.from(autoHealthCheckedRef.current)) {

      if (!activeIds.has(key)) {

        autoHealthCheckedRef.current.delete(key);

      }

    }

  }, [draft, handleTestProvider]);



  const handleConfigReset = () => {

    setDraft(createDraftFromConfig(config));

  };



  const handleConfigSubmit = async (event) => {

    event.preventDefault();

    if (!draft || configSaving) {

      return;

    }

    const defaultProvider = `${draft.defaultProvider || ''}`.trim();

    if (!defaultProvider) {

      toast.error('Vui lòng chọn nhà cung cấp mặc định.');

      return;

    }

    setConfigSaving(true);

    try {

      const payload = prepareConfigPayload(draft);

      const saved = await updateAiConfig(payload);

      setConfig(saved);

      setDraft(createDraftFromConfig(saved));

      toast.success('Đã cập nhật cấu hình trợ lý AI.');

      await loadProfile();

      await loadConfig();

    } catch (err) {

      const message = err?.message || 'Không thể cập nhật cấu hình AI.';

      toast.error(message);

    } finally {

      setConfigSaving(false);

    }

  };



const handleClearCache = async () => {

  if (clearCacheLoading) {

    return;

  }

  setClearCacheLoading(true);

  try {

    await clearAiCache();

    toast.success('Đã xóa cache phản hồi AI.');

    await loadConfig();

  } catch (err) {

    const message = err?.message || 'Không thể xóa cache AI.';

    toast.error(message);

  } finally {

    setClearCacheLoading(false);

  }

};



const handleRefreshInsights = useCallback(() => {

  loadInsights();

}, [loadInsights]);



const handleRunInsightJob = useCallback(async () => {

  if (insightRunLoading) {

    return;

  }

  setInsightRunLoading(true);

  try {

    const result = await runAiInsightJob();

    if (result?.error) {

      toast.error(result.error);

    } else if (result?.skipped && result.reason === 'no_data') {

      toast.info('Không có dữ liệu KPI mới trong khoảng thời gian mặc định.');

    } else if (result?.cached) {

      toast.success('Đã sử dụng insight gần nhất.');

    } else if (result?.insight) {

      toast.success('Đã sinh insight KPI mới.');

    } else {

      toast.success('Đã chạy insight AI.');

    }

    await loadInsights();

  } catch (err) {

    const message = err?.message || 'Không thể chạy insight AI.';

    toast.error(message);

  } finally {

    setInsightRunLoading(false);

  }

}, [insightRunLoading, loadInsights, runAiInsightJob]);



const handleInsightFeedback = useCallback(

  async (insightId, helpful) => {

    if (!insightId) {

      return;

    }

    setFeedbackSubmitting((prev) => ({ ...prev, [insightId]: true }));

    try {

      const response = await submitAiInsightFeedback(insightId, { helpful });

      const totals = response?.totals || { helpful: 0, notHelpful: 0 };

      const viewerFeedback = response?.feedback

        ? {

            helpful: response.feedback.helpful,

            comment: response.feedback.comment || null,

            updatedAt: response.feedback.updatedAt || null,

          }

        : { helpful, comment: null, updatedAt: new Date().toISOString() };

      setInsights((prev) =>

        prev.map((item) => {

          if (item.insightId !== insightId) {

            return item;

          }

          return {

            ...item,

            feedback: {

              helpful: totals.helpful ?? 0,

              notHelpful: totals.notHelpful ?? 0,

              viewer: viewerFeedback,

            },

          };

        })

      );

      toast.success('Đã ghi nhận phản hồi cho insight.');

    } catch (err) {

      const message = err?.message || 'Không thể gửi phản hồi insight.';

      toast.error(message);

    } finally {

      setFeedbackSubmitting((prev) => {

        const next = { ...prev };

        delete next[insightId];

        return next;

      });

    }

  },

  [submitAiInsightFeedback, setInsights, setFeedbackSubmitting]

);



  return (

    <div className="space-y-6">

      {!canUse && (

        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">

          Tài khoản hiện chưa được cấp quyền sử dụng trợ lý AI. Vui lòng liên hệ quản trị viên để được kích hoạt quyền

          <span className="font-medium"> aiAssistUse</span>.

        </div>

      )}



      {canUse && (

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">

          <section className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm">

            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--ds-border-subtle)] px-4 py-3">

              <div>

                <h2 className="text-base font-semibold text-[color:var(--ds-text-primary)]">Chat với trợ lý AI</h2>

                <p className="text-xs text-[color:var(--ds-text-muted)]">

                  Hỏi về KPI, dữ liệu tờ khai hoặc quy trình nội bộ. Tất cả câu trả lời đều bằng tiếng Việt.

                </p>

                {isOllamaProvider(profileDefaultProvider) && (

                  <p className="mt-1 flex items-center gap-2 text-[11px] font-medium text-emerald-600">

                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />

                    Dữ liệu câu hỏi được xử lý hoàn toàn nội bộ qua Ollama cục bộ.

                  </p>

                )}

              </div>

              <div className="flex gap-2">

                <button

                  type="button"

                  onClick={handleClearHistory}

                  disabled={historyLoading || messages.length === 0}

                  className={SECONDARY_BUTTON_CLASS}

                >

                  Xóa hội thoại

                </button>

                <button

                  type="button"

                  onClick={loadProfile}

                  className={SECONDARY_BUTTON_CLASS}

                  disabled={profileLoading}

                >

                  {profileLoading ? 'Đang tải…' : 'Tải lại cấu hình'}

                </button>

              </div>

            </header>

            <div className="border-t border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-4 py-3">

              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>

                  <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">

                    Chế độ hội thoại

                    <span className="ml-2 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">

                      {activeMode?.scope || 'general'}

                    </span>

                  </p>

                  <p className="text-xs text-[color:var(--ds-text-muted)]">{activeMode?.description}</p>

                </div>

                <div className="flex flex-wrap gap-2">

                  {ASSISTANT_MODES.map((mode) => (

                    <button

                      key={mode.id}

                      type="button"

                      onClick={() => handleModeChange(mode.id)}

                      className={clsx(

                        'rounded-full px-3 py-1 text-xs font-medium transition',

                        mode.id === modeId

                          ? 'bg-amber-500 text-white shadow'

                          : 'border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] text-[color:var(--ds-text-secondary)] hover:border-amber-400 hover:bg-amber-500/10 hover:text-amber-500'

                      )}

                      aria-pressed={mode.id === modeId}

                    >

                      {mode.label}

                    </button>

                  ))}

                </div>

              </div>

              {activeMode?.suggestions?.length ? (

                <div className="mt-3 flex flex-wrap gap-2">

                  {activeMode.suggestions.map((suggestion) => (

                    <button

                      key={suggestion.label}

                      type="button"

                      onClick={() => handleSuggestionClick(suggestion)}

                      className="rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-700 transition hover:bg-amber-50"

                    >

                      {suggestion.label}

                    </button>

                  ))}

                </div>

              ) : null}

              <div className="mt-3 rounded border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]/60 p-3">

                <div className="flex flex-wrap items-end gap-2">

                  <label className="flex flex-col gap-1 text-xs">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Nhà cung cấp kiểm thử</span>

                    <select

                      value={pingProviderId}

                      onChange={(event) => setPingProviderId(event.target.value)}

                      className={clsx('min-w-[200px]', CONTROL_CLASS_COMPACT)}

                      disabled={availableProviders.length === 0}

                    >

                      {availableProviders.length === 0 ? (

                        <option value="">Chưa có nhà cung cấp</option>

                      ) : (

                        availableProviders.map((provider) => (

                          <option key={provider.id} value={provider.id}>

                            {provider.label}

                            {provider.isDefault ? ' • Mặc định' : provider.isFallback ? ' • Dự phòng' : ''}

                          </option>

                        ))

                      )}

                    </select>

                  </label>

                  <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-xs">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Thông điệp kiểm thử</span>

                    <input

                      type="text"

                      value={pingPrompt}

                      onChange={(event) => setPingPrompt(event.target.value)}

                      className={clsx('flex-1', CONTROL_CLASS_COMPACT)}

                      placeholder="Ví dụ: Ping hệ thống"

                    />

                  </label>

                  <button

                    type="button"

                    onClick={handlePingConnection}

                    disabled={pingLoading || availableProviders.length === 0}

                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"

                  >

                    {pingLoading ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}

                  </button>

                </div>

                {pingState.status === 'testing' && (

                  <p className="mt-2 text-xs text-[color:var(--ds-text-muted)]">Đang kiểm tra kết nối…</p>

                )}

                {pingState.status === 'success' && (

                  <div className="mt-2 text-xs text-emerald-600">

                    <span>

                      Đã phản hồi từ {pingState.provider?.label || pingState.provider?.id || 'nhà cung cấp'}:

                      {' '}

                      {pingState.message || 'OK'}

                    </span>

                    <span className="block text-[10px] text-[color:var(--ds-text-muted)]">

                      {pingState.timestamp

                        ? new Date(pingState.timestamp).toLocaleString('vi-VN', { hour12: false })

                        : ''}

                      {pingUsageSummary ? ` • ${pingUsageSummary}` : ''}

                    </span>

                  </div>

                )}

                {pingState.status === 'error' && (

                  <p className="mt-2 text-xs text-red-500">Lỗi: {pingState.error}</p>

                )}

                {availableProviders.length === 0 && (

                  <p className="mt-2 text-xs text-[color:var(--ds-text-muted)]">

                    Chưa có nhà cung cấp nào được cấu hình để kiểm thử.

                  </p>

                )}

              </div>

              <div className="mt-3 space-y-3 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]/60 p-3">

                <div className="flex flex-wrap items-end gap-2">

                  <label className="flex flex-col gap-1 text-xs text-[color:var(--ds-text-secondary)]">

                    Khoảng thời gian

                    <select

                      value={snapshotRange}

                      onChange={(event) => setSnapshotRange(event.target.value)}

                      className={CONTROL_CLASS_COMPACT}

                    >

                      {SUMMARY_RANGE_OPTIONS.map((option) => (

                        <option key={option.value} value={option.value}>

                          {option.label}

                        </option>

                      ))}

                    </select>

                  </label>

                  <button

                    type="button"

                    onClick={(event) => handleFetchSnapshot({ force: event?.shiftKey })}

                    disabled={snapshotLoading}

                    className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1.5 text-xs font-medium text-[color:var(--ds-text-secondary)] shadow-sm transition hover:bg-[color:var(--ds-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"

                    title="Nhấn Shift khi bấm để buộc tải lại từ máy chủ"

                  >

                    {snapshotLoading ? 'Đang tải...' : 'Lấy snapshot'}

                  </button>

                  <button

                    type="button"

                    onClick={handleGenerateSummary}

                    disabled={summaryLoading || snapshotLoading}

                    className="rounded bg-[color:var(--ds-text-primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ds-text-inverse)] shadow transition hover:bg-[color:var(--ds-text-primary)]/80 disabled:cursor-not-allowed disabled:opacity-60"

                  >

                    {summaryLoading ? 'Đang tóm tắt…' : 'Tạo tóm tắt KPI'}

                  </button>

                </div>

                {snapshotLoading && (

                  <p className="text-xs text-[color:var(--ds-text-muted)]">Đang lấy dữ liệu KPI...</p>

                )}

                {snapshotError && <p className="text-xs text-red-400">{snapshotError}</p>}

                {snapshotPreviewMetrics && !snapshotLoading && (

                  <ul className="list-disc space-y-1 pl-4 text-xs text-[color:var(--ds-text-secondary)]">

                    {snapshotPreviewMetrics.map((line) => (

                      <li key={line}>{line}</li>

                    ))}

                  </ul>

                )}

                {summaryLoading && (

                  <p className="text-xs text-[color:var(--ds-text-muted)]">Đang tạo tóm tắt KPI bằng AI...</p>

                )}

                {summaryError && <p className="text-xs text-red-400">{summaryError}</p>}

                {summaryResult && (

                  <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/70 p-3 text-sm text-[color:var(--ds-text-primary)]">

                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--ds-text-muted)]">

                      <span>{summaryResult.rangeLabel}</span>

                      {summaryResult.providerId ? <span>• Provider: {summaryResult.providerId}</span> : null}

                      {summaryResult.cached ? <span>• Cache</span> : null}

                      {summaryResult.usage ? <span>• {formatUsage(summaryResult.usage)}</span> : null}

                      {summaryResult.generatedAt ? (

                        <span>

                          • {new Date(summaryResult.generatedAt).toLocaleString('vi-VN', { hour12: false })}

                        </span>

                      ) : null}

                    </div>

                    <p className="whitespace-pre-wrap leading-relaxed">{summaryResult.text || 'Không có phản hồi.'}</p>

                  </div>

                )}

              </div>

            </div>

            <div className="mt-3 space-y-3 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]/60 p-3">

              <div className="flex flex-wrap items-center justify-between gap-2">

                <div>

                  <h3 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Insight AI tự động</h3>

                  {insightsMeta?.schedule?.nextRun ? (

                    <p className="text-xs text-[color:var(--ds-text-muted)]">

                      {`Lần chạy kế tiếp: ${formatDateTime(insightsMeta.schedule.nextRun)}`}

                    </p>

                  ) : null}

                </div>

                <div className="flex flex-wrap items-center gap-2">

                  <button

                    type="button"

                    onClick={handleRefreshInsights}

                    disabled={insightsLoading}

                    className={SECONDARY_BUTTON_CLASS}

                  >

                    {insightsLoading ? 'Đang tải...' : 'Làm mới'}

                  </button>

                  {canManage ? (

                    <button

                      type="button"

                      onClick={handleRunInsightJob}

                      disabled={insightRunLoading || insightsLoading}

                      className={clsx(SECONDARY_BUTTON_CLASS, 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600')}

                    >

                      {insightRunLoading ? 'Đang chạy...' : 'Chạy ngay'}

                    </button>

                  ) : null}

                </div>

              </div>

              {canManage ? (

                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">

                  <label className="flex items-center gap-2">

                    <input

                      type="checkbox"

                      checked={notifyOnAnomaly}

                      onChange={handleToggleNotify}

                      disabled={notifySaving}

                    />

                    <span>Nhận thông báo khi insight cảnh báo bất thường</span>

                  </label>

                  {notifySaving ? (

                    <p className="mt-1 text-[11px] text-amber-600">Đang lưu tuỳ chọn…</p>

                  ) : null}

                </div>

              ) : null}

              {insightsError ? <p className="text-xs text-red-500">{insightsError}</p> : null}

              {insightsLoading ? (

                <p className="text-sm text-[color:var(--ds-text-muted)]">Đang tải insight AI...</p>

              ) : insights.length === 0 ? (

                <p className="text-sm text-[color:var(--ds-text-muted)]">Chưa có insight AI nào.</p>

              ) : (

                <div className="space-y-3">

                  {insights.map((insight) => {

                    const viewer = insight.feedback?.viewer || null;

                    const viewerHelpful = viewer?.helpful === true;

                    const viewerNotHelpful = viewer?.helpful === false;

                    const saving = !!feedbackSubmitting[insight.insightId];

                    const rangeLabel = insight.meta?.rangeLabel

                      || (insight.range ? `${insight.range.from || '---'} → ${insight.range.to || '---'}` : 'Khoảng thời gian không xác định');

                    return (

                      <div

                        key={insight.insightId}

                        className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/60 p-3"

                      >

                        <div className="flex flex-wrap justify-between gap-2">

                          <div>

                            <p className="text-sm font-medium text-[color:var(--ds-text-primary)]">{rangeLabel}</p>

                            <p className="text-xs text-[color:var(--ds-text-muted)]">

                              {`Tạo lúc ${formatDateTime(insight.createdAt)} • ${insight.status}`}

                            </p>

                          </div>

                          <div className="text-xs text-[color:var(--ds-text-muted)]">

                            {`Tokens: ${insight.tokens?.total ?? 0}`}

                          </div>

                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ds-text-primary)]">

                          {insight.response || 'Không có nội dung.'}

                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3">

                          <div className="flex items-center gap-2">

                            <button

                              type="button"

                              onClick={() => handleInsightFeedback(insight.insightId, true)}

                              disabled={saving}

                              className={clsx(

                                CONTROL_CLASS_COMPACT,

                                viewerHelpful && 'bg-emerald-100 text-emerald-700 border-emerald-300'

                              )}

                            >

                              Hữu ích

                            </button>

                            <button

                              type="button"

                              onClick={() => handleInsightFeedback(insight.insightId, false)}

                              disabled={saving}

                              className={clsx(

                                CONTROL_CLASS_COMPACT,

                                viewerNotHelpful && 'bg-rose-100 text-rose-700 border-rose-300'

                              )}

                            >

                              Chưa hữu ích

                            </button>

                          </div>

                          <span className="text-xs text-[color:var(--ds-text-muted)]">

                            {`${insight.feedback?.helpful ?? 0} hữu ích · ${insight.feedback?.notHelpful ?? 0} chưa hữu ích`}

                          </span>

                        </div>

                      </div>

                    );

                  })}

                </div>

              )}

              <div className="border-t border-dashed border-[color:var(--ds-border-subtle)] pt-3">

                <div className="flex flex-wrap items-center justify-between gap-2">

                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]">

                    Lịch sử snapshot KPI

                  </h4>

                  <div className="flex items-center gap-2">

                    <button

                      type="button"

                      onClick={() => loadSnapshotHistory(6)}

                      disabled={snapshotHistoryLoading}

                      className={SECONDARY_BUTTON_CLASS}

                    >

                      {snapshotHistoryLoading ? 'Đang tải...' : 'Tải lại'}

                    </button>

                    {selectedHistoryEntry ? (

                      <button type="button" onClick={handleCloseHistoryEntry} className={SECONDARY_BUTTON_CLASS}>

                        Thu gọn

                      </button>

                    ) : null}

                  </div>

                </div>

                {snapshotHistoryError ? (

                  <p className="mt-1 text-xs text-red-500">{snapshotHistoryError}</p>

                ) : null}

                {snapshotHistoryLoading && snapshotHistory.length === 0 ? (

                  <p className="text-xs text-[color:var(--ds-text-muted)]">Đang tải lịch sử snapshot...</p>

                ) : snapshotHistory.length === 0 ? (

                  <p className="text-xs text-[color:var(--ds-text-muted)]">Chưa có snapshot nào được lưu.</p>

                ) : (

                  <ul className="mt-2 space-y-2">

                    {snapshotHistory.map((entry) => {

                      const selected = selectedHistoryEntry?.id === entry.id;

                      return (

                        <li

                          key={entry.id}

                          className={clsx(

                            'rounded border px-3 py-2 text-xs transition',

                            selected

                              ? 'border-amber-400 bg-amber-50'

                              : 'border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]'

                          )}

                        >

                          <div className="flex flex-wrap items-center justify-between gap-2">

                            <div>

                              <p className="font-medium text-[color:var(--ds-text-primary)]">

                                {entry.range?.from && entry.range?.to

                                  ? `${entry.range.from} → ${entry.range.to}`

                                  : 'Khoảng thời gian không xác định'}

                              </p>

                              <p className="text-[11px] text-[color:var(--ds-text-muted)]">

                                {`Tạo lúc ${formatDateTime(entry.generatedAt)}`}

                                {entry.rulesVersion ? ` • Quy tắc ${entry.rulesVersion}` : ''}

                                {entry.rosterVersion ? ` • Roster ${entry.rosterVersion}` : ''}

                                {entry.source ? ` • ${entry.source === 'cron' ? 'Tự động' : 'Thủ công'}` : ''}

                              </p>

                            </div>

                            <div className="flex items-center gap-2">

                              {entry.insightId ? (

                                <span className="text-[11px] text-[color:var(--ds-text-muted)]">Insight: {entry.insightId}</span>

                              ) : null}

                              <button

                                type="button"

                                onClick={() => handleViewHistoryEntry(entry.id)}

                                className={SECONDARY_BUTTON_CLASS}

                              >

                                {selected ? 'Đang xem' : 'Xem snapshot'}

                              </button>

                            </div>

                          </div>

                        </li>

                      );

                    })}

                  </ul>

                )}

              </div>

              {selectedHistoryEntry ? (

                <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/60 p-3">

                  <div className="flex flex-wrap items-center justify-between gap-2">

                    <div>

                      <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">

                        {selectedHistoryEntry.range?.from && selectedHistoryEntry.range?.to

                          ? `${selectedHistoryEntry.range.from} → ${selectedHistoryEntry.range.to}`

                          : 'Khoảng thời gian không xác định'}

                      </p>

                      <p className="text-xs text-[color:var(--ds-text-muted)]">

                        {`Snapshot lúc ${formatDateTime(selectedHistoryEntry.generatedAt)}`}

                      </p>

                    </div>

                    <button type="button" onClick={handleCloseHistoryEntry} className={SECONDARY_BUTTON_CLASS}>

                      Đóng

                    </button>

                  </div>

                  {selectedHistoryMetrics.length ? (

                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[color:var(--ds-text-secondary)]">

                      {selectedHistoryMetrics.map((line) => (

                        <li key={line}>{line}</li>

                      ))}

                    </ul>

                  ) : (

                    <p className="mt-2 text-xs text-[color:var(--ds-text-muted)]">Không có dữ liệu tóm tắt.</p>

                  )}

                </div>

              ) : null}

              {insightsMeta?.state?.lastRunAt ? (

                <p className="text-xs text-[color:var(--ds-text-muted)]">

                  {`Lần chạy gần nhất: ${formatDateTime(insightsMeta.state.lastRunAt)} (trạng thái: ${insightsMeta.state.lastStatus})`}

                </p>

              ) : null}

            </div>





            <form onSubmit={handleSendPrompt} className="space-y-4 px-4 py-4">

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">

                <label className="flex flex-col gap-1 text-sm">

                  <span className="font-medium text-[color:var(--ds-text-primary)]">Câu hỏi</span>

                  <textarea

                    value={prompt}

                    onChange={(event) => setPrompt(event.target.value)}

                    rows={4}

                    className={clsx('min-h-[120px]', CONTROL_CLASS)}

                    placeholder="Ví dụ: Tóm tắt điểm KPI tháng 8 cho nhóm A11"

                  />

                </label>

                <div className="flex flex-col gap-3">

                  <label className="flex flex-col gap-1 text-sm">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Phạm vi</span>

                    <input

                      type="text"

                      value={scope}

                      onChange={(event) => setScope(event.target.value)}

                      className={CONTROL_CLASS}

                      placeholder="general, ecus, kpi…"

                    />

                  </label>

                  <label className="flex flex-col gap-1 text-sm">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Nhà cung cấp</span>

                    <select

                      value={selectedProviderId || ''}

                      onChange={(event) => setSelectedProviderId(event.target.value)}

                      className={CONTROL_CLASS}

                    >

                      <option value="">Tự động (theo cấu hình mặc định)</option>

                      {providerOptions.map((provider) => (

                        <option key={provider.id} value={provider.id}>

                          {provider.label}

                          {provider.isDefault ? ' • Mặc định' : provider.isFallback ? ' • Dự phòng' : ''}

                        </option>

                      ))}

                    </select>

                  </label>

                </div>

              </div>

              <label className="flex flex-col gap-1 text-sm">

                <span className="font-medium text-[color:var(--ds-text-primary)]">Ngữ cảnh bổ sung (tùy chọn)</span>

                <textarea

                  value={context}

                  onChange={(event) => setContext(event.target.value)}

                  rows={3}

                  className={clsx('min-h-[72px]', CONTROL_CLASS)}

                  placeholder="Thêm số liệu, chính sách hoặc ghi chú hỗ trợ trả lời chính xác"

                />

              </label>

              <div className="flex items-center justify-end gap-3">

                <button

                  type="submit"

                  disabled={sending || historyLoading}

                  className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"

                >

                  {sending ? 'Đang gửi…' : historyLoading ? 'Đang tải…' : 'Gửi yêu cầu'}

                </button>

              </div>

            </form>

            <div className="border-t border-[color:var(--ds-border-subtle)] px-4 py-4">

              <h3 className="mb-3 text-sm font-semibold text-[color:var(--ds-text-primary)]">Lịch sử hội thoại</h3>

              <div className="mb-3 flex flex-wrap items-center gap-2">

                <input

                  type="search"

                  value={historyKeyword}

                  onChange={(event) => setHistoryKeyword(event.target.value)}

                  placeholder="Tìm nội dung hoặc scope..."

                  className={clsx('min-w-[180px] flex-1', CONTROL_CLASS)}

                />

                <span className="text-xs text-[color:var(--ds-text-muted)]">

                  {hasHistoryFilter

                    ? `${filteredMessages.length}/${messages.length} đoạn khớp`

                    : `${messages.length} đoạn hội thoại`}

                </span>

                {hasHistoryFilter && (

                  <button

                    type="button"

                    onClick={() => setHistoryKeyword('')}

                    className={clsx(SECONDARY_BUTTON_CLASS, 'px-2')}

                  >

                    Xóa lọc

                  </button>

                )}

              </div>

              <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-sm">

                {historyLoading ? (

                  <p className="text-gray-500">Đang tải lịch sử hội thoại…</p>

                ) : filteredMessages.length === 0 ? (

                  <p className="text-gray-500">

                    {hasHistoryFilter

                      ? 'Không tìm thấy hội thoại phù hợp với từ khóa.'

                      : 'Chưa có hội thoại nào. Hãy nhập câu hỏi ở trên để bắt đầu.'}

                  </p>

                ) : null}

                {filteredMessages.map((message) => {

                  const usageText = formatUsage(message.usage);

                  const providerLabel = message.role === 'assistant'

                    ? resolveProviderLabel(profile, config, message.providerId)

                    : null;

                  return (

                    <div

                      key={message.id}

                      className={clsx(

                        'max-w-full rounded border px-3 py-2 text-sm shadow-sm',

                        message.role === 'user' && 'self-end border-amber-200 bg-amber-50 text-amber-900',

                        message.role === 'assistant' && 'self-start border-white bg-white text-gray-800',

                        message.role === 'error' && 'self-start border-red-200 bg-red-50 text-red-700'

                      )}

                    >

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">

                        <span>

                          {message.role === 'user' && 'Người dùng'}

                          {message.role === 'assistant' && (message.cached ? 'AI (cache)' : 'AI')}

                          {message.role === 'error' && 'Lỗi'}

                        </span>

                        <span>{formatDateTime(message.createdAt)}</span>

                      </div>

                      {message.scope && (

                        <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">Scope: {message.scope}</p>

                      )}

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">

                        {message.text || (message.role === 'assistant' ? 'Không có nội dung trả về.' : '')}

                      </p>

                      {providerLabel && (

                        <p className="mt-2 text-xs text-gray-500">Nhà cung cấp: {providerLabel}</p>

                      )}

                      {usageText && (

                        <p className="mt-1 text-xs text-gray-500">Token: {usageText}</p>

                      )}

                    </div>

                  );

                })}

              </div>

            </div>

          </section>



          <aside className="flex flex-col gap-4">

            <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">

              <div className="flex items-center justify-between">

                <h3 className="text-sm font-semibold text-gray-800">Trạng thái</h3>

                <button

                  type="button"

                  onClick={loadProfile}

                  className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"

                  disabled={profileLoading}

                >

                  {profileLoading ? 'Đang tải…' : 'Làm mới'}

                </button>

              </div>

              {profileError && <p className="mt-2 text-xs text-red-600">{profileError}</p>}

              <dl className="mt-3 space-y-2 text-sm text-gray-700">

                <div className="flex justify-between gap-4">

                  <dt>Kích hoạt</dt>

                  <dd className="font-medium">{profile?.enabled === false ? 'Đang tắt' : 'Đang bật'}</dd>

                </div>

                <div className="flex justify-between gap-4">

                  <dt>Mặc định</dt>

                  <dd className="text-right">{resolveProviderLabel(profile, config, profile?.defaultProvider)}</dd>

                </div>

                <div className="flex justify-between gap-4">

                  <dt>Dự phòng</dt>

                  <dd className="text-right">{profile?.fallbackProvider ? resolveProviderLabel(profile, config, profile.fallbackProvider) : 'Không dùng'}</dd>

                </div>

                <div className="flex justify-between gap-4">

                  <dt>Cache</dt>

                  <dd className="text-right">

                    {profile?.caching?.enabled === false

                      ? 'Đang tắt'

                      : `TTL ${profile?.caching?.ttlMinutes ?? 0} phút / ${profile?.caching?.maxEntries ?? 0} bản ghi`}

                  </dd>

                </div>

                <div className="flex justify-between gap-4 text-xs text-gray-500">

                  <dt>Cập nhật</dt>

                  <dd className="text-right">{formatDateTime(profile?.updatedAt)}</dd>

                </div>

              </dl>

              <div className="mt-4 space-y-2 text-xs text-gray-600">

                <p className="font-semibold text-gray-700">Danh sách nhà cung cấp</p>

                {profile?.providers?.length ? (

                  <ul className="space-y-1">

                    {profile.providers.map((provider) => (

                      <li key={provider.id} className="flex items-center justify-between gap-2">

                        <span className="truncate font-medium text-gray-700">{provider.label}</span>

                        <span className="text-[11px] uppercase tracking-wide text-gray-400">

                          {provider.enabled !== false ? 'Đang bật' : 'Tắt'}

                        </span>

                      </li>

                    ))}

                  </ul>

                ) : (

                  <p>Chưa có cấu hình nhà cung cấp.</p>

                )}

              </div>

            </div>



            {canManage && (

              <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">

                <div className="flex items-center justify-between">

                  <h3 className="text-sm font-semibold text-gray-800">Cache gần đây</h3>

                  <button

                    type="button"

                    onClick={handleClearCache}

                    className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60"

                    disabled={clearCacheLoading}

                  >

                    {clearCacheLoading ? 'Đang xóa…' : 'Xóa cache'}

                  </button>

                </div>

                {configLoading && <p className="mt-2 text-xs text-gray-500">Đang tải dữ liệu cache…</p>}

                {!configLoading && cacheSummary.length === 0 && (

                  <p className="mt-2 text-xs text-gray-500">Chưa có dữ liệu được cache.</p>

                )}

                {!configLoading && cacheSummary.length > 0 && (

                  <ul className="mt-3 space-y-2 text-xs text-gray-600">

                    {cacheSummary.slice(0, 5).map((entry) => (

                      <li key={entry.key} className="rounded border border-gray-100 bg-gray-50 p-2">

                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-gray-500">

                          <span>{resolveProviderLabel(profile, config, entry.providerId)}</span>

                          <span>{formatDateTime(entry.createdAt)}</span>

                        </div>

                        <p className="mt-1 font-medium text-gray-700">{entry.promptPreview}</p>

                        <p className="mt-1 text-gray-600">{entry.responsePreview}</p>

                        {entry.actor && <p className="mt-1 text-[11px] text-gray-500">Người hỏi: {entry.actor}</p>}

                        {entry.usage && (

                          <p className="mt-1 text-[11px] text-gray-500">Token: {formatUsage(entry.usage)}</p>

                        )}

                      </li>

                    ))}

                  </ul>

                )}

              </div>

            )}

          </aside>

        </div>

      )}



      {canManage && (

        <section className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm">

          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--ds-border-subtle)] px-4 py-3">

            <div>

              <h2 className="text-base font-semibold text-[color:var(--ds-text-primary)]">Cấu hình trợ lý AI</h2>

              <p className="text-xs text-[color:var(--ds-text-muted)]">Điều chỉnh nhà cung cấp, cache và prompt hệ thống cho toàn bộ tổ chức.</p>

            </div>

            <div className="flex gap-2">

              <button

                type="button"

                onClick={loadConfig}

                className={SECONDARY_BUTTON_CLASS}

                disabled={configLoading}

              >

                {configLoading ? 'Đang tải…' : 'Làm mới'}

              </button>

              <button

                type="button"

                onClick={handleConfigReset}

                className={SECONDARY_BUTTON_CLASS}

                disabled={configLoading || !draft}

              >

                Khôi phục

              </button>

            </div>

          </header>

          {configError && <p className="px-4 pt-3 text-xs text-red-600">{configError}</p>}

          <form onSubmit={handleConfigSubmit} className="space-y-6 px-4 py-4">

            {!draft && configLoading && <p className="text-sm text-[color:var(--ds-text-muted)]">Đang tải cấu hình…</p>}

            {draft && (

              <>

                <div className="grid gap-4 md:grid-cols-2">

                  <label className="flex items-center gap-2 text-sm font-medium text-[color:var(--ds-text-primary)]">

                    <input

                      type="checkbox"

                      checked={draft.enabled !== false}

                      onChange={(event) => handleDraftFieldChange('enabled', event.target.checked)}

                      className="h-4 w-4 rounded border-[color:var(--ds-border-subtle)] text-amber-500 focus:ring-amber-400"

                    />

                    Bật trợ lý AI

                  </label>

                  <label className="flex flex-col gap-1 text-sm">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Nhà cung cấp mặc định</span>

                    <select

                      value={draft.defaultProvider}

                      onChange={(event) => handleDraftFieldChange('defaultProvider', event.target.value)}

                      className={CONTROL_CLASS}

                    >

                      <option value="">-- Chọn nhà cung cấp --</option>

                      {draft.providers.map((provider) => (

                        <option key={provider.id} value={provider.id}>

                          {provider.label || provider.id}

                          {isOllamaProvider(provider) ? ' • Nội bộ (đề xuất)' : ''}

                        </option>

                      ))}

                    </select>

                    {isOllamaProvider(draftDefaultProvider) ? (

                      <p className="text-xs text-emerald-600">

                        Đang sử dụng mô hình Ollama nội bộ — dữ liệu hỏi đáp sẽ được giữ trong mạng doanh nghiệp.

                      </p>

                    ) : (

                      <p className="text-xs text-[color:var(--ds-text-muted)]">

                        Khuyến nghị chọn "Ollama cục bộ" để đảm bảo dữ liệu không rời khỏi hệ thống.

                      </p>

                    )}

                    {draft?.defaultProvider && providerTests[draft.defaultProvider]?.status === 'error' && (

                      <p className="text-xs text-red-600">

                        Không thể kết nối nhà cung cấp mặc định, vui lòng kiểm tra lại dịch vụ Ollama hoặc chọn nhà cung cấp khác.

                      </p>

                    )}

                  </label>

                  <label className="flex flex-col gap-1 text-sm">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Nhà cung cấp dự phòng</span>

                    <select

                      value={draft.fallbackProvider || ''}

                      onChange={(event) => handleDraftFieldChange('fallbackProvider', event.target.value)}

                      className={CONTROL_CLASS}

                    >

                      <option value="">Không dùng dự phòng</option>

                      {draft.providers.map((provider) => (

                        <option key={provider.id} value={provider.id}>

                          {provider.label || provider.id}

                          {isOllamaProvider(provider) ? ' • Nội bộ' : ''}

                        </option>

                      ))}

                    </select>

                  </label>

                  <label className="flex flex-col gap-1 text-sm">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Giới hạn token trả lời</span>

                    <input

                      type="number"

                      min="1"

                      value={draft.maxTokens}

                      onChange={(event) => handleDraftFieldChange('maxTokens', event.target.value)}

                      className={CONTROL_CLASS}

                    />

                  </label>

                  <label className="flex flex-col gap-1 text-sm">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Nhiệt độ (Temperature)</span>

                    <input

                      type="number"

                      step="0.1"

                      value={draft.temperature}

                      onChange={(event) => handleDraftFieldChange('temperature', event.target.value)}

                      className={CONTROL_CLASS}

                    />

                  </label>

                  <label className="flex flex-col gap-1 text-sm">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Giới hạn độ dài prompt</span>

                    <input

                      type="number"

                      min="1"

                      value={draft.maxInputLength}

                      onChange={(event) => handleDraftFieldChange('maxInputLength', event.target.value)}

                      className={CONTROL_CLASS}

                    />

                  </label>

                  <label className="flex flex-col gap-1 text-sm">

                    <span className="font-medium text-[color:var(--ds-text-primary)]">Timeout (ms)</span>

                    <input

                      type="number"

                      min="1000"

                      step="500"

                      value={draft.timeoutMs}

                      onChange={(event) => handleDraftFieldChange('timeoutMs', event.target.value)}

                      className={CONTROL_CLASS}

                    />

                  </label>

                </div>



                <label className="flex flex-col gap-1 text-sm">

                  <span className="font-medium text-[color:var(--ds-text-primary)]">Prompt hệ thống</span>

                  <textarea

                    value={draft.systemPrompt}

                    onChange={(event) => handleDraftFieldChange('systemPrompt', event.target.value)}

                    rows={3}

                    className={clsx('min-h-[96px]', CONTROL_CLASS)}

                    placeholder="Hướng dẫn mặc định cho mọi câu hỏi"

                  />

                </label>



                <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-3">

                  <h3 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Cache tiết kiệm token</h3>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">

                    <label className="flex items-center gap-2 text-sm font-medium text-[color:var(--ds-text-primary)]">

                      <input

                        type="checkbox"

                        checked={draft.caching?.enabled !== false}

                        onChange={(event) => handleCachingChange('enabled', event.target.checked)}

                        className="h-4 w-4 rounded border-[color:var(--ds-border-subtle)] text-amber-500 focus:ring-amber-400"

                      />

                      Bật cache

                    </label>

                    <label className="flex flex-col gap-1 text-sm">

                      <span>TTL (phút)</span>

                      <input

                        type="number"

                        min="1"

                        value={draft.caching?.ttlMinutes}

                        onChange={(event) => handleCachingChange('ttlMinutes', event.target.value)}

                        className={CONTROL_CLASS}

                      />

                    </label>

                    <label className="flex flex-col gap-1 text-sm">

                      <span>Số bản ghi tối đa</span>

                      <input

                        type="number"

                        min="1"

                        value={draft.caching?.maxEntries}

                        onChange={(event) => handleCachingChange('maxEntries', event.target.value)}

                        className={CONTROL_CLASS}

                      />

                    </label>

                  </div>

                </div>



                <div className="space-y-4">

                  <h3 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Nhà cung cấp</h3>

                  <div className="rounded border border-dashed border-amber-300 bg-[color:var(--ds-surface-card)]/70 p-3">

                    <div className="flex flex-wrap items-end gap-3">

                      <label className="flex flex-col text-xs font-medium text-[color:var(--ds-text-primary)]">

                        <span>Preset nhà cung cấp</span>

                        <select

                          value={newProviderPreset}

                          onChange={(event) => setNewProviderPreset(event.target.value)}

                          className={clsx('mt-1', CONTROL_CLASS_COMPACT)}

                        >

                          {AI_PROVIDER_PRESETS.map((preset) => (

                            <option key={preset.key} value={preset.key}>

                              {preset.label}

                            </option>

                          ))}

                        </select>

                      </label>

                      <button

                        type="button"

                        onClick={() => handleAddProvider(newProviderPreset)}

                        className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-600"

                      >

                        Thêm nhà cung cấp

                      </button>

                      <p className="text-xs text-gray-500">

                        Có thể khai báo nhiều nhà cung cấp để chuyển đổi nhanh theo tình huống vận hành.

                      </p>

                    </div>

                  </div>

                  <div className="space-y-1 text-xs text-gray-500">

                    <p>

                      Lưu ý: điền khóa API trực tiếp nếu chưa thiết lập biến môi trường tương ứng trên máy chủ.

                    </p>

                    <ul className="list-disc space-y-0.5 pl-4 text-[color:var(--ds-text-muted)]">

                      <li>

                        Google AI Studio: endpoint mặc định <code className="font-mono">https://generativelanguage.googleapis.com</code>,

                        model đề xuất <code className="font-mono">gemini-1.5-flash</code>, khóa có dạng <code className="font-mono">AIza...</code>.

                      </li>

                      <li>

                        OpenAI: endpoint <code className="font-mono">https://api.openai.com/v1</code>, model ví dụ <code className="font-mono">gpt-4o-mini</code>,

                        khóa mang tiền tố <code className="font-mono">sk-</code>.

                      </li>

                      <li>

                        Anthropic Claude: endpoint <code className="font-mono">https://api.anthropic.com</code>, version <code className="font-mono">2023-06-01</code>,

                        khóa bắt đầu bằng <code className="font-mono">sk-ant-</code>.

                      </li>

                      <li>

                        Azure OpenAI: điền Deployment name và API Version (ví dụ <code className="font-mono">2024-08-01-preview</code>),

                        endpoint dạng <code className="font-mono">https://&lt;tên-dịch-vụ&gt;.openai.azure.com</code>.

                      </li>

                    </ul>

                  </div>

                  {draft.providers.map((provider) => {

                    const testState = providerTests[provider.id] || null;

                    const healthMeta = resolveProviderHealth(testState);

                    return (

                      <div

                        key={provider.id}

                        className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4"

                      >

                        <div className="flex flex-wrap items-center justify-between gap-2">

                          <div className="min-w-0 flex-1">

                            <div className="flex flex-wrap items-center gap-2">

                              <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">

                                {provider.label || provider.id}

                              </p>

                              {isOllamaProvider(provider) && (

                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">

                                  Nội bộ (Ollama)

                                </span>

                              )}

                              <span

                                className={clsx(

                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',

                                  healthMeta.className

                                )}

                              >

                                {healthMeta.label}

                              </span>

                            </div>

                            <p className="text-xs uppercase tracking-wide text-[color:var(--ds-text-muted)]">{provider.id}</p>

                          </div>

                          <label className="flex items-center gap-2 text-xs font-medium text-[color:var(--ds-text-primary)]">

                            <input

                              type="checkbox"

                              checked={provider.enabled !== false}

                              onChange={(event) => handleProviderChange(provider.id, { enabled: event.target.checked })}

                              className="h-4 w-4 rounded border-[color:var(--ds-border-subtle)] text-amber-500 focus:ring-amber-400"

                            />

                            Kích hoạt

                          </label>

                        <button

                          type="button"

                          onClick={() => handleRemoveProvider(provider.id)}

                          className="text-xs font-medium text-red-600 hover:underline"

                        >

                          Xóa

                        </button>

                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">

                        <label className="flex flex-col gap-1 text-sm">

                          <span>Tên hiển thị</span>

                          <input

                            type="text"

                            value={provider.label}

                            onChange={(event) => handleProviderChange(provider.id, { label: event.target.value })}

                            className={CONTROL_CLASS}

                          />

                        </label>

                        <label className="flex flex-col gap-1 text-sm">

                          <span>Endpoint</span>

                          <input

                            type="text"

                            value={provider.endpoint}

                            onChange={(event) => handleProviderChange(provider.id, { endpoint: event.target.value })}

                            className={CONTROL_CLASS}

                          />

                        </label>

                        <label className="flex flex-col gap-1 text-sm">

                          <span>Deployment / Model</span>

                          <input

                            type="text"

                            value={provider.deployment || provider.model || ''}

                            onChange={(event) => {

                              if (provider.type === 'azure' || provider.type === 'azure-openai') {

                                handleProviderChange(provider.id, { deployment: event.target.value });

                              } else {

                                handleProviderChange(provider.id, { model: event.target.value });

                              }

                            }}

                            className={CONTROL_CLASS}

                          />

                        </label>

                        <label className="flex flex-col gap-1 text-sm">

                          <span>API Version / Key env</span>

                          <input

                            type="text"

                            value={provider.type === 'azure' || provider.type === 'azure-openai' ? provider.apiVersion : provider.apiKeyEnv}

                            onChange={(event) => {

                              if (provider.type === 'azure' || provider.type === 'azure-openai') {

                                handleProviderChange(provider.id, { apiVersion: event.target.value });

                              } else {

                                handleProviderChange(provider.id, { apiKeyEnv: event.target.value });

                              }

                            }}

                            className={CONTROL_CLASS}

                          />

                        </label>

                        <label className="flex flex-col gap-1 text-sm">

                          <span>Nhiệt độ riêng</span>

                          <input

                            type="number"

                            step="0.1"

                            value={provider.temperature}

                            onChange={(event) => handleProviderChange(provider.id, { temperature: event.target.value })}

                            className={CONTROL_CLASS}

                          />

                        </label>

                        <label className="flex flex-col gap-1 text-sm">

                          <span>Max tokens riêng</span>

                          <input

                            type="number"

                            min="1"

                            value={provider.maxTokens}

                            onChange={(event) => handleProviderChange(provider.id, { maxTokens: event.target.value })}

                            className={CONTROL_CLASS}

                          />

                        </label>

                        <label className="flex flex-col gap-1 text-sm md:col-span-2">

                          <span>API Key trực tiếp</span>

                          <input

                            type="password"

                            value={provider.apiKey || ''}

                            onChange={(event) =>

                              handleProviderChange(provider.id, {

                                apiKey: event.target.value,

                                clearStoredKey: false,

                              })

                            }

                            placeholder={

                              provider.hasStoredKey && provider.apiKeyPreview

                                ? `Đang lưu: •••${provider.apiKeyPreview}`

                                : 'Ví dụ: AIza..., sk-..., hoặc để trống nếu dùng biến môi trường'

                            }

                            className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"

                          />

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">

                            <span>

                              Để trống nếu dùng biến môi trường {provider.apiKeyEnv || '(chưa đặt)'}.

                            </span>

                            {provider.hasStoredKey && (

                              <button

                                type="button"

                                onClick={() =>

                                  handleProviderChange(provider.id, {

                                    apiKey: '',

                                    clearStoredKey: true,

                                    hasStoredKey: false,

                                    apiKeyPreview: '',

                                  })

                                }

                                className="text-red-600 hover:underline"

                              >

                                Xóa khóa đã lưu

                              </button>

                            )}

                          </div>

                        </label>

                        <div className="md:col-span-2">

                          <div className="flex flex-wrap items-center gap-2">

                            <button

                              type="button"

                              onClick={() => handleTestProvider(provider.id)}

                              className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-xs font-medium text-[color:var(--ds-text-secondary)] shadow-sm transition hover:bg-[color:var(--ds-surface-muted)]"

                            >

                              Kiểm tra khóa API

                            </button>

                            {testState?.status === 'testing' && (

                              <span className="text-xs text-[color:var(--ds-text-muted)]">Đang kiểm tra…</span>

                            )}

                            {testState?.status === 'stale' && (

                              <span className="text-xs text-amber-600">

                                Đã thay đổi cấu hình, cần kiểm tra lại.

                              </span>

                            )}

                            {testState?.status === 'success' && (

                              <span className="text-xs text-emerald-600">

                                Thành công: {testState.message || 'Đã phản hồi'}

                              </span>

                            )}

                            {testState?.status === 'error' && (

                              <span className="text-xs text-red-500">Lỗi: {testState.error}</span>

                            )}

                          </div>

                          {testState?.usage && (

                            <p className="mt-1 text-[10px] text-[color:var(--ds-text-muted)]">

                              {formatUsage(testState.usage)}

                              {testState?.checkedAt && ` • ${new Date(testState.checkedAt).toLocaleString('vi-VN')}`}

                            </p>

                          )}

                        </div>

                      </div>

                    </div>

                    );

                  })}

                </div>



                <div className="flex justify-end gap-2">

                  <button

                    type="button"

                    onClick={handleConfigReset}

                    className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"

                    disabled={configSaving || configLoading}

                  >

                    Hủy thay đổi

                  </button>

                  <button

                    type="submit"

                    disabled={configSaving}

                    className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"

                  >

                    {configSaving ? 'Đang lưu…' : 'Lưu cấu hình'}

                  </button>

                </div>

              </>

            )}

          </form>

        </section>

      )}

    </div>

  );

}

