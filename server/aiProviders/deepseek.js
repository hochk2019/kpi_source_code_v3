import { createProviderConfig, readEnv } from "./utils.js";

export function createDeepseekProvider(env = process.env) {
  return createProviderConfig(
    {
      id: "deepseek-chat",

      type: "deepseek",

      label: "DeepSeek Chat (V3)",

      apiKeyEnv: "DEEPSEEK_API_KEY",

      temperature: 0.2,

      maxTokens: 2048,

      enabled: false,
    },

    {
      endpoint: readEnv(env, "DEEPSEEK_ENDPOINT", "https://api.deepseek.com/v1"),

      model: readEnv(env, "DEEPSEEK_MODEL", "deepseek-chat"),
    },
  );
}
