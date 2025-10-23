const BASE_RULE_SET_V2 = {
  id: "rule-v2",

  name: "Rule v2",

  description: "Quy tắc KPI tuyến tính theo nhóm (áp dụng từ 2024)",

  applyFrom: "",

  updatedAt: new Date().toISOString(),

  groups: {
    group1: {
      key: "group1",

      title: "Nhóm 1",

      description: "Loại hình miễn/không thuế, độ phức tạp thấp",

      codes: ["E11", "E15", "E21", "E31", "E42", "E52", "E62", "E82", "H21", "B11", "G51", "G61"],

      base: 0.2,

      perItem: 0.1,

      tierMode: "per_item",

      tiers: [],
    },

    group2: {
      key: "group2",

      title: "Nhóm 2",

      description: "Luồng đỏ / có thuế gia công ngược, nhập vật tư chế xuất",

      codes: ["E41", "B13", "G22", "G23", "E13", "G13"],

      base: 0.2,

      perItem: 0.15,

      tierMode: "per_item",

      tiers: [],
    },

    group3: {
      key: "group3",

      title: "Nhóm 3",

      description: "Các tờ khai có thuế",

      codes: ["H11", "A11", "A12", "A21", "A31", "A41", "A42", "G12"],

      base: 0.2,

      perItem: 0.2,

      tierMode: "per_item",

      tiers: [],
    },
  },

  license: {
    defaultPoints: 0.3,

    codePoints: [
      { code: "ZB02", points: 0.4 },

      { code: "ZB03", points: 0.2 },
    ],

    exclude: {
      codes: ["ZN02", "HDGC"],

      agencies: [
        { agency: "G&B", codes: ["ZB02", "ZB03"] },

        { agency: "JNB", codes: ["ZB02", "ZB03"] },
      ],
    },
  },

  bonuses: {
    co: {
      enabled: true,

      label: "Cộng điểm khi tờ khai có C/O",

      points: 0.3,

      perLine: 0.05,
    },
  },
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createDefaultRuleSetV2() {
  return deepClone(BASE_RULE_SET_V2);
}

export function createDefaultRuleCollection() {
  return {
    version: 2,

    activeId: BASE_RULE_SET_V2.id,

    sets: [createDefaultRuleSetV2()],
  };
}

export const DEFAULT_RULES = createDefaultRuleSetV2();

export const DEFAULT_RULE_COLLECTION = createDefaultRuleCollection();
