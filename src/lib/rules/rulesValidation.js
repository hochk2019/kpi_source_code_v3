// rulesValidation.js
// Rule validation and sanitization utilities

const MIN_TIER_ADD = 0;
const MAX_TIER_ADD = 1000000;
const MAX_TIERS = 50;

export function validateTier(tier) {
  const errors = [];
  const { from, to, add } = tier || {};
  const fromNum = Number(from);
  const toNum = Number(to);
  const addNum = Number(add);

  if (!Number.isFinite(fromNum) || fromNum < 0) {
    errors.push("Giá trị 'từ' không hợp lệ");
  }
  if (!Number.isFinite(toNum) || toNum < fromNum) {
    errors.push("Giá trị 'đến' phải lớn hơn hoặc bằng 'từ'");
  }
  if (!Number.isFinite(addNum) || addNum < MIN_TIER_ADD || addNum > MAX_TIER_ADD) {
    errors.push(`Giá trị thêm phải từ ${MIN_TIER_ADD} đến ${MAX_TIER_ADD}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      from: Math.max(0, Math.floor(fromNum)),
      to: Math.max(0, Math.floor(toNum)),
      add: Math.max(0, Math.min(addNum, MAX_TIER_ADD)),
    },
  };
}

export function validateRuleSet(ruleSet) {
  const errors = [];
  if (!ruleSet || typeof ruleSet !== "object") {
    errors.push("Bộ quy tắc không hợp lệ");
    return { valid: false, errors };
  }
  if (!ruleSet.name || typeof ruleSet.name !== "string") {
    errors.push("Thiếu tên bộ quy tắc");
  }
  const importTiers = ruleSet.rules?.import?.tiers || [];
  const exportTiers = ruleSet.rules?.export?.tiers || [];
  if (importTiers.length > MAX_TIERS) {
    errors.push(`Số tầng nhập khẩu vượt quá giới hạn ${MAX_TIERS}`);
  }
  if (exportTiers.length > MAX_TIERS) {
    errors.push(`Số tầng xuất khẩu vượt quá giới hạn ${MAX_TIERS}`);
  }
  return { valid: errors.length === 0, errors };
}

export function sanitizeRuleSetName(name) {
  const trimmed = String(name ?? "").trim();
  return trimmed.slice(0, 100) || "Bộ quy tắc mới";
}

export function sanitizeTierValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

export function isValidRuleId(id) {
  if (!id || typeof id !== "string") return false;
  return id.startsWith("rule_") && id.length > 10;
}

export default {
  validateTier,
  validateRuleSet,
  sanitizeRuleSetName,
  sanitizeTierValue,
  isValidRuleId,
  MIN_TIER_ADD,
  MAX_TIER_ADD,
  MAX_TIERS,
};
