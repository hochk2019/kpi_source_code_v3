export function normalizeStr(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }

  return '';
}

export function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function slugify(value: string, fallback = 'item'): string {
  const base = stripDiacritics(normalizeStr(value)) || fallback;
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

export function normalizeMst(value: unknown): string {
  return normalizeStr(value).replace(/\D/g, '');
}

export function normalizeDeclarationNumber(value: unknown, { length = 11 }: { length?: number } = {}): string {
  const raw = normalizeStr(value);
  if (!raw) {
    return '';
  }

  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) {
    return '';
  }

  const targetLength = Number.isFinite(length) && length > 0 ? Math.floor(length) : 11;
  if (digitsOnly.length < targetLength) {
    return digitsOnly.padStart(targetLength, '0');
  }

  if (digitsOnly.length > targetLength) {
    return digitsOnly.slice(0, targetLength);
  }

  return digitsOnly;
}

export function toIsoDate(value: unknown, options?: { preferMonthFirst?: boolean }): string {
  const raw = normalizeStr(value);
  if (!raw) {
    return '';
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${padDatePart(isoMatch[2])}-${padDatePart(isoMatch[3])}`;
  }

  const slashMatch = raw.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})(?:[ T].*)?$/);
  if (slashMatch) {
    const [, first, second, third] = slashMatch;

    if (first.length === 4) {
      return `${first}-${padDatePart(second)}-${padDatePart(third)}`;
    }

    const firstNum = Number.parseInt(first, 10);
    const secondNum = Number.parseInt(second, 10);
    const year = normalizeYearPart(third);
    if (!year) {
      return '';
    }

    let day: number;
    let month: number;
    let dayStr: string;
    let monthStr: string;

    if (options?.preferMonthFirst && firstNum >= 1 && firstNum <= 12) {
      month = firstNum;
      monthStr = first;
      day = secondNum;
      dayStr = second;
    } else {
      day = firstNum;
      dayStr = first;
      month = secondNum;
      monthStr = second;
    }

    if (!Number.isFinite(day) || day < 1 || day > 31) {
      return '';
    }

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return '';
    }

    return `${year}-${padDatePart(monthStr)}-${padDatePart(dayStr)}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

function padDatePart(value: string): string {
  return String(value).padStart(2, '0');
}

function normalizeYearPart(value: string): string {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return '';
  }

  if (value.length === 2) {
    return String(parsed >= 70 ? 1900 + parsed : 2000 + parsed);
  }

  return String(parsed).padStart(4, '0');
}
