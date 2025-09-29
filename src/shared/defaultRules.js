export const DEFAULT_RULES = {
  name: "Rules v2",
  applyFrom: "",
  updatedAt: new Date().toISOString(),
  groups: {
    group1: {
      title: "Nhóm 1",
      codes: "E11,E15,E21,E31,E42,E52,E62,E82,H21".split(","),
      base: 1,
      tiers: [],
    },
    group2: {
      title: "Nhóm 2",
      codes: "B11,E41,G51,G61".split(","),
      base: 1.2,
      tiers: [{ from: 31, to: 50, add: 0.5 }],
    },
    group34: {
      title: "Nhóm 3 & 4",
      codes: "H11,A11,A12,A21,A31,A41,A42,E13,G12,G13,B13,G22,G23".split(","),
      base: 1.5,
      tiers: [
        { from: 11, to: 20, add: 0.5 },
        { from: 21, to: 30, add: 0.5 },
        { from: 31, to: 40, add: 0.5 },
        { from: 41, to: 50, add: 0.5 },
      ],
    },
  },
  license: {
    perType: 1,
    maxTypes: 5,
    excludeCodes: ["ZN02", "HDGC"],
  },
  bonuses: {
    co: {
      enabled: true,
      label: "Cộng điểm khi tờ khai có C/O",
      points: 0.5,
    },
  },
};
