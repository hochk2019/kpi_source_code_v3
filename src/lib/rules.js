// src/lib/rules.js
// --------------------------------------------------
// QUY TẮC KPI + TÍNH KPI THEO NHÓM & BẬC (CÓ LỊCH SỬ)
// - Hỗ trợ cộng dồn cho Nhóm 3&4 (1–10 là base, +0.5 cho 11–20, 21–30, 31–40, 41–50)
// - Cho phép cấu hình bậc cho Nhóm 1 và Nhóm 2 (mặc định đúng “chuẩn cũ”)
// - Loại trừ giấy phép (vd: ZN02, HDGC) áp dụng cho 6 cặp cột “Mã/Số giấy phép (0→5)”
// - “Áp dụng từ ngày…”: lưu phiên bản quy tắc và tính lại KPI từ ngày đó trở đi
// --------------------------------------------------

import {
  getData,
  setData,
  RULES_KEY,
  getRules as readPersistedRules,
  setRules as persistRules,
  pushAuditLog,
} from './store.js';
import { getItem as getStorageItem, setItem as setStorageItem } from './storageClient.js';
import { DEFAULT_RULES } from '@/shared/defaultRules.js';
export { DEFAULT_RULES } from '@/shared/defaultRules.js';

// ====== LƯU / TẢI QUY TẮC (CÓ LỊCH SỬ) ======
const KEY_HISTORY = 'kpi_rules_history';   // mảng phiên bản đã lưu
const LEGACY_KEY_ACTIVE = 'kpi_rules';

function clone(obj) {
  return JSON.parse(JSON.stringify(obj ?? null));
}

function normalizeRulesData(raw) {
  const base = clone(DEFAULT_RULES);
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const next = clone({ ...base, ...raw });
  const rawGroups = raw.groups || {};
  next.groups = {
    group1: { ...base.groups.group1, ...(rawGroups.group1 || {}) },
    group2: { ...base.groups.group2, ...(rawGroups.group2 || {}) },
    group34: { ...base.groups.group34, ...(rawGroups.group34 || {}) },
  };
  next.license = { ...base.license, ...(raw.license || {}) };
  const rawBonuses = raw.bonuses || {};
  next.bonuses = {
    co: { ...base.bonuses.co, ...(rawBonuses.co || {}) },
  };
  next.name = raw.name || base.name;
  next.applyFrom = raw.applyFrom || '';
  next.updatedAt = raw.updatedAt || base.updatedAt;
  return next;
}

export function loadRules() {
  try {
    const stored = readPersistedRules();
    if (stored && stored.groups && stored.license) {
      return normalizeRulesData(stored);
    }
  } catch (err) {
    console.warn('loadRules: invalid data, fallback to default', err);
  }

  // Thử migrate từ khoá cũ nếu còn
  try {
    const legacy = JSON.parse(getStorageItem(LEGACY_KEY_ACTIVE) || 'null');
    if (legacy && legacy.groups && legacy.license) {
      const normalized = normalizeRulesData(legacy);
      persistRules(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn('loadRules: legacy data invalid, fallback to default', err);
  }
  // lần đầu: lưu mặc định
  const defaults = normalizeRulesData(DEFAULT_RULES);
  saveRules(defaults, { appendHistory: false });
  return defaults;
}

export function getRulesHistory() {
  try { return JSON.parse(getStorageItem(KEY_HISTORY) || '[]'); }
  catch (err) {
    console.warn('getRulesHistory: invalid data, reset history', err);
    return [];
  }
}

/**
 * Lưu quy tắc mới
 * @param {object} rules  - đối tượng quy tắc
 * @param {object} opts   - { appendHistory: true, recalcFrom: 'yyyy-mm-dd' | '' }
 */
export function saveRules(rules, opts = {}) {
  const cloned = normalizeRulesData(rules);
  cloned.updatedAt = new Date().toISOString();
  persistRules(cloned);
  // ghi thêm key cũ để tương thích với bản lưu trước
  setStorageItem(LEGACY_KEY_ACTIVE, JSON.stringify(cloned));

  if (opts.appendHistory !== false) {
    const hist = getRulesHistory();
    hist.unshift(cloned);
    while (hist.length > 20) hist.pop();
    setStorageItem(KEY_HISTORY, JSON.stringify(hist));
  }

  // Tính lại KPI nếu có yêu cầu
  if (opts.recalcFrom) {
    recalcKPIFrom(opts.recalcFrom, cloned);
  }

  const actor = opts.actor || 'system';
  const applyNote = cloned.applyFrom ? ` (áp dụng từ ${cloned.applyFrom || 'ngay'})` : '';
  pushAuditLog({
    actor,
    action: 'rules.save',
    detail: `Lưu quy tắc KPI${applyNote}`,
    meta: { recalcFrom: opts.recalcFrom || '' },
  });
}

// ====== TIỆN ÍCH: chuẩn hoá chuỗi mã LH & giấy phép ======
const norm = (s) => String(s || '').trim().toUpperCase();

function inCodes(code, arr) {
  const c = norm(code);
  return arr.some(x => norm(x) === c);
}

// ====== ĐẾM SỐ LOẠI GIẤY PHÉP (từ RAW ROW của ECUS5) ======
export function countLicenseTypesFromRowObj(row, excludeList = []) {
  const directCountFields = [
    'Số lượng GP',
    'So luong GP',
    'Số lượng giấy phép',
    'So luong giay phep',
  ];
  for (const field of directCountFields) {
    const raw = row?.[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const normalized = norm(raw);
    if (/^\d+(?:\.\d+)?$/.test(normalized)) {
      const numeric = Number(normalized);
      if (Number.isFinite(numeric)) {
        return Math.max(0, Math.round(numeric));
      }
    }
  }
  // cặp “Mã/Số giấy phép” chuẩn ECUS5: 0..5 (gốc + 1..5)
  const pairs = [
    ['Mã giấy phép', 'Số giấy phép'],
    ['Mã giấy phép 1', 'Số giấy phép 1'],
    ['Mã giấy phép 2', 'Số giấy phép 2'],
    ['Mã giấy phép 3', 'Số giấy phép 3'],
    ['Mã giấy phép 4', 'Số giấy phép 4'],
    ['Mã giấy phép 5', 'Số giấy phép 5'],
  ];
  const types = new Set();
  for (const [kCode, kNo] of pairs) {
    const code = norm(row?.[kCode]);
    const no = String(row?.[kNo] || '').trim();
    if (!code || !no) continue;            // phải có cả Mã & Số
    if (excludeList.some(ex => norm(ex) === code)) continue; // loại trừ
    types.add(code);                        // tính theo LOẠI (mã), không phải theo số giấy phép
  }
  return types.size;
}

// ====== TÍNH THÊM ĐIỂM THEO BẬC ======
function addByTiers(numItems, tiers = [], isCumulative = false) {
  if (!numItems || !tiers?.length) return 0;
  let sum = 0;
  for (const tier of tiers) {
    const { from, to, add } = tier;
    if (numItems >= from) {
      if (isCumulative) {
        // Cộng dồn từng bậc (dùng cho Nhóm 3&4 theo mặc định)
        sum += add;
      } else {
        // Không cộng dồn (chỉ lấy bậc khớp cao nhất)
        if (numItems <= to) { sum = add; }
        else { sum = add; } // > to: vẫn lấy add của bậc cuối cùng khớp
      }
    }
  }
  return sum;
}

// ====== XÁC ĐỊNH NHÓM CỦA 1 MÃ LOẠI HÌNH ======
function detectGroup(code, rules) {
  const g = rules.groups || {};
  const C = norm(code);
  if (inCodes(C, g.group1.codes)) return 'group1';
  if (inCodes(C, g.group2.codes)) return 'group2';
  if (inCodes(C, g.group34.codes)) return 'group34';
  return ''; // OTHER nếu muốn
}

// ====== TÍNH KPI CHO 1 BẢN GHI (row đã chuẩn hoá) ======
export function computeKPI(row, rulesInput) {
  const rules = rulesInput || loadRules();

  const code = norm(row?.loaiHinh);
  const items = Number(
    row?.num_items ?? row?.muc_hang ?? 0
  ) || 0;

  const gKey = detectGroup(code, rules);
  const g = rules.groups[gKey] || null;

  let point = 0;

  if (g) {
    // Base
    point += Number(g.base || 0);

    // Tiers
    const isCumulative = (gKey === 'group34'); // Nhóm 3&4 cộng dồn (chuẩn)
    point += addByTiers(items, g.tiers, isCumulative);
  }

  // Giấy phép
  const licCfg = rules.license || {};
  const exclude = (licCfg.excludeCodes || []).map(norm);

  // Nếu DataImporter đã trích sẵn “licenseCodes” -> dùng luôn;
  // nếu không, cố gắng đếm từ row.raw (nếu có gốc ECUS5), hoặc 0.
  let licenseTypes = 0;
  if (Array.isArray(row.licenseCodes)) {
    const s = new Set(
      row.licenseCodes
        .map(norm)
        .filter(c => c && !exclude.includes(c))
    );
    licenseTypes = s.size;
  } else if (row.__raw) {
    licenseTypes = countLicenseTypesFromRowObj(row.__raw, exclude);
  } else {
    // nếu importer đã set “licenses” là số loại thì dùng:
    licenseTypes = Number(row.licenses || 0) || 0;
  }

  // Giới hạn tối đa số loại tính điểm
  const maxTypes = Number(licCfg.maxTypes || 0) || 0;
  if (maxTypes > 0 && licenseTypes > maxTypes) licenseTypes = maxTypes;

  point += licenseTypes * Number(licCfg.perType || 0);

  const coBonus = rules?.bonuses?.co;
  if (coBonus?.enabled) {
    const hasCO = !!(row?.has_co || String(row?.co || '').trim().toLowerCase() === 'có');
    if (hasCO) {
      point += Number(coBonus.points || 0);
    }
  }

  return Math.max(0, Math.round(point * 10) / 10);
}

// ====== TÍNH LẠI KPI TỪ NGÀY X ======
export function recalcKPIFrom(fromYMD, rulesInput) {
  const rules = rulesInput || loadRules();
  const from = fromYMD ? new Date(fromYMD) : null;

  const data = getData();
  let changed = 0;

  for (const r of data) {
    const d = r?.date ? new Date(r.date) : null;
    if (!from || (d && d >= from)) {
      r.kpi = computeKPI(r, rules);
      r.updatedAt = new Date().toISOString();
      changed++;
    }
  }
  setData(data);
  return changed;
}
