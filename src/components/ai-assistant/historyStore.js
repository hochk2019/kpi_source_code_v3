export function createMessageId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const MAX_HISTORY_MESSAGES = 50;
const MAX_HISTORY_TEXT_LENGTH = 6000;
const MAX_HISTORY_SCOPE_LENGTH = 120;
const MAX_HISTORY_PROVIDER_LENGTH = 120;
const LOCAL_HISTORY_KEY = 'ai_chat_history_guest_v1';
const LOCAL_HISTORY_USER_PREFIX = 'ai_chat_history_user_';

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

export function sanitizeHistoryMessage(message) {
  if (!message || typeof message !== 'object') {
    return null;
  }
  const role =
    message.role === 'user' || message.role === 'assistant' || message.role === 'error'
      ? message.role
      : null;
  if (!role) {
    return null;
  }
  const rawText = message.text === undefined || message.text === null ? '' : String(message.text);
  const text =
    rawText.length > MAX_HISTORY_TEXT_LENGTH
      ? rawText.slice(0, MAX_HISTORY_TEXT_LENGTH)
      : rawText;
  const scope =
    typeof message.scope === 'string' ? message.scope.trim().slice(0, MAX_HISTORY_SCOPE_LENGTH) : '';
  const providerId =
    typeof message.providerId === 'string'
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

export function limitHistory(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }
  if (messages.length <= MAX_HISTORY_MESSAGES) {
    return messages.slice();
  }
  return messages.slice(messages.length - MAX_HISTORY_MESSAGES);
}

export function prepareMessagesForStorage(messages) {
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

export function readLocalHistory(storageKey) {
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

export function writeLocalHistory(storageKey, messages) {
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

export function removeLocalHistory(storageKey) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

export function getLocalHistoryKey(username) {
  if (username && typeof username === 'string') {
    return `${LOCAL_HISTORY_USER_PREFIX}${username}`;
  }
  return LOCAL_HISTORY_KEY;
}
