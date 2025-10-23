import { createProviderConfig, readEnv } from "./utils.js";

export function createZaiProvider(env = process.env) {
  return createProviderConfig(
    {
      id: "zai-chat",

      type: "zai",

      label: "Z.AI Chat Pro",

      apiKeyEnv: "ZAI_API_KEY",

      temperature: 0.2,

      maxTokens: 2048,

      enabled: false,
    },

    {
      endpoint: readEnv(env, "ZAI_ENDPOINT", "https://api.z-ai.com/v1"),

      model: readEnv(env, "ZAI_MODEL", "zai-chat-pro"),
    },
  );
}
