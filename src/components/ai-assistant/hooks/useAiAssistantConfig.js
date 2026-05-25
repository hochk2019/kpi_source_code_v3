import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from '@/shared/toast';
import {
  clearAiCache,
  fetchAiConfig,
  fetchAiProfile,
  pingAiConnection,
  testAiProvider,
  updateAiConfig,
} from '@/lib/aiClient.js';
import {
  createDraftFromConfig,
  isOllamaProvider,
  resolveProviderDetails,
} from '@/components/ai-assistant/providerConfig.js';

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

export function useAiAssistantConfig({
  canManage,
  canUse,
  providerPresets,
}) {
  const autoHealthCheckedRef = useRef(new Set());

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
  const [newProviderPreset, setNewProviderPreset] = useState(providerPresets[0]?.key || 'custom');
  const [providerTests, setProviderTests] = useState({});
  const [pingProviderId, setPingProviderId] = useState('');
  const [pingPrompt, setPingPrompt] = useState('Ping hệ thống');
  const [pingState, setPingState] = useState({ status: 'idle' });
  const [pingLoading, setPingLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!canUse) {
      return;
    }

    setProfileLoading(true);
    setProfileError('');

    try {
      const data = await fetchAiProfile();
      setProfile(data);
    } catch (err) {
      setProfileError(err?.message || 'Không thể tải trạng thái trợ lý AI.');
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

  const providerOptions = useMemo(
    () => (profile?.providers || []).filter((entry) => entry.enabled !== false),
    [profile]
  );
  const availableProviders = providerOptions;
  const profileDefaultProvider = useMemo(
    () => resolveProviderDetails(profile, config, profile?.defaultProvider),
    [config, profile]
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
  }, [config, draft, profile]);
  const pingUsageSummary = pingState.usage ? (
    [
      Number.isFinite(pingState.usage.prompt_tokens ?? pingState.usage.promptTokens)
        ? `Prompt: ${pingState.usage.prompt_tokens ?? pingState.usage.promptTokens}`
        : null,
      Number.isFinite(pingState.usage.completion_tokens ?? pingState.usage.completionTokens)
        ? `Hoàn thành: ${pingState.usage.completion_tokens ?? pingState.usage.completionTokens}`
        : null,
      Number.isFinite(pingState.usage.total_tokens ?? pingState.usage.totalTokens)
        ? `Tổng: ${pingState.usage.total_tokens ?? pingState.usage.totalTokens}`
        : null,
    ].filter(Boolean).join(' • ')
  ) : null;

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

  const handleDraftFieldChange = useCallback((field, value) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return { ...prev, [field]: value };
    });
  }, []);

  const handleCachingChange = useCallback((field, value) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const nextCaching = { ...(prev.caching || { enabled: true, ttlMinutes: '', maxEntries: '' }), [field]: value };
      return { ...prev, caching: nextCaching };
    });
  }, []);

  const handleProviderChange = useCallback((providerId, patch) => {
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

      return {
        ...prev,
        [providerId]: {
          ...prev[providerId],
          status: 'stale',
        },
      };
    });
  }, []);

  const handleAddProvider = useCallback((presetKey) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }

      const providers = Array.isArray(prev.providers) ? prev.providers.slice() : [];
      const fallbackPreset = providerPresets[providerPresets.length - 1] || { key: 'custom', type: 'custom' };
      const preset = providerPresets.find((item) => item.key === presetKey) || fallbackPreset;
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
  }, [providerPresets]);

  const handleRemoveProvider = useCallback((providerId) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }

      const providers = Array.isArray(prev.providers)
        ? prev.providers.filter((provider) => provider.id !== providerId)
        : [];

      return {
        ...prev,
        providers,
        defaultProvider: prev.defaultProvider === providerId ? providers[0]?.id || '' : prev.defaultProvider,
        fallbackProvider: prev.fallbackProvider === providerId ? '' : prev.fallbackProvider,
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

  const handleTestProvider = useCallback(async (providerId, { silentSuccess = false } = {}) => {
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
  }, [draft]);

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

  const handleConfigReset = useCallback(() => {
    setDraft(createDraftFromConfig(config));
  }, [config]);

  const handleConfigSubmit = useCallback(async (event) => {
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
      toast.error(err?.message || 'Không thể cập nhật cấu hình AI.');
    } finally {
      setConfigSaving(false);
    }
  }, [configSaving, draft, loadConfig, loadProfile]);

  const handleClearCache = useCallback(async () => {
    if (clearCacheLoading) {
      return;
    }

    setClearCacheLoading(true);
    try {
      await clearAiCache();
      toast.success('Đã xóa cache phản hồi AI.');
      await loadConfig();
    } catch (err) {
      toast.error(err?.message || 'Không thể xóa cache AI.');
    } finally {
      setClearCacheLoading(false);
    }
  }, [clearCacheLoading, loadConfig]);

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

  return {
    availableProviders,
    cacheSummary,
    clearCacheLoading,
    config,
    configError,
    configLoading,
    configSaving,
    draft,
    draftDefaultProvider,
    handleAddProvider,
    handleCachingChange,
    handleClearCache,
    handleConfigReset,
    handleConfigSubmit,
    handleDraftFieldChange,
    handlePingConnection,
    handleProviderChange,
    handleRemoveProvider,
    handleTestProvider,
    loadConfig,
    loadProfile,
    newProviderPreset,
    pingLoading,
    pingPrompt,
    pingProviderId,
    pingState,
    pingUsageSummary,
    profile,
    profileDefaultProvider,
    profileError,
    profileLoading,
    providerOptions,
    providerTests,
    setNewProviderPreset,
    setPingPrompt,
    setPingProviderId,
  };
}
