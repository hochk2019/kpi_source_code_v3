import { createAnthropicProvider } from './anthropic.js';
import { createAzureProvider } from './azure.js';
import { createBaiduProvider } from './baidu.js';
import { createDeepseekProvider } from './deepseek.js';
import { createGoogleAiStudioProvider } from './googleAiStudio.js';
import { createOllamaProvider } from './ollama.js';
import { createOpenAiProvider } from './openai.js';
import { createQwenProvider } from './qwen.js';
import { createZaiProvider } from './zai.js';


function toTrimmedString(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === undefined || value === null) {
    return '';
  }
  return `${value}`.trim();
}


function hasNonEmptyValue(value) {
  return toTrimmedString(value).length > 0;
}


function readEnvValue(env, key) {
  const normalizedKey = toTrimmedString(key);
  if (!normalizedKey) {
    return '';
  }
  return toTrimmedString(env?.[normalizedKey]);
}


function isProviderEligible(provider, env) {
  if (!provider || typeof provider !== 'object') {
    return false;
  }
  if (provider.enabled === false) {
    return false;
  }
  const type = toTrimmedString(provider.type);
  if (!hasNonEmptyValue(provider.id)) {
    return false;
  }
  if (type === 'ollama') {
    return hasNonEmptyValue(provider.endpoint) && hasNonEmptyValue(provider.model);
  }
  if (hasNonEmptyValue(provider.apiKey)) {
    if (type === 'azure') {
      return hasNonEmptyValue(provider.endpoint) && hasNonEmptyValue(provider.deployment);
    }
    return true;
  }
  const apiKeyFromEnv = readEnvValue(env, provider.apiKeyEnv);
  if (!hasNonEmptyValue(apiKeyFromEnv)) {
    return false;
  }
  if (type === 'azure') {
    return hasNonEmptyValue(provider.endpoint) && hasNonEmptyValue(provider.deployment);
  }
  return true;
}


export function detectDefaultAiProvider(providers = [], env = process.env) {
  if (!Array.isArray(providers) || providers.length === 0) {
    return { defaultProviderId: null, fallbackProviderId: null };
  }
  const eligibleProviders = providers
    .map((provider, index) => ({
      provider,
      index,
      id: toTrimmedString(provider?.id),
    }))
    .filter((entry) => entry.id)
    .filter((entry) => isProviderEligible(entry.provider, env))
    .sort((a, b) => a.index - b.index);
  const defaultProviderId = eligibleProviders[0]?.id || null;
  const fallbackProviderId = eligibleProviders[1]?.id || null;
  return { defaultProviderId, fallbackProviderId };
}


export function buildDefaultAiProviders(env = process.env) {
  const providers = [
    createAzureProvider(env),
    createOllamaProvider(env),
    createGoogleAiStudioProvider(env),
    createOpenAiProvider(),
    createAnthropicProvider(),
    createDeepseekProvider(env),
    createQwenProvider(env),
    createBaiduProvider(env),
    createZaiProvider(env),
  ];

  const { defaultProviderId, fallbackProviderId } = detectDefaultAiProvider(providers, env);

  return {
    defaultProviderId,
    fallbackProviderId,
    providers,
  };
}
