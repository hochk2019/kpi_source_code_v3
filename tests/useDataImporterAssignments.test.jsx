import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterAssignments from "@/components/dataImporter/useDataImporterAssignments.js";

function normalizeStr(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeName(value) {
  return normalizeStr(value).toLowerCase();
}

function createProps(overrides = {}) {
  return {
    applyEdit: vi.fn(),
    memberTeamMap: new Map([
      ["binh", { team: "Team B" }],
      ["an", { team: "Team A" }],
    ]),
    normalizeStr,
    normalizeName,
    ...overrides,
  };
}

describe("useDataImporterAssignments", () => {
  it("maps a selected staff member back to the roster team when no team override is provided", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterAssignments(props));

    act(() => {
      result.current.handleSelectStaff("row-1", { staffName: "Binh" });
    });

    expect(props.applyEdit).toHaveBeenCalledTimes(1);
    expect(props.applyEdit).toHaveBeenCalledWith("row-1", expect.any(Function));

    const updater = props.applyEdit.mock.calls[0][1];
    expect(updater({ nhan_vien: "An", team: "Team A" })).toEqual({
      nhan_vien: "Binh",
      team: "Team B",
    });
  });

  it("clears the current staff assignment when a different team is chosen", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterAssignments(props));

    act(() => {
      result.current.handleSelectTeam("row-2", "Team C");
    });

    expect(props.applyEdit).toHaveBeenCalledTimes(1);
    expect(props.applyEdit).toHaveBeenCalledWith("row-2", expect.any(Function));

    const updater = props.applyEdit.mock.calls[0][1];
    expect(updater({ nhan_vien: "An", team: "Team A" })).toEqual({
      team: "Team C",
      nhan_vien: "",
    });
  });

  it("keeps agency and dai_ly in sync when selecting an agency", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterAssignments(props));

    act(() => {
      result.current.handleSelectAgency("row-3", "  Đại lý mới  ");
    });

    expect(props.applyEdit).toHaveBeenCalledTimes(1);
    expect(props.applyEdit).toHaveBeenCalledWith("row-3", expect.any(Function));

    const updater = props.applyEdit.mock.calls[0][1];
    expect(updater({ agency: "Cũ", dai_ly: "Cũ" })).toEqual({
      agency: "Đại lý mới",
      dai_ly: "Đại lý mới",
    });
  });
});
