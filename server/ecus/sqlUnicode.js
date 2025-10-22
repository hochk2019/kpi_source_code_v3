/* eslint-disable no-control-regex */

const NULL_CHAR_REGEX = /\u0000+/gu;



function normalizeBufferString(buffer) {

  if (!Buffer.isBuffer(buffer)) {

    return "";

  }

  if (buffer.length === 0) {

    return "";

  }

  try {

    return buffer.toString("utf16le");

  } catch {

    try {

      return buffer.toString("utf8");

    } catch {

      return "";

    }

  }

}



export function normalizeSqlUnicodeValue(value) {

  if (value === null || value === undefined) {

    return value;

  }

  if (typeof value === "string") {

    return value.replace(NULL_CHAR_REGEX, "").normalize("NFC");

  }

  if (Buffer.isBuffer(value)) {

    const decoded = normalizeBufferString(value);

    return decoded.replace(NULL_CHAR_REGEX, "").normalize("NFC");

  }

  if (Array.isArray(value)) {

    return value.map((entry) => normalizeSqlUnicodeValue(entry));

  }

  if (value instanceof Date) {

    return value;

  }

  if (value && typeof value === "object") {

    return normalizeSqlUnicodeRecord(value);

  }

  return value;

}



export function normalizeSqlUnicodeRecord(record) {

  if (!record || typeof record !== "object") {

    return record;

  }

  if (record instanceof Date) {

    return record;

  }

  const normalized = Array.isArray(record) ? [] : {};

  for (const [key, raw] of Object.entries(record)) {

    normalized[key] = normalizeSqlUnicodeValue(raw);

  }

  return normalized;

}

