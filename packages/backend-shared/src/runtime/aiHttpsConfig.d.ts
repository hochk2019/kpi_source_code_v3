export interface AiHttpsConfigDisabled {
  enabled: false;
  reason: string;
  keyPath: string;
  certPath: string;
}

export interface AiHttpsConfigEnabled {
  enabled: true;
  host: string;
  port: number;
  keyPath: string;
  certPath: string;
  caPath: string | null;
  tlsOptions: {
    key: Buffer;
    cert: Buffer;
    passphrase?: string;
    ca?: Buffer;
  };
}

export type AiHttpsConfig = AiHttpsConfigDisabled | AiHttpsConfigEnabled;

export function loadAiHttpsConfig(options?: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): AiHttpsConfig;
