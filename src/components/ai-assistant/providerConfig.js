export function resolveProviderLabel(profile, config, providerId) {
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

export function resolveProviderDetails(profile, config, providerId) {
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

export function isOllamaProvider(provider) {
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

export function resolveProviderHealth(testState) {
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

export function createDraftFromConfig(config) {
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
