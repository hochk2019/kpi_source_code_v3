import fs from "node:fs";

import path from "node:path";

import process from "node:process";

function toBooleanFlag(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const text = `${value ?? ""}`.trim().toLowerCase();

  if (!text) {
    return defaultValue;
  }

  if (["1", "true", "yes", "y", "on", "enabled"].includes(text)) {
    return true;
  }

  if (["0", "false", "no", "n", "off", "disabled"].includes(text)) {
    return false;
  }

  return defaultValue;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function resolveDefaultPath(fileName) {
  return path.resolve(process.cwd(), "config", fileName);
}

function readFileIfExists(filePath) {
  if (!filePath) {
    return null;
  }

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath);
  } catch (err) {
    const error = new Error(`Không thể đọc file TLS: ${filePath}`);

    error.cause = err;

    throw error;
  }
}

export function loadAiHttpsConfig({ env = process.env } = {}) {
  const enabledFlag = toBooleanFlag(env.KPI_AI_HTTPS_ENABLED, undefined);

  const keyPath = `${env.KPI_AI_HTTPS_KEY_PATH || ""}`.trim() || resolveDefaultPath("ai-https.key");

  const certPath =
    `${env.KPI_AI_HTTPS_CERT_PATH || ""}`.trim() || resolveDefaultPath("ai-https.crt");

  const caPath = `${env.KPI_AI_HTTPS_CA_PATH || ""}`.trim() || "";

  const passphrase = `${env.KPI_AI_HTTPS_PASSPHRASE || ""}`.trim() || undefined;

  const key = readFileIfExists(keyPath);

  const cert = readFileIfExists(certPath);

  const ca = readFileIfExists(caPath);

  const hasBundle = Boolean(key && cert);

  const enabled = enabledFlag === undefined ? hasBundle : enabledFlag;

  if (!enabled || !hasBundle) {
    return {
      enabled: false,

      reason: hasBundle ? "Chưa bật KPI_AI_HTTPS_ENABLED" : "Thiếu file key/cert",

      keyPath,

      certPath,
    };
  }

  const host = `${env.KPI_AI_HTTPS_HOST || ""}`.trim() || "127.0.0.1";

  const port = toPositiveInt(env.KPI_AI_HTTPS_PORT, 5443);

  const tlsOptions = { key, cert };

  if (passphrase) {
    tlsOptions.passphrase = passphrase;
  }

  if (ca) {
    tlsOptions.ca = ca;
  }

  return {
    enabled: true,

    host,

    port,

    keyPath,

    certPath,

    caPath: caPath || null,

    tlsOptions,
  };
}
