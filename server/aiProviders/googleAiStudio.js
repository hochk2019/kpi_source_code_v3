import { createProviderConfig, readEnv } from "./utils.js";

export function createGoogleAiStudioProvider(env = process.env) {
  return createProviderConfig(
    {
      id: "google-ai-studio",

      type: "google-ai-studio",

      label: "Google AI Studio (Gemini 1.5 Flash)",

      apiKeyEnv: "GOOGLE_AI_STUDIO_API_KEY",

      temperature: 0.3,

      maxTokens: 1024,

      enabled: false,
    },

    {
      endpoint: readEnv(
        env,
        "GOOGLE_AI_STUDIO_ENDPOINT",
        "https://generativelanguage.googleapis.com",
      ),

      model: readEnv(env, "GOOGLE_AI_STUDIO_MODEL", "gemini-1.5-flash"),
    },
  );
}
