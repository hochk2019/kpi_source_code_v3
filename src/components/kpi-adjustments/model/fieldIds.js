export function normalizeFieldSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildSettingsFieldId(category, suffix) {
  return `kpi-setting-${normalizeFieldSegment(category)}-${normalizeFieldSegment(suffix)}`;
}

export function buildLicenseFieldId(category, code) {
  return `kpi-setting-${normalizeFieldSegment(category)}-license-${normalizeFieldSegment(code)}`;
}
