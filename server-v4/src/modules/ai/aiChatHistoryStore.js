function createAiHistoryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createAiChatHistoryStore({
  getValue,
  upsertValue,
  deleteValue,
  aiChatHistoryPrefix,
  maxAiHistoryMessages,
  maxAiMessageLength,
  maxAiScopeLength,
  maxAiProviderLength,
}) {
  if (typeof getValue !== 'function' || typeof upsertValue !== 'function' || typeof deleteValue !== 'function') {
    throw new Error('createAiChatHistoryStore requires getValue, upsertValue, and deleteValue handlers.');
  }

  function buildAiHistoryKey(username) {
    const normalized = (username ?? '').toString().trim();
    if (!normalized) {
      throw new Error('Thiếu thông tin tài khoản để lưu lịch sử AI.');
    }
    return `${aiChatHistoryPrefix}${normalized}`;
  }

  function sanitizeAiHistoryUsage(usage) {
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

  function sanitizeAiHistoryMessage(entry) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const role = entry.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'error') {
      return null;
    }

    const rawText = entry.text === undefined || entry.text === null ? '' : String(entry.text);
    const text = rawText.length > maxAiMessageLength ? rawText.slice(0, maxAiMessageLength) : rawText;
    const scope = typeof entry.scope === 'string' ? entry.scope.trim().slice(0, maxAiScopeLength) : '';
    const providerId =
      typeof entry.providerId === 'string'
        ? entry.providerId.trim().slice(0, maxAiProviderLength)
        : '';
    const createdAtSource = entry.createdAt ? new Date(entry.createdAt) : new Date();
    const createdAt = Number.isNaN(createdAtSource.getTime())
      ? new Date().toISOString()
      : createdAtSource.toISOString();

    return {
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : createAiHistoryId(),
      role,
      text,
      scope,
      providerId: providerId || null,
      cached: entry.cached === true,
      usage: sanitizeAiHistoryUsage(entry.usage),
      createdAt,
    };
  }

  function clampAiHistoryMessages(messages) {
    const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
    if (list.length <= maxAiHistoryMessages) {
      return list;
    }
    return list.slice(list.length - maxAiHistoryMessages);
  }

  function loadAiChatHistory(username) {
    const key = buildAiHistoryKey(username);
    const raw = getValue(key);
    if (!raw) {
      return { messages: [], updatedAt: null };
    }

    const parsed = safeParse(raw, null);
    if (Array.isArray(parsed)) {
      const sanitized = clampAiHistoryMessages(parsed.map((item) => sanitizeAiHistoryMessage(item)).filter(Boolean));
      return { messages: sanitized, updatedAt: null };
    }

    if (parsed && typeof parsed === 'object') {
      const baseMessages = Array.isArray(parsed.messages) ? parsed.messages : [];
      const sanitized = clampAiHistoryMessages(
        baseMessages.map((item) => sanitizeAiHistoryMessage(item)).filter(Boolean),
      );
      const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
      return { messages: sanitized, updatedAt };
    }

    return { messages: [], updatedAt: null };
  }

  function saveAiChatHistory(username, messages, { actor = 'system' } = {}) {
    const key = buildAiHistoryKey(username);
    const sanitized = clampAiHistoryMessages(
      (Array.isArray(messages) ? messages : []).map((item) => sanitizeAiHistoryMessage(item)).filter(Boolean),
    );
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      messages: sanitized,
    };
    upsertValue(key, JSON.stringify(payload), { actor, source: 'ai-history' });
    return payload;
  }

  function deleteAiChatHistory(username, { actor = 'system' } = {}) {
    const key = buildAiHistoryKey(username);
    deleteValue(key, { actor, source: 'ai-history-delete' });
  }

  return {
    loadAiChatHistory,
    saveAiChatHistory,
    deleteAiChatHistory,
    sanitizeAiHistoryMessage,
    sanitizeAiHistoryUsage,
  };
}

function safeParse(json, fallback) {
  if (json === null || json === undefined) return fallback;
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
