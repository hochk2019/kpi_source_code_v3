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

// ====== CẤU HÌNH MẶC ĐỊNH ======
export const DEFAULT_RULES = {
  // Version metadata
  name: 'Rules v1',
  applyFrom: '',            // yyyy-mm-dd (rỗng = áp dụng ngay cho bản ghi mới)
  updatedAt: new Date().toISOString(),

  // Nhóm loại hình (có thể sửa trên UI)
  groups: {
    group1: {
      title: 'Nhóm 1',
      // “Chuẩn cũ”: E11, E15, E21, E31, E42, E52, E62, E82, H21
      codes: 'E11,E15,E21,E31,E42,E52,E62,E82,H21'.split(','),
      base: 1,
      // Cho phép chỉnh bậc như nhóm 3&4 nếu muốn (mặc định để trống = không cộng bậc)
      tiers: [] // ví dụ: [{ from: 11, to: 20, add: 0.5 }]
    },
    group2: {
      title: 'Nhóm 2',
      // “Chuẩn cũ”: B11, E41, G51, G61
      codes: 'B11,E41,G51,G61'.split(','),
      base: 1.2,
      // “Chuẩn cũ”: +0.5 từ 31–50 (không cộng dồn theo từng bậc)
      tiers: [{ from: 31, to: 50, add: 0.5 }]
    },
    group34: {
      title: 'Nhóm 3 & 4',
      // “Chuẩn cũ”: H11, A11, A12, A21, A31, A41, A42, E13, G12, G13, B13, G22, G23
      codes: 'H11,A11,A12,A21,A31,A41,A42,E13,G12,G13,B13,G22,G23'.split(','),
      base: 1.5,
      // Cộng dồn 4 bậc (chuẩn bạn xác nhận)
      tiers: [
        { from: 11, to: 20, add: 0.5 },
        { from: 21, to: 30, add: 0.5 },
        { from: 31, to: 40, add: 0.5 },
        { from: 41, to: 50, add: 0.5 },
      ]
    }
  },

  // Điểm giấy phép
  license: {
    perType: 1,             // mỗi LOẠI giấy phép +1 điểm
    maxTypes: 5,            // tối đa số LOẠI tính điểm
    excludeCodes: ['ZN02','HDGC'] // các mã “Mã giấy phép” KHÔNG tính (áp dụng cho 6 cặp)
  }
};

// ====== LƯU / TẢI QUY TẮC (CÓ LỊCH SỬ) ======
const KEY_HISTORY = 'kpi_rules_history';   // mảng phiên bản đã lưu
const LEGACY_KEY_ACTIVE = 'kpi_rules';

export function loadRules() {
  try {
    const stored = readPersistedRules();
    if (stored && stored.groups && stored.license) {
      return stored;
    }
  } catch (err) {
    console.warn('loadRules: invalid data, fallback to default', err);
  }

  // Thử migrate từ khoá cũ nếu còn
  try {
    const legacy = JSON.parse(getStorageItem(LEGACY_KEY_ACTIVE) || 'null');
    if (legacy && legacy.groups && legacy.license) {
      persistRules(legacy);
      return legacy;
    }
  } catch (err) {
    console.warn('loadRules: legacy data invalid, fallback to default', err);
  }

  // lần đầu: lưu mặc định
  saveRules(DEFAULT_RULES, { appendHistory: false });
  return DEFAULT_RULES;
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
  const cloned = JSON.parse(JSON.stringify(rules || {}));
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
