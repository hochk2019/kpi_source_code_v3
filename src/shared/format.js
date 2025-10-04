// Shared date formatting helpers

export function formatDisplayDate(input) {
  if (input === null || input === undefined) return "";
  const raw = String(input).trim();
  if (!raw) return "";

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    return `${day}/${month}/${year}`;
  }

  const slashMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (slashMatch) {
    const first = slashMatch[1].padStart(2, "0");
    const second = slashMatch[2].padStart(2, "0");
    const third = slashMatch[3];
    if (third.length === 2) {
      const numeric = Number(third);
      const yearPrefix = Number.isFinite(numeric) && numeric >= 70 ? "19" : "20";
      return `${first}/${second}/${yearPrefix}${third}`;
    }
    return `${first}/${second}/${third}`;
  }

  try {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = String(date.getFullYear());
      return `${day}/${month}/${year}`;
    }
  } catch (err) {
    // ignore and fall through
  }

  return raw;
}

export function formatDateRangeLabel(range) {
  if (!range) return "";
  if (typeof range === "string") {
    return formatDisplayDate(range);
  }
  const from = formatDisplayDate(range.from ?? "");
  const to = formatDisplayDate(range.to ?? "");
  if (from && to) {
    if (from === to) return from;
    return `${from} -> ${to}`;
  }
  return from || to;
}
