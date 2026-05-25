import React, { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useMSTAssignmentAddFormWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentAddFormWorkspace.js";

function makeRowKey(row) {
  return `${row?.mst || ""}__${row?.effective_from || ""}__${row?.effective_to || ""}`;
}

function createRowState(row, meta = {}) {
  return {
    ...row,
    __originalKey: meta.originalKey ?? null,
    __isNew: Boolean(meta.isNew),
  };
}

function renderWorkspace(overrides = {}) {
  const alertFn = overrides.alertFn ?? vi.fn();
  const goToFirstPage = overrides.goToFirstPage ?? vi.fn();
  const markRecentlyImported = overrides.markRecentlyImported ?? vi.fn();
  const scrollToTopFn = overrides.scrollToTopFn ?? vi.fn();
  const scheduleScrollFn =
    overrides.scheduleScrollFn ??
    ((callback) => {
      callback();
      return 0;
    });

  const view = renderHook(() => {
    const [rows, setRows] = useState(overrides.rows ?? []);

    const workspace = useMSTAssignmentAddFormWorkspace({
      applyFrom: overrides.applyFrom ?? "2025-04-01",
      computeStoredStatus:
        overrides.computeStoredStatus ??
        ((row) => (row.person_import && row.person_export ? "assigned" : "pending")),
      createRowState,
      goToFirstPage,
      isReadOnly: overrides.isReadOnly ?? false,
      makeRowKey,
      markRecentlyImported,
      normalizeName: (value) => String(value || "").trim().toLowerCase(),
      normalizeStr: (value) => String(value || "").trim(),
      rows,
      scrollToTopFn,
      scheduleScrollFn,
      setRows,
      tidyMST: (value) => String(value || "").replace(/\D/g, ""),
      alertFn,
    });

    return {
      rows,
      ...workspace,
    };
  });

  return {
    ...view,
    alertFn,
    goToFirstPage,
    markRecentlyImported,
    scrollToTopFn,
  };
}

describe("useMSTAssignmentAddFormWorkspace", () => {
  it("opens the add form, syncs assignee selections, and submits a new row", () => {
    const { result, alertFn, goToFirstPage, markRecentlyImported } = renderWorkspace();
    const preventDefault = vi.fn();

    act(() => {
      result.current.toggleAddForm();
    });

    expect(result.current.showAddForm).toBe(true);
    expect(result.current.draft.effective_from).toBe("2025-04-01");

    act(() => {
      result.current.handleDraftChange("mst", (value) => value.replace(/\D/g, ""))({
        target: { value: "0312-345-678" },
      });
      result.current.handleDraftChange("company")({
        target: { value: "Công ty Kim Liên" },
      });
      result.current.handleDraftImportSelect({
        staffName: "Minh Trí",
        teamName: "Tổ 1",
        isCustom: false,
      });
      result.current.handleDraftExportSelect({
        staffName: "Ngọc Hà",
        teamName: "Tổ 1",
        isCustom: false,
      });
    });

    expect(result.current.draft).toMatchObject({
      mst: "0312345678",
      company: "Công ty Kim Liên",
      person_import: "Minh Trí",
      person_export: "Ngọc Hà",
      team: "Tổ 1",
    });

    act(() => {
      result.current.handleAddSubmit({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toMatchObject({
      mst: "0312345678",
      company: "Công ty Kim Liên",
      person_import: "Minh Trí",
      person_export: "Ngọc Hà",
      team: "Tổ 1",
      effective_from: "2025-04-01",
      status: "assigned",
      __isNew: true,
    });
    expect(markRecentlyImported).toHaveBeenCalledWith(["0312345678__2025-04-01__"]);
    expect(goToFirstPage).toHaveBeenCalledTimes(1);
    expect(alertFn).toHaveBeenCalledWith("Đã thêm vào danh sách. Bấm Lưu để ghi vào hệ thống.");
    expect(result.current.showAddForm).toBe(false);
    expect(result.current.addError).toBe("");
  });

  it("prefills the form from an existing row when creating a new stage", () => {
    const existingRow = {
      mst: "0101234567",
      company: "Công ty A",
      person_import: "Lan",
      person_export: "Bình",
      team: "OPS",
      effective_from: "2025-03-01",
      effective_to: "2025-03-31",
    };
    const { result, scrollToTopFn } = renderWorkspace();

    act(() => {
      result.current.startNewStageFromRow(existingRow);
    });

    expect(result.current.showAddForm).toBe(true);
    expect(result.current.draft).toMatchObject({
      mst: "0101234567",
      company: "Công ty A",
      person_import: "Lan",
      person_export: "Bình",
      team: "OPS",
      effective_from: "2025-04-01",
      effective_to: "",
    });
    expect(scrollToTopFn).toHaveBeenCalledTimes(1);
  });

  it("blocks invalid date ranges and keeps the form open for correction", () => {
    const { result, alertFn, markRecentlyImported } = renderWorkspace();

    act(() => {
      result.current.toggleAddForm();
      result.current.handleDraftChange("mst", (value) => value.replace(/\D/g, ""))({
        target: { value: "0312345678" },
      });
      result.current.handleDraftChange("effective_from")({
        target: { value: "2025-05-10" },
      });
      result.current.handleDraftChange("effective_to")({
        target: { value: "2025-05-01" },
      });
    });

    act(() => {
      result.current.handleAddSubmit({ preventDefault: vi.fn() });
    });

    expect(result.current.rows).toHaveLength(0);
    expect(result.current.addError).toBe("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
    expect(result.current.showAddForm).toBe(true);
    expect(alertFn).not.toHaveBeenCalledWith(
      "Đã thêm vào danh sách. Bấm Lưu để ghi vào hệ thống."
    );
    expect(markRecentlyImported).not.toHaveBeenCalled();
  });
});
