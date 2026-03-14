import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterBaselineSnapshot from "@/components/dataImporter/useDataImporterBaselineSnapshot.js";

function createRow(overrides = {}) {
  return {
    so_tk: "TK-001",
    nhanh: "A",
    nhan_vien: "An",
    team: "OPS",
    agency: "DL-01",
    ...overrides,
  };
}

describe("useDataImporterBaselineSnapshot", () => {
  it("captures saved rows into the baseline snapshot and computes editable diffs", () => {
    const keyOfRow = (row) => `${row?.so_tk || ""}_${row?.nhanh || ""}`;
    const baseRow = createRow();
    const changedRow = createRow({ team: "CS" });
    const { result, rerender } = renderHook(
      (hookProps) => useDataImporterBaselineSnapshot(hookProps),
      {
        initialProps: {
          mode: "saved",
          rawRows: [baseRow],
          keyOfRow,
        },
      }
    );

    expect(result.current.baselineVersion).toBe(0);
    expect(result.current.rowDiffMap.size).toBe(0);

    act(() => {
      result.current.updateBaselineSnapshot([baseRow]);
    });

    expect(result.current.baselineVersion).toBe(1);
    expect(result.current.savedRowSnapshotRef.current.get("TK-001_A")).toEqual(baseRow);

    rerender({
      mode: "saved",
      rawRows: [changedRow],
      keyOfRow,
    });

    expect(Array.from(result.current.rowDiffMap.entries())).toEqual([
      ["TK-001_A", { team: "CS" }],
    ]);
  });

  it("commits a single row back into the baseline snapshot and clears its diff", () => {
    const keyOfRow = (row) => `${row?.so_tk || ""}_${row?.nhanh || ""}`;
    const baseRow = createRow();
    const changedRow = createRow({ agency: "DL-02" });
    const { result, rerender } = renderHook(
      (hookProps) => useDataImporterBaselineSnapshot(hookProps),
      {
        initialProps: {
          mode: "saved",
          rawRows: [baseRow],
          keyOfRow,
        },
      }
    );

    act(() => {
      result.current.updateBaselineSnapshot([baseRow]);
    });

    rerender({
      mode: "saved",
      rawRows: [changedRow],
      keyOfRow,
    });

    expect(Array.from(result.current.rowDiffMap.entries())).toEqual([
      ["TK-001_A", { agency: "DL-02" }],
    ]);

    act(() => {
      result.current.commitRowToBaseline("TK-001_A", changedRow);
    });

    expect(result.current.baselineVersion).toBe(2);
    expect(result.current.savedRowSnapshotRef.current.get("TK-001_A")).toEqual(changedRow);
    expect(result.current.rowDiffMap.size).toBe(0);
  });

  it("suppresses row diffs outside saved mode", () => {
    const keyOfRow = (row) => `${row?.so_tk || ""}_${row?.nhanh || ""}`;
    const baseRow = createRow();
    const changedRow = createRow({ nhan_vien: "Binh" });
    const { result, rerender } = renderHook(
      (hookProps) => useDataImporterBaselineSnapshot(hookProps),
      {
        initialProps: {
          mode: "saved",
          rawRows: [baseRow],
          keyOfRow,
        },
      }
    );

    act(() => {
      result.current.updateBaselineSnapshot([baseRow]);
    });

    rerender({
      mode: "preview",
      rawRows: [changedRow],
      keyOfRow,
    });

    expect(result.current.rowDiffMap.size).toBe(0);
  });
});
