import { createProviderConfig, readEnv } from "./utils.js";

const DEFAULT_ENDPOINT =
  "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions";

export function createBaiduProvider(env = process.env) {
  return createProviderConfig(
    {
      id: "baidu-ernie",

      type: "baidu",

      label: "Baidu Qianfan ERNIE Speed",

      apiKeyEnv: "BAIDU_QIANFAN_ACCESS_TOKEN",

      temperature: 0.2,

      maxTokens: 1024,

      enabled: false,
    },

    {
      endpoint: readEnv(env, "BAIDU_QIANFAN_ENDPOINT", DEFAULT_ENDPOINT),

      model: readEnv(env, "BAIDU_QIANFAN_MODEL", "ernie-speed-128k"),
    },
  );
}
