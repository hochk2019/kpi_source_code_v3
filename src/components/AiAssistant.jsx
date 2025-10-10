import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
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
} from '@/lib/aiClient.js';

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

  useEffect(() => {
    if (canUse) {
      loadProfile();
    }
  }, [canUse, loadProfile]);

  useEffect(() => {
    if (canManage) {
      loadConfig();
    }
  }, [canManage, loadConfig]);

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
    async (providerId) => {
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
        toast.success('Đã kiểm tra kết nối thành công.');
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
          <section className="rounded border border-gray-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Chat với trợ lý AI</h2>
                <p className="text-xs text-gray-500">
                  Hỏi về KPI, dữ liệu tờ khai hoặc quy trình nội bộ. Tất cả câu trả lời đều bằng tiếng Việt.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  disabled={historyLoading || messages.length === 0}
                  className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Xóa hội thoại
                </button>
                <button
                  type="button"
                  onClick={loadProfile}
                  className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  disabled={profileLoading}
                >
                  {profileLoading ? 'Đang tải…' : 'Tải lại cấu hình'}
                </button>
              </div>
            </header>
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Chế độ hội thoại
                    <span className="ml-2 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {activeMode?.scope || 'general'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">{activeMode?.description}</p>
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
                          : 'border border-gray-300 bg-white text-gray-600 hover:border-amber-400 hover:text-amber-600'
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
            </div>
            <form onSubmit={handleSendPrompt} className="space-y-4 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-gray-700">Câu hỏi</span>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={4}
                    className="min-h-[120px] rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="Ví dụ: Tóm tắt điểm KPI tháng 8 cho nhóm A11"
                  />
                </label>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">Phạm vi</span>
                    <input
                      type="text"
                      value={scope}
                      onChange={(event) => setScope(event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      placeholder="general, ecus, kpi…"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">Nhà cung cấp</span>
                    <select
                      value={selectedProviderId || ''}
                      onChange={(event) => setSelectedProviderId(event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                <span className="font-medium text-gray-700">Ngữ cảnh bổ sung (tùy chọn)</span>
                <textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  rows={3}
                  className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
            <div className="border-t border-gray-100 px-4 py-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Lịch sử hội thoại</h3>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={historyKeyword}
                  onChange={(event) => setHistoryKeyword(event.target.value)}
                  placeholder="Tìm nội dung hoặc scope..."
                  className="min-w-[180px] flex-1 rounded border border-gray-200 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <span className="text-xs text-gray-500">
                  {hasHistoryFilter
                    ? `${filteredMessages.length}/${messages.length} đoạn khớp`
                    : `${messages.length} đoạn hội thoại`}
                </span>
                {hasHistoryFilter && (
                  <button
                    type="button"
                    onClick={() => setHistoryKeyword('')}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
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
        <section className="rounded border border-gray-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Cấu hình trợ lý AI</h2>
              <p className="text-xs text-gray-500">Điều chỉnh nhà cung cấp, cache và prompt hệ thống cho toàn bộ tổ chức.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadConfig}
                className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                disabled={configLoading}
              >
                {configLoading ? 'Đang tải…' : 'Làm mới'}
              </button>
              <button
                type="button"
                onClick={handleConfigReset}
                className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                disabled={configLoading || !draft}
              >
                Khôi phục
              </button>
            </div>
          </header>
          {configError && <p className="px-4 pt-3 text-xs text-red-600">{configError}</p>}
          <form onSubmit={handleConfigSubmit} className="space-y-6 px-4 py-4">
            {!draft && configLoading && <p className="text-sm text-gray-500">Đang tải cấu hình…</p>}
            {draft && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.enabled !== false}
                      onChange={(event) => handleDraftFieldChange('enabled', event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                    />
                    Bật trợ lý AI
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">Nhà cung cấp mặc định</span>
                    <select
                      value={draft.defaultProvider}
                      onChange={(event) => handleDraftFieldChange('defaultProvider', event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      <option value="">-- Chọn nhà cung cấp --</option>
                      {draft.providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label || provider.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">Nhà cung cấp dự phòng</span>
                    <select
                      value={draft.fallbackProvider || ''}
                      onChange={(event) => handleDraftFieldChange('fallbackProvider', event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      <option value="">Không dùng dự phòng</option>
                      {draft.providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label || provider.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">Giới hạn token trả lời</span>
                    <input
                      type="number"
                      min="1"
                      value={draft.maxTokens}
                      onChange={(event) => handleDraftFieldChange('maxTokens', event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">Nhiệt độ (Temperature)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={draft.temperature}
                      onChange={(event) => handleDraftFieldChange('temperature', event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">Giới hạn độ dài prompt</span>
                    <input
                      type="number"
                      min="1"
                      value={draft.maxInputLength}
                      onChange={(event) => handleDraftFieldChange('maxInputLength', event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-gray-700">Timeout (ms)</span>
                    <input
                      type="number"
                      min="1000"
                      step="500"
                      value={draft.timeoutMs}
                      onChange={(event) => handleDraftFieldChange('timeoutMs', event.target.value)}
                      className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-gray-700">Prompt hệ thống</span>
                  <textarea
                    value={draft.systemPrompt}
                    onChange={(event) => handleDraftFieldChange('systemPrompt', event.target.value)}
                    rows={3}
                    className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="Hướng dẫn mặc định cho mọi câu hỏi"
                  />
                </label>

                <div className="rounded border border-gray-100 bg-gray-50 p-3">
                  <h3 className="text-sm font-semibold text-gray-700">Cache tiết kiệm token</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={draft.caching?.enabled !== false}
                        onChange={(event) => handleCachingChange('enabled', event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
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
                        className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span>Số bản ghi tối đa</span>
                      <input
                        type="number"
                        min="1"
                        value={draft.caching?.maxEntries}
                        onChange={(event) => handleCachingChange('maxEntries', event.target.value)}
                        className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700">Nhà cung cấp</h3>
                  <div className="rounded border border-dashed border-amber-200 bg-white/60 p-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col text-xs font-medium text-gray-700">
                        <span>Preset nhà cung cấp</span>
                        <select
                          value={newProviderPreset}
                          onChange={(event) => setNewProviderPreset(event.target.value)}
                          className="mt-1 rounded border border-gray-200 px-3 py-1 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                    return (
                      <div
                        key={provider.id}
                        className="rounded border border-gray-100 bg-gray-50 p-4"
                      >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{provider.label || provider.id}</p>
                          <p className="text-xs uppercase tracking-wide text-gray-500">{provider.id}</p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={provider.enabled !== false}
                            onChange={(event) => handleProviderChange(provider.id, { enabled: event.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
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
                            className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          <span>Endpoint</span>
                          <input
                            type="text"
                            value={provider.endpoint}
                            onChange={(event) => handleProviderChange(provider.id, { endpoint: event.target.value })}
                            className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                            className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                            className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          <span>Nhiệt độ riêng</span>
                          <input
                            type="number"
                            step="0.1"
                            value={provider.temperature}
                            onChange={(event) => handleProviderChange(provider.id, { temperature: event.target.value })}
                            className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          <span>Max tokens riêng</span>
                          <input
                            type="number"
                            min="1"
                            value={provider.maxTokens}
                            onChange={(event) => handleProviderChange(provider.id, { maxTokens: event.target.value })}
                            className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
