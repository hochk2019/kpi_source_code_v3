export function safeParse(json, fallback) {
  try {
    const value = JSON.parse(json);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function normalizeStr(value) {
  return (value ?? "").toString().replace(/\s+/g, " ").trim();
}

export function stripDiacritics(input) {
  return normalizeStr(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function normalizeName(name) {
  return stripDiacritics(name).toLowerCase();
}

export function normalizeMST(mst) {
  return (mst ?? "").toString().replace(/\D/g, "");
}

export function normalizeDeclarationNumber(input, length = 11) {
  const raw = (input ?? "").toString();
  if (!raw.trim()) return "";

  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";

  const targetLength = Number.isFinite(length) && length > 0 ? Math.floor(length) : 11;
  if (digits.length < targetLength) {
    return digits.padStart(targetLength, "0");
  }
  if (digits.length > targetLength) {
    return digits.slice(0, targetLength);
  }

  return digits;
}
