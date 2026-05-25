export const COMPANY_NAME_WRAP_THRESHOLD = 25;
export const COMPANY_NAME_WARNING_THRESHOLD = 60;

const COMPANY_NAME_SUSPICIOUS_CHARACTER_PATTERN = /[<>{}[\]|^~`]/g;

export const shouldWrapCompanyName = (value = "") => {
  if (value == null) {
    return false;
  }

  const raw = value.toString();
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }

  return Array.from(trimmed).length >= COMPANY_NAME_WRAP_THRESHOLD;
};

export const sanitizeCompanyNameInput = (value = "") => {
  if (value == null) {
    return "";
  }

  if (typeof value !== "string") {
    return value.toString();
  }

  return value.replace(/\r?\n|\r/g, " ");
};

export const getCompanyNameWarnings = (value = "") => {
  const sanitized = sanitizeCompanyNameInput(value);
  const trimmed = sanitized.trim();
  if (!trimmed) {
    return [];
  }

  const warnings = [];
  const length = Array.from(trimmed).length;
  if (length >= COMPANY_NAME_WARNING_THRESHOLD) {
    warnings.push({
      code: "too-long",
      message: `Tên công ty dài ${length} ký tự. Nên kiểm tra lại để tránh dán thừa mô tả hoặc ghi chú nội bộ.`,
    });
  }

  const suspiciousCharacters = Array.from(
    new Set(trimmed.match(COMPANY_NAME_SUSPICIOUS_CHARACTER_PATTERN) || []),
  );
  if (suspiciousCharacters.length) {
    warnings.push({
      code: "suspicious-characters",
      message: `Tên công ty chứa ký tự cần kiểm tra lại: ${suspiciousCharacters.join(" ")}`,
    });
  }

  return warnings;
};
