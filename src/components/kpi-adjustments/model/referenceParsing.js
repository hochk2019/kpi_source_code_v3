import { normalizeStr } from "@/lib/store.js";

export function parseReferences(text) {
  if (!text) return [];

  const raw = text
    .split(/[\n,;]+/)
    .map((item) => normalizeStr(item))
    .filter(Boolean);

  return Array.from(new Set(raw));
}
