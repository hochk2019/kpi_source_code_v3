import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  ADMIN_ROLE,
  DEFAULT_ROLE,
  TEAM_LEAD_ROLE,
} from "../packages/domain/src/accountRoles.js";
import useDataImporterEditAccess from "@/components/dataImporter/useDataImporterEditAccess.js";

const dialogMocks = vi.hoisted(() => ({
  alert: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => dialogMocks,
}));

function normalizeStr(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeName(value) {
  return normalizeStr(value).toLowerCase();
}

function createProps(overrides = {}) {
  return {
    currentUser: {
      role: DEFAULT_ROLE,
      name: "An",
      username: "an",
    },
    canEdit: true,
    rawRows: [],
    getTeamRoster: vi.fn(() => [
      { name: "An", team: "Team A" },
      { name: "Lead A", team: "Team A" },
      { name: "Teammate", team: "Team A" },
      { name: "Binh", team: "Team B" },
    ]),
    buildRosterTeams: vi.fn(() => [
      { value: "Team A", label: "Team A" },
      { value: "Team B", label: "Team B" },
    ]),
    mapMemberNamesToTeams: vi.fn(() =>
      new Map([
        ["an", { team: "Team A" }],
        ["lead a", { team: "Team A" }],
        ["teammate", { team: "Team A" }],
        ["binh", { team: "Team B" }],
      ]),
    ),
    getHQAgencies: vi.fn(() => [
      {
        company: "HQ Co",
        mst: "0101",
        agents: ["Alpha", "Beta"],
      },
    ]),
    parseAgencyList: vi.fn((value) =>
      normalizeStr(value)
        .split(/[;,]/)
        .map((item) => normalizeStr(item))
        .filter(Boolean),
    ),
    normalizeStr,
    normalizeName,
    ...overrides,
  };
}

describe("useDataImporterEditAccess", () => {
  afterEach(() => {
    vi.clearAllMocks();
    dialogMocks.alert.mockResolvedValue();
  });

  it("builds roster teams and deduplicated agency options from HQ + current rows", () => {
    const props = createProps({
      currentUser: { role: ADMIN_ROLE, name: "Admin", username: "admin" },
      rawRows: [
        {
          agency: "Gamma",
          dai_ly: "Beta",
          hq_agency: "Gamma; Delta",
          agents: ["Delta"],
        },
      ],
    });

    const { result } = renderHook(() => useDataImporterEditAccess(props));

    expect(props.getTeamRoster).toHaveBeenCalledTimes(1);
    expect(props.buildRosterTeams).toHaveBeenCalledTimes(1);
    expect(result.current.rosterTeams).toEqual([
      { value: "Team A", label: "Team A" },
      { value: "Team B", label: "Team B" },
    ]);
    expect(result.current.agencyOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "Alpha",
          hint: expect.stringContaining("HQ Co"),
        }),
        expect.objectContaining({ value: "Beta" }),
        expect.objectContaining({ value: "Delta" }),
        expect.objectContaining({ value: "Gamma" }),
        expect.objectContaining({ value: "Gamma; Delta" }),
      ]),
    );
    expect(result.current.isAdminRole).toBe(true);
    expect(result.current.canAutoReconcile).toBe(true);
  });

  it("limits team leads to rows that belong to their assigned team", () => {
    const props = createProps({
      currentUser: { role: TEAM_LEAD_ROLE, name: "Lead A", username: "lead-a" },
    });

    const { result } = renderHook(() => useDataImporterEditAccess(props));

    expect(result.current.editingRestrictionMessage).toBe(
      "Bạn chỉ có thể chỉnh sửa tờ khai thuộc tổ Team A.",
    );
    expect(
      result.current.isRowEditable({ team: "Team A", nhan_vien: "Ai do" }),
    ).toBe(true);
    expect(
      result.current.isRowEditable({ team: "", nhan_vien: "Teammate" }),
    ).toBe(true);
    expect(
      result.current.isRowEditable({ team: "Team B", nhan_vien: "Binh" }),
    ).toBe(false);
  });

  it("blocks staff team changes outside their assignment and clears blocked notices when identity changes", async () => {
    const props = createProps();
    const { result, rerender } = renderHook(
      ({ hookProps }) => useDataImporterEditAccess(hookProps),
      { initialProps: { hookProps: props } },
    );

    expect(
      result.current.isRowEditable({ team: "Team A", nhan_vien: "Someone" }),
    ).toBe(true);
    expect(
      result.current.isRowEditable({ team: "Team B", nhan_vien: "Binh" }),
    ).toBe(false);
    await expect(
      result.current.sanitizeRowUpdates(
        { team: "Team A", nhan_vien: "An" },
        { team: "Team B" },
      ),
    ).resolves.toBeNull();
    expect(dialogMocks.alert).toHaveBeenCalledWith("Bạn chỉ được gán tổ đội Team A.");

    act(() => {
      result.current.blockedEditNoticeRef.current.add("row-1");
    });
    expect(result.current.blockedEditNoticeRef.current.has("row-1")).toBe(true);

    rerender({
      hookProps: createProps({
        currentUser: {
          role: DEFAULT_ROLE,
          name: "Binh",
          username: "binh",
        },
      }),
    });

    expect(result.current.blockedEditNoticeRef.current.size).toBe(0);
  });

  it("isRowEditable returns false for rows with deleted_at", () => {
    const props = createProps({
      currentUser: { role: ADMIN_ROLE, name: "Admin", username: "admin" },
    });
    const { result } = renderHook(() => useDataImporterEditAccess(props));

    expect(
      result.current.isRowEditable({ team: "Team A", deleted_at: "2025-01-01" }),
    ).toBe(false);
  });

  it("isRowEditable returns false for reviewed rows with non-admin role", () => {
    const props = createProps({
      currentUser: { role: DEFAULT_ROLE, name: "An", username: "an" },
    });
    const { result } = renderHook(() => useDataImporterEditAccess(props));

    expect(
      result.current.isRowEditable({ team: "Team A", reviewed: true }),
    ).toBe(false);
  });

  it("staff role: row with matching team is editable", () => {
    const props = createProps({
      currentUser: { role: DEFAULT_ROLE, name: "An", username: "an" },
    });
    const { result } = renderHook(() => useDataImporterEditAccess(props));

    expect(
      result.current.isRowEditable({ team: "Team A", nhan_vien: "Someone" }),
    ).toBe(true);
  });

  it("staff role: row with different team is not editable", () => {
    const props = createProps({
      currentUser: { role: DEFAULT_ROLE, name: "An", username: "an" },
    });
    const { result } = renderHook(() => useDataImporterEditAccess(props));

    expect(
      result.current.isRowEditable({ team: "Team B", nhan_vien: "Binh" }),
    ).toBe(false);
  });
});
