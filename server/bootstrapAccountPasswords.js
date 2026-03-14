import process from 'node:process';

const BOOTSTRAP_PASSWORD_ENV_PREFIX = 'KPI_BOOTSTRAP_PASSWORD_';

const BOOTSTRAP_PASSWORD_ENV_ALIASES = Object.freeze({
  admin: ['KPI_BOOTSTRAP_ADMIN_PASSWORD'],
});

function normalizeUsernameKey(usernameInput) {
  return `${usernameInput ?? ''}`.trim().toLowerCase();
}

export function normalizeBootstrapPasswordEnvSegment(usernameInput) {
  return normalizeUsernameKey(usernameInput)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function listBootstrapPasswordEnvKeys(usernameInput) {
  const usernameKey = normalizeUsernameKey(usernameInput);
  const segment = normalizeBootstrapPasswordEnvSegment(usernameInput);
  const keys = [];
  if (usernameKey && Array.isArray(BOOTSTRAP_PASSWORD_ENV_ALIASES[usernameKey])) {
    keys.push(...BOOTSTRAP_PASSWORD_ENV_ALIASES[usernameKey]);
  }
  if (segment) {
    const genericKey = `${BOOTSTRAP_PASSWORD_ENV_PREFIX}${segment}`;
    if (!keys.includes(genericKey)) {
      keys.push(genericKey);
    }
  }
  return keys;
}

export function getBootstrapPasswordEnvKey(usernameInput) {
  return listBootstrapPasswordEnvKeys(usernameInput)[0] || '';
}

export function readBootstrapAccountPassword(usernameInput, env = process.env) {
  for (const key of listBootstrapPasswordEnvKeys(usernameInput)) {
    const raw = env?.[key];
    const value = `${raw ?? ''}`.trim();
    if (value) {
      return value;
    }
  }
  return '';
}
