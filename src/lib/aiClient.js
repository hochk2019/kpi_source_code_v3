import { fetchWithAuth } from '@/auth/localAuth.js';

async function parseJsonResponse(response, fallbackMessage = 'Yêu cầu thất bại') {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data?.error || fallbackMessage || `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (data && data.ok === false) {
    throw new Error(data.error || fallbackMessage);
  }
  return data || { ok: true };
}

export async function fetchAiConfig({ signal } = {}) {
  const response = await fetchWithAuth('/api/ai/config', { signal });
  const data = await parseJsonResponse(response, 'Không thể tải cấu hình AI.');
  return {
    config: data.config || null,
    cacheSummary: Array.isArray(data.cacheSummary) ? data.cacheSummary : [],
  };
}

export async function updateAiConfig(config, { signal } = {}) {
  const payload = { config };
  const response = await fetchWithAuth('/api/ai/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await parseJsonResponse(response, 'Không thể cập nhật cấu hình AI.');
  return data.config || null;
}

export async function clearAiCache({ signal } = {}) {
  const response = await fetchWithAuth('/api/ai/cache', {
    method: 'DELETE',
    signal,
  });
  await parseJsonResponse(response, 'Không thể xóa cache AI.');
  return true;
}

export async function requestAiCompletion(payload, { signal } = {}) {
  const body = {
    scope: payload?.scope || 'general',
    providerId: payload?.providerId,
    prompt: payload?.prompt || '',
    context: payload?.context,
    systemPrompt: payload?.systemPrompt,
  };
  const response = await fetchWithAuth('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await parseJsonResponse(response, 'Không thể gọi trợ lý AI.');
  return {
    message: data.message || '',
    cached: !!data.cached,
    usage: data.usage || null,
    providerId: data.providerId || body.providerId || null,
    scope: data.scope || body.scope,
    cacheKey: data.cacheKey || null,
  };
}

