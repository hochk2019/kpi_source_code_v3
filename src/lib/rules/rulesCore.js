// rulesCore.js
// Core rule management - CRUD operations for rule sets

import { pushAuditLog } from '../auditLog.js';
import { getItem, setItem } from '../storageClient.js';

const RULES_KEY = "kpi_rules_v2";

function clone(obj) {
  return JSON.parse(JSON.stringify(obj ?? null));
}

function normText(value) {
  return String(value ?? "").trim();
}

function generateRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadRules() {
  try {
    const raw = getItem(RULES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function persistRules(rules, actor = "system") {
  const toSave = rules && typeof rules === "object" ? rules : {};
  setItem(RULES_KEY, JSON.stringify(toSave));
  pushAuditLog({
    actor,
    action: "rules.save",
    detail: "Lưu cấu hình quy tắc KPI",
    meta: { ruleCount: toSave.sets?.length || 0 },
  });
  return toSave;
}

export function getActiveRuleSet(rules) {
  if (!rules?.sets?.length) return null;
  const activeId = rules.activeId;
  if (activeId) {
    const found = rules.sets.find((s) => s.id === activeId);
    if (found) return found;
  }
  return rules.sets[0] || null;
}

export function createRuleSet(collection, name, actor = "system") {
  const newSet = {
    id: generateRuleId(),
    name: normText(name) || "Bộ quy tắc mới",
    rules: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updated = {
    ...clone(collection),
    sets: [...(collection.sets || []), newSet],
    activeId: newSet.id,
  };
  persistRules(updated, actor);
  pushAuditLog({
    actor,
    action: "rules.create",
    detail: `Tạo bộ quy tắc ${newSet.name}`,
    meta: { ruleId: newSet.id },
  });
  return clone(updated);
}

export function updateRuleSet(collection, ruleId, updates, actor = "system") {
  const idx = collection.sets?.findIndex((s) => s.id === ruleId);
  if (idx < 0) return clone(collection);
  const updated = clone(collection);
  updated.sets[idx] = {
    ...updated.sets[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  persistRules(updated, actor);
  return updated;
}

export function deleteRuleSet(collection, ruleId, actor = "system") {
  const normalizedId = normText(ruleId);
  if (!normalizedId) throw new Error("Thiếu mã bộ quy tắc cần xóa");
  if (collection.sets.length <= 1) {
    throw new Error("Không thể xóa bộ quy tắc cuối cùng");
  }
  const idx = collection.sets.findIndex((entry) => entry.id === normalizedId);
  if (idx < 0) return clone(collection);
  const [removed] = collection.sets.splice(idx, 1);
  if (!collection.sets.length) {
    throw new Error("Không thể xóa toàn bộ bộ quy tắc");
  }
  if (collection.activeId === normalizedId) {
    collection.activeId = collection.sets[0]?.id || collection.activeId;
  }
  const persisted = persistRules(collection, actor);
  pushAuditLog({
    actor,
    action: "rules.delete",
    detail: removed ? `Xóa bộ quy tắc ${removed.name}` : "Xóa bộ quy tắc",
    meta: { ruleId: normalizedId },
  });
  return clone(persisted);
}

export function setActiveRuleSet(collection, ruleId) {
  const exists = collection.sets?.some((s) => s.id === ruleId);
  if (!exists) return clone(collection);
  return {
    ...clone(collection),
    activeId: ruleId,
  };
}
