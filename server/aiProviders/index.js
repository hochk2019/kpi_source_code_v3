import { createAnthropicProvider } from "./anthropic.js";

import { createAzureProvider } from "./azure.js";

import { createBaiduProvider } from "./baidu.js";

import { createDeepseekProvider } from "./deepseek.js";

import { createGoogleAiStudioProvider } from "./googleAiStudio.js";

import { createOllamaProvider } from "./ollama.js";

import { createOpenAiProvider } from "./openai.js";

import { createQwenProvider } from "./qwen.js";

import { createZaiProvider } from "./zai.js";

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

  return {
    defaultProviderId: "ollama-local",

    fallbackProviderId: "azure-openai",

    providers,
  };
}
