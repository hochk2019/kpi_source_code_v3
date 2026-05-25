export function readEnv(env, key, defaultValue = '') {

  const source = env && typeof env[key] !== 'undefined' && env[key] !== null ? env[key] : defaultValue;

  const value = typeof source === 'string' ? source.trim() : `${source}`.trim();

  if (value) {

    return value;

  }

  return defaultValue;

}



export function createProviderConfig(base, overrides = {}) {

  return { ...base, ...overrides };

}

