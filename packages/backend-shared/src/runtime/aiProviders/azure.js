import { createProviderConfig, readEnv } from './utils.js';



export function createAzureProvider(env = process.env) {

  return createProviderConfig(

    {

      id: 'azure-openai',

      type: 'azure',

      label: 'Azure OpenAI GPT-4o mini',

      apiKeyEnv: 'AZURE_OPENAI_KEY',

      maxTokens: 4096,

      temperature: 0.2,

      enabled: true,

    },

    {

      endpoint: readEnv(env, 'AZURE_OPENAI_ENDPOINT', ''),

      deployment: readEnv(env, 'AZURE_OPENAI_DEPLOYMENT', 'gpt-4o-mini'),

      apiVersion: readEnv(env, 'AZURE_OPENAI_API_VERSION', '2024-08-01-preview'),

    },

  );

}

