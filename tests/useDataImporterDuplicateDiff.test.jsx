import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterDuplicateDiff from "@/components/dataImporter/useDataImporterDuplicateDiff.js";

function createGroup(rawPrefix, keys, keeperKey = keys[0]) {
  return {
    rawPrefix,
    prefix: `Group ${rawPrefix}`,
    keeperKey,
    items: keys.map((key) => ({
      key,
      label: `Label ${key}`,
      row: { rowKey: key, so_tk: key },
    })),
  };
}

function createProps(overrides = {}) {
  return {
    duplicate11Details: [createGroup("grp-1", ["row-1", "row-2"])],
    createDuplicateDiffGroups: vi.fn(() => [
      {
        rows: [
          { changed: true },
          { changed: false },
        ],
      },
    ]),
    prepareRowForDiff: vi.fn((row) => ({ ...row, prepared: true })),
    formatDeclarationLabel: vi.fn((row) => `TK ${row.rowKey || "missing"}`),
    ...overrides,
  };
}

describe("useDataImporterDuplicateDiff", () => {
  it("opens the first duplicate group when the dialog is opened without prior state", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterDuplicateDiff(props));

    act(() => {
      result.current.handleDuplicateDiffOpenChange(true);
    });

    expect(result.current.duplicateDiffState).toEqual({
      open: true,
      group: "grp-1",
      baseKey: "row-1",
      compareKey: "row-2",
    });
    expect(result.current.duplicateDiffGroupLabel).toBe("Group grp-1");
    expect(result.current.duplicateDiffBaseLabel).toBe("Label row-1");
    expect(result.current.duplicateDiffCompareLabel).toBe("Label row-2");
    expect(result.current.duplicateDiffChangedCount).toBe(1);
  });

  it("swaps the active base and compare keys", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterDuplicateDiff(props));

    act(() => {
      result.current.handleOpenDuplicateDiff("grp-1", "row-1", "row-2");
      result.current.handleSwapDuplicateDiff();
    });

    expect(result.current.duplicateDiffState.baseKey).toBe("row-2");
    expect(result.current.duplicateDiffState.compareKey).toBe("row-1");
  });

  it("reconciles diff selections when duplicate items change", () => {
    const initialProps = createProps({
      duplicate11Details: [createGroup("grp-1", ["row-1", "row-2"])],
    });
    const { result, rerender } = renderHook(
      ({ hookProps }) => useDataImporterDuplicateDiff(hookProps),
      { initialProps: { hookProps: initialProps } }
    );

    act(() => {
      result.current.handleOpenDuplicateDiff("grp-1", "row-1", "row-2");
    });

    rerender({
      hookProps: createProps({
        duplicate11Details: [createGroup("grp-1", ["row-1", "row-3"])],
      }),
    });

    expect(result.current.duplicateDiffState).toEqual({
      open: true,
      group: "grp-1",
      baseKey: "row-1",
      compareKey: "row-3",
    });
  });
});
