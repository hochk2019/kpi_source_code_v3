export function formatDateOnly(value) {
  if (!value) return "";

  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return "";

  try {
    return new Date(ts).toLocaleDateString("vi-VN");
  } catch {
    return "";
  }
}

export function formatInt(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString("vi-VN") : "0";
}

export function formatDecimal(value) {
  const num = Number(value || 0);
  return Number.isFinite(num)
    ? num.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0,0";
}
