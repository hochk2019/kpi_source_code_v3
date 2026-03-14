const DEFAULT_RETRY_DELAYS_MS = [250, 500];

function normalizeBaseUrl(baseUrl) {
  const trimmed = `${baseUrl ?? ''}`.trim();
  if (!trimmed) {
    throw new Error('ECUS bridge API client requires a baseUrl');
  }
  return trimmed.replace(/\/+$/u, '');
}

function buildAuthHeaders(token, extraHeaders = {}) {
  const trimmedToken = `${token ?? ''}`.trim();
  if (!trimmedToken) {
    throw new Error('ECUS bridge API client requires a bridge token');
  }
  return {
    ...extraHeaders,
    Authorization: `Bearer ${trimmedToken}`,
  };
}

function toRetryDelays(retryDelaysMs) {
  if (!Array.isArray(retryDelaysMs) || !retryDelaysMs.length) {
    return [];
  }
  return retryDelaysMs
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function delay(ms) {
  if (!ms) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseResponseBody(response) {
  if (!response) {
    return null;
  }
  if (typeof response.json === 'function') {
    try {
      return await response.json();
    } catch {
      // Fall back to text below.
    }
  }
  if (typeof response.text === 'function') {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return null;
}

function buildHttpError(message, { status = null, url, body } = {}) {
  const error = new Error(message);
  error.status = status;
  error.url = url;
  error.body = body;
  error.retriable = status === null || status >= 500 || status === 429;
  return error;
}

function shouldRetry(error) {
  if (!error) {
    return false;
  }
  if (error.retriable === false) {
    return false;
  }
  if (typeof error.status === 'number') {
    return error.status >= 500 || error.status === 429;
  }
  return true;
}

export function createEcusBridgeApiClient({
  baseUrl,
  token,
  fetchImpl = globalThis.fetch,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('ECUS bridge API client requires a fetch implementation');
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedRetryDelays = toRetryDelays(retryDelaysMs);
  const authHeaders = buildAuthHeaders(token);

  async function request(path, { method = 'GET', body } = {}) {
    const url = `${normalizedBaseUrl}${path}`;
    const headers = body
      ? buildAuthHeaders(token, { 'Content-Type': 'application/json' })
      : authHeaders;

    let lastError = null;
    for (let attempt = 0; attempt <= normalizedRetryDelays.length; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        const responseBody = await parseResponseBody(response);
        if (!response?.ok) {
          throw buildHttpError(
            `ECUS bridge API request failed for ${method} ${path}`,
            {
              status: response?.status ?? null,
              url,
              body: responseBody,
            },
          );
        }
        return responseBody;
      } catch (error) {
        lastError = error;
        if (attempt >= normalizedRetryDelays.length || !shouldRetry(error)) {
          throw error;
        }
        await delay(normalizedRetryDelays[attempt]);
      }
    }
    throw lastError;
  }

  return {
    async fetchSyncConfig() {
      const response = await request('/api/v4/declarations/imports/ecus-config');
      return response?.config ?? response;
    },

    async previewDeclarations(payload) {
      const response = await request('/api/v4/declarations/imports/ecus-preview', {
        method: 'POST',
        body: payload,
      });
      return response?.preview ?? response?.result ?? response;
    },

    async commitDeclarations(payload) {
      const response = await request('/api/v4/declarations/imports/ecus-commit', {
        method: 'POST',
        body: payload,
      });
      return response?.result ?? response;
    },
  };
}
