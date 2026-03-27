import { beforeEach, describe, expect, it, vi } from "vitest";

const getHQAgenciesMock = vi.hoisted(() => vi.fn());
const getDeclRowsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/store.js", async () => {
  const actual = await vi.importActual("@/lib/store.js");
  return {
    ...actual,
    getHQAgencies: getHQAgenciesMock,
    getDeclRows: getDeclRowsMock,
  };
});

import {
  clampColumnWidth,
  computeRowState,
  createEmptyDraft,
  formatHistoryTimestamp,
  mergeRows,
  readDraftsFromStore,
  suggestCompanyByMST,
} from "@/components/hq-agency-manager/hqAgencyManagerModel.js";

describe("hqAgencyManagerModel", () => {
  beforeEach(() => {
    getHQAgenciesMock.mockReset();
    getDeclRowsMock.mockReset();
  });

  it("clamps widths and falls back to defaults for invalid input", () => {
    expect(clampColumnWidth("mst", 10)).toBe(180);
    expect(clampColumnWidth("agency", 900)).toBe(720);
    expect(clampColumnWidth("company", "oops")).toBe(320);
  });

  it("reads drafts from store and normalizes agent lists", () => {
    getHQAgenciesMock.mockReturnValue([{ mst: "0101234567", company: "Alpha", agent: "AIR, SEA" }]);

    const result = readDraftsFromStore();

    expect(result.error).toBeNull();
    expect(result.drafts).toEqual([
      {
        mst: "0101234567",
        company: "Alpha",
        agents: ["AIR", "SEA"],
        agent: "AIR, SEA",
        _originalMst: "0101234567",
        _isNew: false,
      },
    ]);
  });

  it("preserves unsaved rows while merging imported rows into existing drafts", () => {
    const newDraft = {
      ...createEmptyDraft(),
      company: "Tạm",
      agent: "MANUAL",
      agents: ["MANUAL"],
    };
    const existingDraft = {
      mst: "0101234567",
      company: "Cũ",
      agent: "AIR",
      agents: ["AIR"],
      _originalMst: "0101234567",
      _isNew: false,
    };

    const merged = mergeRows(
      [newDraft, existingDraft],
      [
        { mst: "0101234567", company: "Mới", agent: "SEA" },
        { mst: "0201234567", company: "Beta", agent: "AIR" },
      ],
    );

    expect(merged).toEqual([
      {
        mst: "0201234567",
        company: "Beta",
        agent: "AIR",
        agents: ["AIR"],
        _originalMst: "",
        _isNew: true,
      },
      {
        mst: "0101234567",
        company: "Mới",
        agent: "AIR, SEA",
        agents: ["AIR", "SEA"],
        _originalMst: "0101234567",
        _isNew: false,
      },
      newDraft,
    ]);
  });

  it("computes row state from baseline and history metadata", () => {
    const row = {
      mst: "0101234567",
      company: "Alpha",
      agent: "AIR, SEA",
      agents: ["AIR", "SEA"],
      _originalMst: "0101234567",
      _isNew: false,
    };
    const baselineMap = new Map([
      [
        "0101234567",
        {
          ...row,
          agent: "AIR",
          agents: ["AIR"],
        },
      ],
    ]);
    const historyMap = new Map([["0101234567", [{ timestamp: "2026-03-20T10:00:00.000Z" }]]]);

    const state = computeRowState(
      row,
      baselineMap,
      historyMap,
      new Date("2026-03-27T09:00:00.000Z").getTime(),
    );

    expect(state.hasChanges).toBe(true);
    expect(state.hasAgents).toBe(true);
    expect(state.hasHistory).toBe(true);
    expect(state.isRecent).toBe(true);
    expect(state.lastTimestamp).toBe(new Date("2026-03-20T10:00:00.000Z").getTime());
  });

  it("suggests company names from declaration rows using normalized MST", () => {
    getDeclRowsMock.mockReturnValue([
      { mst: "0101234567", cong_ty: "Công Ty Demo" },
      { mst: "0101234567", cong_ty: "Công Ty Demo" },
      { mst: "0101234567", cong_ty: "Tên khác" },
    ]);

    expect(suggestCompanyByMST("0101 234 567")).toBe("Công Ty Demo");
    expect(suggestCompanyByMST("999")).toBe("");
  });

  it("formats history timestamps and leaves invalid values unchanged", () => {
    expect(formatHistoryTimestamp("not-a-date")).toBe("not-a-date");
    expect(formatHistoryTimestamp("2026-03-27T10:15:00.000Z")).toMatch(/2026|27/);
  });
});
