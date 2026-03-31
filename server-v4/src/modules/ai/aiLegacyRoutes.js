export function registerAiRoutes(app, deps) {
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
    throw new Error('registerAiRoutes requires an Express app instance.');
  }

  const {
    requireAiAssistUsage,
    requireAiAssistManage,
    resolveActor,
    buildAiKpiSnapshot,
    toPositiveInt,
    listAiSnapshotHistory,
    getAiSnapshotHistoryEntry,
    AI_INSIGHT_MAX_ENTRIES,
    getAiInsightsStore,
    sanitizeAiInsightForClient,
    runAiInsightGeneration,
    submitAiInsightFeedback,
    normalizeAiInsightsSettings,
    setAiInsightsStore,
    DEFAULT_AI_INSIGHTS,
    pushAuditLog,
    loadAiChatHistory,
    saveAiChatHistory,
    deleteAiChatHistory,
    getAiConfig,
    buildAiProfile,
    buildAiConfigForClient,
    DEFAULT_AI_CONFIG,
    AI_CACHE_LIMIT,
    pruneAiCache,
    cloneJson,
    DEFAULT_AI_USAGE_CACHE,
    setAiConfig,
    normalizeAiProviderEntry,
    buildErrorDetails,
    selectAiProvider,
    dispatchAiChat,
    buildAbortSignal,
    toFiniteNumber,
    truncateText,
    buildSystemPrompt,
    computeAiCacheKey,
    storeAiCacheEntry,
    normalizeAiUsage,
    clearAiCache,
  } = deps || {};

  if (
    typeof requireAiAssistUsage !== 'function' ||
    typeof requireAiAssistManage !== 'function' ||
    typeof resolveActor !== 'function'
  ) {
    throw new Error('registerAiRoutes requires auth guard dependencies.');
  }

  function normalizeProviderForDiagnostics(rawProvider, { configProviders = [], fallbackSuffix } = {}) {
    const providerInput = rawProvider && typeof rawProvider === 'object' ? rawProvider : null;
    if (!providerInput) {
      const error = new Error('Thiếu thông tin nhà cung cấp.');
      error.status = 400;
      throw error;
    }

    const providers = Array.isArray(configProviders) ? configProviders : [];
    const baseProvider = providerInput?.id ? providers.find((entry) => entry?.id === providerInput.id) || {} : {};
    const fallbackBase = `${
      providerInput.id || providerInput.idBase || baseProvider.id || providerInput.type || 'provider'
    }`.trim();
    const suffixInput = fallbackSuffix === undefined ? 'test' : fallbackSuffix;
    const normalizedSuffix = `${suffixInput || ''}`.trim();
    const fallbackId = normalizedSuffix ? `${fallbackBase}-${normalizedSuffix}` : fallbackBase;
    const normalized = normalizeAiProviderEntry({ ...baseProvider, ...providerInput, id: fallbackId }, baseProvider);

    if (!normalized) {
      const error = new Error('Không thể chuẩn hóa dữ liệu nhà cung cấp.');
      error.status = 400;
      throw error;
    }
    if (!normalized.type) {
      const error = new Error('Thiếu loại nhà cung cấp (type).');
      error.status = 400;
      throw error;
    }

    const providerType = `${normalized.type}`.trim().toLowerCase();
    const isOllamaProvider = providerType === 'ollama' || providerType === 'ollama-local';

    if (!normalized.apiKey) {
      const envKey = normalized.apiKeyEnv ? process.env[normalized.apiKeyEnv] : null;
      if (envKey) {
        normalized.apiKey = envKey;
      }
    }
    if (!normalized.apiKey && !isOllamaProvider) {
      const error = new Error('Vui lòng nhập khóa API trước khi kiểm thử.');
      error.status = 400;
      throw error;
    }

    return normalized;
  }

  function sanitizeProviderPrompt(rawPrompt) {
    return `${rawPrompt || 'Ping'}`.trim().slice(0, 280);
  }

  function buildProviderProbeMessages(promptInput) {
    return [
      {
        role: 'system',
        content:
          'Bạn đang trong chế độ kiểm thử kết nối API. Hãy trả lời thật ngắn gọn (tối đa 30 ký tự) để xác nhận đã nhận được tín hiệu.',
      },
      { role: 'user', content: promptInput || 'Ping' },
    ];
  }

  async function runProviderProbe(normalized, { prompt, timeoutMs }) {
    const promptInput = sanitizeProviderPrompt(prompt);
    const messages = buildProviderProbeMessages(promptInput);
    const safeTimeout = toPositiveInt(timeoutMs, DEFAULT_AI_CONFIG.timeoutMs) || 15000;
    const result = await dispatchAiChat(
      { ...normalized, enabled: true },
      {
        messages,
        temperature: Math.min(Math.max(toFiniteNumber(normalized.temperature, 0.2), 0), 0.6),
        maxTokens: Math.min(toPositiveInt(normalized.maxTokens, DEFAULT_AI_CONFIG.maxTokens) || 128, 256),
      },
      { signal: buildAbortSignal(safeTimeout) },
    );

    return {
      message: truncateText(result?.message || '', 320),
      usage: result?.usage || null,
    };
  }

  app.get('/api/ai/data/snapshot', async (req, res) => {
    const { context, denied } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    const actor = context?.account?.username || resolveActor(req);
    const from = Array.isArray(req.query?.from) ? req.query.from[0] : req.query?.from;
    const to = Array.isArray(req.query?.to) ? req.query.to[0] : req.query?.to;

    try {
      const { snapshot, cached, cacheKey } = await buildAiKpiSnapshot({ from, to }, { actor });
      res.json({ ok: true, snapshot, cached, cacheKey });
    } catch (err) {
      const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
      res.status(status).json({ ok: false, error: err?.message || 'Không thể lấy snapshot KPI.' });
    }
  });

  app.get('/api/ai/data/snapshot/history', (req, res) => {
    const { denied } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    const limitRaw = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit;
    const limit = toPositiveInt(limitRaw, 12) || 12;
    const entries = listAiSnapshotHistory(limit);
    res.json({ ok: true, entries });
  });

  app.get('/api/ai/data/snapshot/history/:id', (req, res) => {
    const { denied } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    const entry = getAiSnapshotHistoryEntry(req.params.id);
    if (!entry) {
      res.status(404).json({ ok: false, error: 'Không tìm thấy snapshot yêu cầu.' });
      return;
    }

    res.json({ ok: true, entry });
  });

  app.get('/api/ai/insights', (req, res) => {
    const { context, denied } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    const username = context?.account?.username || resolveActor(req);
    const limitRaw = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit;
    const limit = toPositiveInt(limitRaw, AI_INSIGHT_MAX_ENTRIES) || AI_INSIGHT_MAX_ENTRIES;
    const historyLimitRaw = Array.isArray(req.query?.historyLimit) ? req.query.historyLimit[0] : req.query?.historyLimit;
    const historyLimit = toPositiveInt(historyLimitRaw, 6) || 6;
    const store = getAiInsightsStore();
    const entries = Array.isArray(store.entries) ? store.entries : [];
    const limited = limit > 0 ? entries.slice(0, limit) : entries;
    const insights = limited.map((entry) => sanitizeAiInsightForClient(entry, { username })).filter(Boolean);
    const historyEntries = listAiSnapshotHistory(historyLimit);

    res.json({
      ok: true,
      insights,
      meta: {
        state: store.state,
        schedule: store.schedule,
        settings: store.settings,
        history: {
          entries: historyEntries,
          limit: historyLimit,
        },
      },
    });
  });

  app.post('/api/ai/insights/run', async (req, res) => {
    const { context, denied } = requireAiAssistManage(req, res);
    if (denied) {
      return;
    }

    const actor = context?.account?.username || resolveActor(req);
    const rangeInput =
      req.body?.range && typeof req.body.range === 'object'
        ? { from: req.body.range.from, to: req.body.range.to }
        : {};

    try {
      const result = await runAiInsightGeneration(rangeInput, { actor });
      res.json({ ok: true, result });
    } catch (err) {
      const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
      res.status(status).json({ ok: false, error: err?.message || 'Không thể chạy insight AI.' });
    }
  });

  app.post('/api/ai/insights/feedback', (req, res) => {
    const { context, denied } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    const username = context?.account?.username || resolveActor(req);
    if (!username) {
      res.status(400).json({ ok: false, error: 'Không xác định được tài khoản hiện tại.' });
      return;
    }

    const insightId = typeof req.body?.insightId === 'string' ? req.body.insightId.trim() : '';
    if (!insightId) {
      res.status(400).json({ ok: false, error: 'Thiếu mã insight để phản hồi.' });
      return;
    }

    const helpfulRaw = req.body?.helpful;
    if (helpfulRaw !== true && helpfulRaw !== false) {
      res.status(400).json({ ok: false, error: 'Vui lòng chọn đánh giá hữu ích hoặc chưa hữu ích.' });
      return;
    }

    try {
      const result = submitAiInsightFeedback(
        insightId,
        username,
        { helpful: helpfulRaw, comment: req.body?.comment },
        { actor: username },
      );
      res.json({ ok: true, totals: result.totals, feedback: result.feedback });
    } catch (err) {
      res.status(400).json({ ok: false, error: err?.message || 'Không thể gửi phản hồi insight.' });
    }
  });

  app.put('/api/ai/insights/settings', (req, res) => {
    const { context, denied } = requireAiAssistManage(req, res);
    if (denied) {
      return;
    }

    const actor = context?.account?.username || resolveActor(req);
    const store = getAiInsightsStore();
    const currentSettings = store.settings || normalizeAiInsightsSettings();
    const payload = req.body?.settings ?? req.body ?? {};
    const nextSettings = normalizeAiInsightsSettings(payload);

    setAiInsightsStore(
      {
        version: store.version || DEFAULT_AI_INSIGHTS.version,
        entries: store.entries,
        state: store.state,
        schedule: store.schedule,
        settings: nextSettings,
      },
      { actor, source: 'ai-insight-settings' },
    );

    if (currentSettings.notifyOnAnomaly !== nextSettings.notifyOnAnomaly) {
      pushAuditLog({
        actor,
        action: 'ai.insight.settings',
        detail: nextSettings.notifyOnAnomaly
          ? 'Bật thông báo khi insight cảnh báo bất thường'
          : 'Tắt thông báo insight bất thường',
      });
    }

    res.json({ ok: true, settings: nextSettings });
  });

  app.get('/api/ai/history', (req, res) => {
    const { context, denied } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    const username = context?.account?.username;
    if (!username) {
      res.status(400).json({ ok: false, error: 'Không xác định được tài khoản hiện tại' });
      return;
    }

    try {
      const history = loadAiChatHistory(username);
      res.json({ ok: true, messages: history.messages, updatedAt: history.updatedAt });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || 'Không thể tải lịch sử trò chuyện AI' });
    }
  });

  app.put('/api/ai/history', (req, res) => {
    const { context, denied } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    const username = context?.account?.username;
    if (!username) {
      res.status(400).json({ ok: false, error: 'Không xác định được tài khoản hiện tại' });
      return;
    }

    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const actor = context.account?.username || resolveActor(req);
      const saved = saveAiChatHistory(username, messages, { actor });
      res.json({ ok: true, messages: saved.messages, updatedAt: saved.updatedAt });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || 'Không thể lưu lịch sử trò chuyện AI' });
    }
  });

  app.delete('/api/ai/history', (req, res) => {
    const { context, denied } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    const username = context?.account?.username;
    if (!username) {
      res.status(400).json({ ok: false, error: 'Không xác định được tài khoản hiện tại' });
      return;
    }

    try {
      const actor = context.account?.username || resolveActor(req);
      deleteAiChatHistory(username, { actor });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || 'Không thể xóa lịch sử trò chuyện AI' });
    }
  });

  app.get('/api/ai/profile', (req, res) => {
    const { denied } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    try {
      const config = getAiConfig();
      res.json({ ok: true, profile: buildAiProfile(config) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || 'Không thể tải trạng thái trợ lý AI' });
    }
  });

  app.get('/api/ai/config', (req, res) => {
    const { denied } = requireAiAssistManage(req, res);
    if (denied) {
      return;
    }

    try {
      const config = getAiConfig();
      const safeConfig = buildAiConfigForClient(config);
      const cachingEnabled = config?.caching?.enabled !== false;
      const ttlMinutes = cachingEnabled
        ? toPositiveInt(config?.caching?.ttlMinutes, DEFAULT_AI_CONFIG.caching.ttlMinutes)
        : 0;
      const maxEntries = toPositiveInt(config?.caching?.maxEntries, AI_CACHE_LIMIT);
      const ttlMs = cachingEnabled && ttlMinutes ? ttlMinutes * 60 * 1000 : 0;
      const { cache } = cachingEnabled ? pruneAiCache(ttlMs, maxEntries) : { cache: cloneJson(DEFAULT_AI_USAGE_CACHE) };
      res.json({ ok: true, config: safeConfig, cacheSummary: summarizeAiCacheEntries(cache.entries) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || 'Không thể tải cấu hình AI' });
    }
  });

  app.put('/api/ai/config', (req, res) => {
    const { denied, context } = requireAiAssistManage(req, res);
    if (denied) {
      return;
    }

    try {
      const actor = context?.account?.username || resolveActor(req);
      const payload = req.body?.config ?? req.body ?? {};
      const next = setAiConfig(payload, { actor });
      const safeConfig = buildAiConfigForClient(next);
      const cachingEnabled = next?.caching?.enabled !== false;
      const ttlMinutes = cachingEnabled
        ? toPositiveInt(next?.caching?.ttlMinutes, DEFAULT_AI_CONFIG.caching.ttlMinutes)
        : 0;
      const maxEntries = toPositiveInt(next?.caching?.maxEntries, AI_CACHE_LIMIT);
      const ttlMs = cachingEnabled && ttlMinutes ? ttlMinutes * 60 * 1000 : 0;
      if (cachingEnabled) {
        pruneAiCache(ttlMs, maxEntries);
      }
      res.json({ ok: true, config: safeConfig });
    } catch (err) {
      res.status(400).json({ ok: false, error: err?.message || 'Không thể cập nhật cấu hình AI' });
    }
  });

  app.post('/api/ai/providers/test', async (req, res) => {
    const { denied } = requireAiAssistManage(req, res);
    if (denied) {
      return;
    }

    const config = getAiConfig();
    let normalized = null;
    const rawProvider = req.body?.provider;

    try {
      normalized = normalizeProviderForDiagnostics(rawProvider, { configProviders: config?.providers });
      const probeResult = await runProviderProbe(normalized, {
        prompt: req.body?.prompt,
        timeoutMs: req.body?.timeoutMs,
      });
      res.json({
        ok: true,
        provider: { id: normalized.id, label: normalized.label, type: normalized.type },
        message: probeResult.message,
        usage: probeResult.usage,
      });
    } catch (err) {
      const errorDetail = buildErrorDetails(err);
      console.error('Kiểm thử nhà cung cấp AI thất bại', {
        providerId: normalized?.id || rawProvider?.id || 'unknown',
        type: normalized?.type || rawProvider?.type || 'unknown',
        error: errorDetail,
        cause: err?.cause || null,
      });
      const status = Number.isInteger(err?.statusCode)
        ? err.statusCode
        : Number.isInteger(err?.status)
          ? err.status
          : 400;
      res.status(status >= 400 ? status : 400).json({ ok: false, error: errorDetail });
    }
  });

  app.post('/api/ai/providers/ping', async (req, res) => {
    const { denied } = requireAiAssistManage(req, res);
    if (denied) {
      return;
    }

    const config = getAiConfig();
    const providers = Array.isArray(config?.providers) ? config.providers : [];
    const requestedId = `${req.body?.providerId || ''}`.trim();
    let selectedProvider = null;
    let normalized = null;

    try {
      if (requestedId) {
        const matched = providers.find((entry) => entry?.id === requestedId);
        if (!matched || matched.enabled === false) {
          res.status(404).json({ ok: false, error: 'Chưa tìm thấy nhà cung cấp AI khả dụng.' });
          return;
        }
        selectedProvider = matched;
      } else {
        selectedProvider = selectAiProvider(config);
        if (!selectedProvider) {
          res.status(404).json({ ok: false, error: 'Chưa tìm thấy nhà cung cấp AI khả dụng.' });
          return;
        }
      }

      normalized = normalizeProviderForDiagnostics(selectedProvider, {
        configProviders: config?.providers,
        fallbackSuffix: '',
      });
      const probeResult = await runProviderProbe(normalized, {
        prompt: req.body?.prompt,
        timeoutMs: req.body?.timeoutMs,
      });

      res.json({
        ok: true,
        provider: { id: normalized.id, label: normalized.label, type: normalized.type },
        message: probeResult.message,
        usage: probeResult.usage,
      });
    } catch (err) {
      const errorDetail = buildErrorDetails(err);
      console.error('Ping kết nối trợ lý AI thất bại', {
        providerId: normalized?.id || selectedProvider?.id || req.body?.providerId || 'unknown',
        type: normalized?.type || selectedProvider?.type || 'unknown',
        error: errorDetail,
        cause: err?.cause || null,
      });
      const status = Number.isInteger(err?.statusCode)
        ? err.statusCode
        : Number.isInteger(err?.status)
          ? err.status
          : 500;
      res.status(status >= 400 ? status : 500).json({ ok: false, error: errorDetail });
    }
  });

  app.delete('/api/ai/cache', (req, res) => {
    const { denied, context } = requireAiAssistManage(req, res);
    if (denied) {
      return;
    }

    try {
      const actor = context?.account?.username || resolveActor(req);
      clearAiCache({ actor });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || 'Không thể xóa cache AI' });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    const { denied, context } = requireAiAssistUsage(req, res);
    if (denied) {
      return;
    }

    const actor = context?.account?.username || resolveActor(req);

    try {
      const config = getAiConfig();
      if (config?.enabled === false) {
        res.status(503).json({ ok: false, error: 'Tính năng trợ lý AI đang tạm tắt.' });
        return;
      }

      const rawPrompt = req.body?.prompt ?? '';
      const prompt = `${rawPrompt}`.trim();
      if (!prompt) {
        res.status(400).json({ ok: false, error: 'Nội dung câu hỏi trống.' });
        return;
      }

      const scope = `${req.body?.scope || 'general'}`.trim() || 'general';
      const provider = selectAiProvider(config, req.body?.providerId);
      if (!provider) {
        res.status(503).json({ ok: false, error: 'Chưa tìm thấy nhà cung cấp AI khả dụng.' });
        return;
      }

      const contextTextRaw = req.body?.context ?? '';
      const truncatedPrompt = truncateText(prompt, config.maxInputLength);
      const contextText = truncateText(`${contextTextRaw || ''}`, config.maxInputLength);
      const cachingEnabled = config?.caching?.enabled !== false;
      const ttlMinutes = cachingEnabled
        ? toPositiveInt(config?.caching?.ttlMinutes, DEFAULT_AI_CONFIG.caching.ttlMinutes)
        : 0;
      const maxEntries = toPositiveInt(config?.caching?.maxEntries, AI_CACHE_LIMIT);
      const ttlMs = cachingEnabled && ttlMinutes ? ttlMinutes * 60 * 1000 : 0;
      const cacheKey = computeAiCacheKey({ providerId: provider.id, prompt: truncatedPrompt, scope, context: contextText });

      let cacheSnapshot = { version: 1, entries: [] };
      if (cachingEnabled) {
        cacheSnapshot = pruneAiCache(ttlMs, maxEntries).cache;
        const cached = cacheSnapshot.entries.find((entry) => entry.key === cacheKey);
        if (cached) {
          pushAuditLog({
            actor,
            action: 'ai.chat',
            detail: `Sử dụng cache trợ lý AI (${provider.id}) cho scope ${scope}`,
          });
          res.json({
            ok: true,
            cached: true,
            message: cached.response,
            usage: cached.usage || null,
            providerId: cached.providerId,
            scope,
            cacheKey,
          });
          return;
        }
      }

      const messages = [];
      const systemPrompt = buildSystemPrompt(config.systemPrompt, req.body?.systemPrompt);
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      if (contextText) {
        messages.push({ role: 'system', content: `Ngữ cảnh bổ sung:\n${contextText}` });
      }
      messages.push({ role: 'user', content: truncatedPrompt });

      const signal = buildAbortSignal(config.timeoutMs);
      const temperature = toFiniteNumber(provider.temperature, config.temperature);
      const maxTokens = toPositiveInt(provider.maxTokens, config.maxTokens);
      const result = await dispatchAiChat(provider, { messages, temperature, maxTokens }, { signal });
      const usage = normalizeAiUsage(result.usage, truncatedPrompt, result.message);

      if (cachingEnabled) {
        storeAiCacheEntry(
          {
            key: cacheKey,
            providerId: provider.id,
            scope,
            prompt: truncatedPrompt,
            response: result.message,
            context: contextText,
            usage,
            actor,
            tokensEstimated: usage?.totalTokens ?? null,
          },
          { actor, ttlMs, maxEntries },
        );
      }

      pushAuditLog({
        actor,
        action: 'ai.chat',
        detail: `Gọi trợ lý AI (${provider.id}) cho scope ${scope}`,
      });
      res.json({
        ok: true,
        cached: false,
        message: result.message,
        usage,
        providerId: provider.id,
        scope,
        cacheKey,
      });
    } catch (err) {
      console.error('Lỗi AI chat', err);
      const status = err?.name === 'AbortError' ? 504 : 502;
      res.status(status).json({ ok: false, error: err?.message || 'Không thể gọi trợ lý AI' });
    }
  });
}

function summarizeAiCacheEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return {
    total: list.length,
    latest:
      list.length > 0
        ? list
            .slice(0, 5)
            .map((entry) => ({
              key: entry.key,
              providerId: entry.providerId,
              scope: entry.scope,
              cachedAt: entry.cachedAt,
              expiresAt: entry.expiresAt,
              hits: Number(entry.hits || 0),
              lastHitAt: entry.lastHitAt || null,
            }))
        : [],
  };
}
