import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import {
  clearAiCache,
  fetchAiConfig,
  fetchAiProfile,
  requestAiCompletion,
  updateAiConfig,
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
      ? draft.providers.map((provider) => ({
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
        }))
      : [],
  };
}

function createMessageId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function AiAssistant({ currentUser }) {
  const permissions = currentUser?.permissions || {};
  const canUse = permissions.aiAssistUse === true || permissions.aiAssistManage === true;
  const canManage = permissions.aiAssistManage === true;

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

  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState('');
  const [scope, setScope] = useState('general');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [sending, setSending] = useState(false);

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

  const handleSendPrompt = async (event) => {
    event.preventDefault();
    if (!canUse || sending) {
      return;
    }
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast.error('Vui lòng nhập nội dung câu hỏi.');
      return;
    }
    const scopeValue = scope.trim() || 'general';
    const contextText = context.trim();
    const providerId = selectedProviderId || undefined;
    const userMessage = {
      id: createMessageId(),
      role: 'user',
      text: trimmedPrompt,
      scope: scopeValue,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');
    setSending(true);
    try {
      const result = await requestAiCompletion({
        prompt: trimmedPrompt,
        context: contextText,
        providerId,
        scope: scopeValue,
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
      setMessages((prev) => [...prev, assistantMessage]);
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
      setMessages((prev) => [...prev, errorEntry]);
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
  };

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
                  className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
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
                  disabled={sending}
                  className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {sending ? 'Đang gửi…' : 'Gửi yêu cầu'}
                </button>
              </div>
            </form>
            <div className="border-t border-gray-100 px-4 py-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Lịch sử hội thoại</h3>
              <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                {messages.length === 0 && (
                  <p className="text-gray-500">Chưa có hội thoại nào. Hãy nhập câu hỏi ở trên để bắt đầu.</p>
                )}
                {messages.map((message) => {
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
                  {draft.providers.map((provider) => (
                    <div key={provider.id} className="rounded border border-gray-100 bg-gray-50 p-4">
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
                      </div>
                    </div>
                  ))}
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
