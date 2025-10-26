// shared/kpiAdjustments.js

// Cấu hình và helper dùng chung cho điểm KPI +/- bổ sung



function normalizeWhitespace(value) {

  return (value ?? '')

    .toString()

    .replace(/\s+/g, ' ')

    .trim();

}



function normalizeKey(input) {

  const base = normalizeWhitespace(input);

  if (!base) return '';

  return base

    .toLowerCase()

    .replace(/[^a-z0-9_]+/g, '_')

    .replace(/_{2,}/g, '_')

    .replace(/^_|_$/g, '');

}



function humanizeKey(key) {

  const normalized = normalizeKey(key);

  if (!normalized) {

    return '';

  }

  return normalized

    .split('_')

    .filter(Boolean)

    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))

    .join(' ');

}



export const KPI_ADJUSTMENT_CATEGORY_CONFIG = Object.freeze({

  support_fixed: {

    label: 'Hỗ trợ thông quan (luồng xanh)',

    type: 'quantity',

    defaultUnit: 0.1,

    groupKey: 'support',

    groupLabel: 'Hỗ trợ thông quan',

    color: 'emerald',

  },

  support_dynamic: {

    label: 'Hỗ trợ thông quan (luồng vàng/đỏ)',

    type: 'quantity',

    defaultUnit: 0.25,

    groupKey: 'support',

    groupLabel: 'Hỗ trợ thông quan',

    color: 'amber',

  },

  license_support: {

    label: 'Hỗ trợ xin giấy phép',

    type: 'quantity',

    defaultUnit: 1.5,

    groupKey: 'license_support',

    groupLabel: 'Hỗ trợ giấy phép',

    requiresLicenseCode: true,

    licensePoints: {

      ZB02: 2,

      ZB03: 1.5,

    },

    licenseOptions: [

      { value: 'ZB02', label: 'ZB02 – Giấy phép kiểm dịch' },

      { value: 'ZB03', label: 'ZB03 – Giấy phép chuyên ngành khác' },

    ],

  },

  support_misc: {

    label: 'Hỗ trợ khác',

    type: 'hybrid',

    defaultUnit: 10,

    defaultMode: 'fixed',

    modes: [

      { value: 'fixed', label: 'Điểm cố định', description: 'Áp dụng điểm cố định theo mặc định', compute: 'fixed', defaultUnit: 10 },

      {

        value: 'dynamic',

        label: 'Linh hoạt theo số lượng',

        description: 'Điểm = hệ số * số lượng (mặc định 0.1)',

        compute: 'quantity',

        defaultUnit: 0.1,

      },

    ],

    groupKey: 'support_misc',

    groupLabel: 'Hỗ trợ khác',

  },

  co_correction: {

    label: 'Sửa tờ khai bổ sung C/O',

    type: 'quantity',

    defaultUnit: 1.5,

    groupKey: 'correction',

    groupLabel: 'Sửa tờ khai',

  },

  cancel_staff: {

    label: 'Huỷ tờ khai do lỗi nhân viên',

    type: 'quantity',

    defaultUnit: -1,

    groupKey: 'cancel',

    groupLabel: 'Huỷ tờ khai',

  },

  cancel_customer: {

    label: 'Huỷ tờ khai do lỗi khách hàng',

    type: 'quantity',

    defaultUnit: 1,

    groupKey: 'cancel',

    groupLabel: 'Huỷ tờ khai',

  },

  correction_staff: {

    label: 'Sửa tờ khai do lỗi nhân viên',

    type: 'quantity',

    defaultUnit: -1,

    groupKey: 'correction',

    groupLabel: 'Sửa tờ khai',

  },

  correction_customer: {

    label: 'Sửa tờ khai do lỗi khách hàng',

    type: 'quantity',

    defaultUnit: 1,

    groupKey: 'correction',

    groupLabel: 'Sửa tờ khai',

  },

  tax_refund_staff: {

    label: 'Hoàn thuế do lỗi nhân viên',

    type: 'quantity',

    defaultUnit: -1,

    groupKey: 'tax',

    groupLabel: 'Hoàn thuế',

  },

  tax_refund_customer: {

    label: 'Hoàn thuế theo yêu cầu khách hàng',

    type: 'quantity',

    defaultUnit: 2,

    groupKey: 'tax',

    groupLabel: 'Hoàn thuế',

  },

  teamwork: {

    label: 'Tinh thần hoạt động nhóm',

    type: 'grade',

    groupKey: 'teamwork',

    groupLabel: 'Tinh thần hoạt động nhóm',

    grades: [

      { value: 10, label: 'Rất tốt (+10)' },

      { value: 5, label: 'Tốt (+5)' },

      { value: 0, label: 'Trung bình (0)' },

      { value: -5, label: 'Yếu (-5)' },

      { value: -10, label: 'Kém (-10)' },

    ],

  },

  coworker_attitude: {

    label: 'Thái độ với đồng nghiệp',

    type: 'grade',

    groupKey: 'coworker_attitude',

    groupLabel: 'Thái độ với đồng nghiệp',

    grades: [

      { value: 10, label: 'Rất tốt (+10)' },

      { value: 5, label: 'Tốt (+5)' },

      { value: 0, label: 'Trung bình (0)' },

      { value: -5, label: 'Yếu (-5)' },

      { value: -10, label: 'Kém (-10)' },

    ],

  },

  customer_attitude: {

    label: 'Thái độ với khách hàng',

    type: 'grade',

    groupKey: 'customer_attitude',

    groupLabel: 'Thái độ với khách hàng',

    grades: [

      { value: 10, label: 'Rất tốt (+10)' },

      { value: 5, label: 'Tốt (+5)' },

      { value: 0, label: 'Trung bình (0)' },

      { value: -5, label: 'Yếu (-5)' },

      { value: -10, label: 'Kém (-10)' },

    ],

  },

});



const GROUP_REGISTRY = new Map();

const CATEGORY_TO_GROUP = new Map();



function registerGroup(key, label) {

  const normalizedKey = normalizeKey(key);

  if (!normalizedKey) {

    return null;

  }

  if (!GROUP_REGISTRY.has(normalizedKey)) {

    GROUP_REGISTRY.set(normalizedKey, {

      key: normalizedKey,

      label: normalizeWhitespace(label) || humanizeKey(normalizedKey),

      order: GROUP_REGISTRY.size,

    });

  } else if (label && !GROUP_REGISTRY.get(normalizedKey).label) {

    const entry = GROUP_REGISTRY.get(normalizedKey);

    entry.label = normalizeWhitespace(label) || entry.label || humanizeKey(normalizedKey);

  }

  return GROUP_REGISTRY.get(normalizedKey);

}



for (const [rawCategory, config] of Object.entries(KPI_ADJUSTMENT_CATEGORY_CONFIG)) {

  const categoryKey = normalizeKey(rawCategory);

  if (!categoryKey) {

    continue;

  }

  const groupKey = normalizeKey(config.groupKey) || categoryKey;

  const groupMeta = registerGroup(groupKey, config.groupLabel || config.label || humanizeKey(groupKey));

  if (groupMeta) {

    CATEGORY_TO_GROUP.set(categoryKey, groupMeta.key);

  }

}



export function normalizeAdjustmentCategoryKey(value) {

  return normalizeKey(value);

}



export function resolveAdjustmentGroup(category) {

  const categoryKey = normalizeKey(category);

  if (!categoryKey) {

    return null;

  }

  const mappedGroupKey = CATEGORY_TO_GROUP.get(categoryKey);

  if (mappedGroupKey && GROUP_REGISTRY.has(mappedGroupKey)) {

    return GROUP_REGISTRY.get(mappedGroupKey);

  }

  const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[categoryKey];

  if (config) {

    const groupKey = normalizeKey(config.groupKey) || categoryKey;

    const meta = registerGroup(groupKey, config.groupLabel || config.label || humanizeKey(groupKey));

    if (meta) {

      CATEGORY_TO_GROUP.set(categoryKey, meta.key);

      return meta;

    }

  }

  const fallback = registerGroup(categoryKey, humanizeKey(categoryKey));

  CATEGORY_TO_GROUP.set(categoryKey, fallback?.key || categoryKey);

  return fallback;

}



export function createAdjustmentTotals() {

  const totals = Object.create(null);

  for (const meta of GROUP_REGISTRY.values()) {

    totals[meta.key] = {

      key: meta.key,

      label: meta.label,

      order: meta.order,

      points: 0,

      quantity: 0,

    };

  }

  return totals;

}



export function cloneAdjustmentTotals(source = createAdjustmentTotals()) {

  const clone = createAdjustmentTotals();

  if (!source || typeof source !== 'object') {

    return clone;

  }

  for (const [rawKey, rawValue] of Object.entries(source)) {

    if (!rawValue) continue;

    const baseKey = normalizeKey(rawValue.key || rawKey);

    const meta = resolveAdjustmentGroup(baseKey);

    if (!meta) continue;

    if (!clone[meta.key]) {

      clone[meta.key] = {

        key: meta.key,

        label: meta.label,

        order: meta.order,

        points: 0,

        quantity: 0,

      };

    }

    const entry = clone[meta.key];

    entry.points = Number(rawValue.points || 0);

    entry.quantity = Number(rawValue.quantity || 0);

    if (rawValue.label) {

      entry.label = normalizeWhitespace(rawValue.label);

    }

    if (Number.isFinite(rawValue.order)) {

      entry.order = rawValue.order;

    }

  }

  return clone;

}



export function addAdjustmentTotals(targetTotals, category, points, quantity) {

  if (!targetTotals || typeof targetTotals !== 'object') {

    throw new TypeError('targetTotals phải là object');

  }

  const meta = resolveAdjustmentGroup(category);

  if (!meta) {

    return null;

  }

  if (!targetTotals[meta.key]) {

    targetTotals[meta.key] = {

      key: meta.key,

      label: meta.label,

      order: meta.order,

      points: 0,

      quantity: 0,

    };

  }

  const entry = targetTotals[meta.key];

  const pointValue = Number(points || 0);

  const quantityValue = Number(quantity || 0);

  if (Number.isFinite(pointValue)) {

    entry.points += pointValue;

  }

  if (Number.isFinite(quantityValue)) {

    entry.quantity += quantityValue;

  }

  if (!entry.label) {

    entry.label = meta.label;

  }

  if (!Number.isFinite(entry.order)) {

    entry.order = meta.order;

  }

  return entry;

}



export function toAdjustmentTotalsArray(totals, options = {}) {

  const { sortBy = 'order', filterZero = false } = options;

  const entries = [];

  if (totals && typeof totals === 'object') {

    for (const value of Object.values(totals)) {

      if (!value) continue;

      const meta = resolveAdjustmentGroup(value.key || value.groupKey || value.category);

      const key = meta?.key || normalizeKey(value.key);

      if (!key) continue;

      const points = Number(value.points || 0);

      const quantity = Number(value.quantity || 0);

      if (filterZero && Math.abs(points) < 0.0001 && Math.abs(quantity) < 0.0001) {

        continue;

      }

      entries.push({

        key,

        label: normalizeWhitespace(value.label) || meta?.label || humanizeKey(key),

        order: Number.isFinite(value.order) ? value.order : meta?.order ?? Number.MAX_SAFE_INTEGER,

        points,

        quantity,

      });

    }

  }



  entries.sort((a, b) => {

    if (sortBy === 'points') {

      const diff = Math.abs(b.points) - Math.abs(a.points);

      if (Math.abs(diff) > 0.0001) {

        return diff;

      }

    }

    const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;

    const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {

      return orderA - orderB;

    }

    return a.label.localeCompare(b.label, 'vi', { sensitivity: 'base' });

  });



  return entries;

}



export function listRegisteredAdjustmentGroups() {

  return Array.from(GROUP_REGISTRY.values()).map((entry) => ({ ...entry }));

}

