import { createProviderConfig, readEnv } from './utils.js';



export function createQwenProvider(env = process.env) {

  return createProviderConfig(

    {

      id: 'qwen-plus',

      type: 'qwen',

      label: 'Alibaba Qwen Plus',

      apiKeyEnv: 'QWEN_API_KEY',

      temperature: 0.2,

      maxTokens: 2048,

      enabled: false,

    },

    {

      endpoint: readEnv(env, 'QWEN_ENDPOINT', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),

      model: readEnv(env, 'QWEN_MODEL', 'qwen-plus'),

    },

  );

}

