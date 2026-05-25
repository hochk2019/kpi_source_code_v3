import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import useDataImporterLayout from "@/components/dataImporter/useDataImporterLayout.js";

function createProps(overrides = {}) {
  return {
    columnWidths: { date: 150, declaration: 210, mst: 130 },
    freezeColumnsEnabled: true,
    selectionEnabled: true,
    hiddenColumns: new Set(),
    cardGridColumns: 4,
    containerWidth: 700,
    visibleColumnCount: 8,
    updateEnabled: true,
    deleteEnabled: true,
    historyEnabled: false,
    ...overrides,
  };
}

describe("useDataImporterLayout", () => {
  it("tinh frozen offsets, style va total columns theo visible actions", () => {
    const { result } = renderHook(() => useDataImporterLayout(createProps()));

    expect(result.current.totalColumns).toBe(11);
    expect(result.current.frozenOffsets.total).toBe(44 + 150 + 210 + 130);
    expect(result.current.frozenOffsets.selection).toEqual({ left: 0, width: 44 });
    expect(result.current.frozenOffsets.date).toEqual({ left: 44, width: 150 });
    expect(result.current.frozenOffsets.declaration).toEqual({ left: 194, width: 210 });
    expect(result.current.getFrozenStyle("mst")).toEqual({
      left: "404px",
      minWidth: "130px",
      width: "130px",
      maxWidth: "130px",
    });
    expect(result.current.getColumnStyle("date")).toEqual({
      minWidth: "150px",
      width: "150px",
    });
    expect(result.current.historyIndent).toBe(150 + 210 + 130);
  });

  it("bo qua cot frozen bi an va tat frozen style khi freeze disable", () => {
    const { result } = renderHook(() =>
      useDataImporterLayout(
        createProps({
          hiddenColumns: new Set(["declaration"]),
          freezeColumnsEnabled: false,
          selectionEnabled: false,
          updateEnabled: false,
          deleteEnabled: false,
          historyEnabled: true,
        }),
      ),
    );

    expect(result.current.totalColumns).toBe(9);
    expect(result.current.frozenOffsets).toEqual({ total: 0 });
    expect(result.current.getFrozenStyle("date")).toBeUndefined();
    expect(result.current.historyIndent).toBe(0);
  });

  it("gioi han card grid theo do rong container va fallback ve default columns", () => {
    const { result } = renderHook(() =>
      useDataImporterLayout(
        createProps({
          cardGridColumns: 99,
          containerWidth: 500,
        }),
      ),
    );

    expect(result.current.effectiveCardColumns).toBe(2);
    expect(result.current.appliedCardColumns).toBe(1);
    expect(result.current.cardGridStyle).toEqual({
      gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    });
  });
});
