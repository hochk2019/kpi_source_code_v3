import { fetchWithAuth } from '../auth/localAuth.js';

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

export async function fetchAiProfile({ signal } = {}) {
  const response = await fetchWithAuth('/api/ai/profile', { signal });
  const data = await parseJsonResponse(response, 'Không thể tải trạng thái trợ lý AI.');
  return data.profile || null;
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

export async function testAiProvider(provider, { signal } = {}) {
  const payload = { provider };
  const response = await fetchWithAuth('/api/ai/providers/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await parseJsonResponse(response, 'Không thể kiểm thử kết nối AI.');
  return {
    provider: data.provider || null,
    message: data.message || '',
    usage: data.usage || null,
  };
}

export async function pingAiConnection(params = {}, { signal } = {}) {
  const payload = {};
  if (params.providerId) {
    payload.providerId = params.providerId;
  }
  if (params.prompt) {
    payload.prompt = params.prompt;
  }
  if (params.timeoutMs) {
    payload.timeoutMs = params.timeoutMs;
  }
  const response = await fetchWithAuth('/api/ai/providers/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await parseJsonResponse(response, 'Không thể kiểm tra kết nối trợ lý AI.');
  return {
    provider: data.provider || null,
    message: data.message || '',
    usage: data.usage || null,
  };
}

export async function fetchAiDataSnapshot(params = {}, { signal } = {}) {
  const query = new URLSearchParams();
  if (params.from) {
    query.set('from', params.from);
  }
  if (params.to) {
    query.set('to', params.to);
  }
  const endpoint = `/api/ai/data/snapshot${query.size ? `?${query.toString()}` : ''}`;
  const response = await fetchWithAuth(endpoint, { signal });
  const data = await parseJsonResponse(response, 'Không thể lấy snapshot dữ liệu AI.');
  return data.snapshot || null;
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

export async function fetchAiHistory({ signal } = {}) {
  const response = await fetchWithAuth('/api/ai/history', { signal });
  const data = await parseJsonResponse(response, 'Không thể tải lịch sử trò chuyện AI.');
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function saveAiHistory(messages, { signal } = {}) {
  const payload = {
    messages: Array.isArray(messages) ? messages : [],
  };
  const response = await fetchWithAuth('/api/ai/history', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await parseJsonResponse(response, 'Không thể lưu lịch sử trò chuyện AI.');
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function clearAiHistory({ signal } = {}) {
  const response = await fetchWithAuth('/api/ai/history', {
    method: 'DELETE',
    signal,
  });
  await parseJsonResponse(response, 'Không thể xóa lịch sử trò chuyện AI.');
  return true;
}



export async function fetchAiInsights({ limit, historyLimit, signal } = {}) {
  const query = new URLSearchParams();
  if (Number.isFinite(limit) && limit > 0) {
    query.set('limit', String(Math.floor(limit)));
  }
  if (Number.isFinite(historyLimit) && historyLimit > 0) {
    query.set('historyLimit', String(Math.floor(historyLimit)));
  }
  const endpoint = `/api/ai/insights${query.size ? `?${query.toString()}` : ''}`;
  const response = await fetchWithAuth(endpoint, { signal });
  const data = await parseJsonResponse(response, 'Không thể tải insight AI.');
  return {
    insights: Array.isArray(data.insights) ? data.insights : [],
    meta: data.meta || null,
  };
}

export async function fetchAiSnapshotHistory({ limit, signal } = {}) {
  const query = new URLSearchParams();
  if (Number.isFinite(limit) && limit > 0) {
    query.set('limit', String(Math.floor(limit)));
  }
  const endpoint = `/api/ai/data/snapshot/history${query.size ? `?${query.toString()}` : ''}`;
  const response = await fetchWithAuth(endpoint, { signal });
  const data = await parseJsonResponse(response, 'Không thể tải lịch sử snapshot KPI.');
  return Array.isArray(data.entries) ? data.entries : [];
}

export async function fetchAiSnapshotHistoryEntry(id, { signal } = {}) {
  const endpoint = `/api/ai/data/snapshot/history/${encodeURIComponent(id)}`;
  const response = await fetchWithAuth(endpoint, { signal });
  const data = await parseJsonResponse(response, 'Không thể tải snapshot KPI đã lưu.');
  return data.entry || null;
}

export async function updateAiInsightSettings(settings, { signal } = {}) {
  const payload = { settings: settings || {} };
  const response = await fetchWithAuth('/api/ai/insights/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await parseJsonResponse(response, 'Không thể cập nhật tuỳ chọn insight AI.');
  return data.settings || payload.settings;
}

export async function runAiInsightJob(payload = {}, { signal } = {}) {
  const body = {};
  if (payload.range && typeof payload.range === 'object') {
    body.range = payload.range;
  }
  const response = await fetchWithAuth('/api/ai/insights/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await parseJsonResponse(response, 'Không thể chạy insight AI.');
  return data.result || { ok: true };
}

export async function submitAiInsightFeedback(insightId, payload = {}, { signal } = {}) {
  const body = {
    insightId,
    helpful: payload.helpful,
    comment: typeof payload.comment === 'string' ? payload.comment : undefined,
  };
  const response = await fetchWithAuth('/api/ai/insights/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  return parseJsonResponse(response, 'Không thể lưu phản hồi insight.');
}
