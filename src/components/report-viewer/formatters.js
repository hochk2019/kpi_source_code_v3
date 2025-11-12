export function formatInt(value) {
  const num = Number(value || 0);
  return num.toLocaleString("vi-VN");
}

export function formatDecimal(value) {
  const num = Number(value || 0);
  return num.toLocaleString("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatOptionalDecimal(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || Math.abs(num) < 0.0001) {
    return "—";
  }
  return formatDecimal(num);
}

export function formatOptionalInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return "—";
  }
  return formatInt(num);
}
