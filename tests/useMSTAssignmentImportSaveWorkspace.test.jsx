import React, { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  getMSTMap: vi.fn(),
  upsertMSTRows: vi.fn(),
}));

vi.mock("@/lib/store.js", async () => {
  const actual = await vi.importActual("@/lib/store.js");
  return {
    ...actual,
    getMSTMap: storeMocks.getMSTMap,
    upsertMSTRows: storeMocks.upsertMSTRows,
  };
});

import useMSTAssignmentImportSaveWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentImportSaveWorkspace.js";

function createRowState(row, meta = {}) {
  return {
    ...row,
    __originalKey: meta.originalKey ?? null,
    __isNew: Boolean(meta.isNew),
  };
}

function makeRowKey(row) {
  return `${row?.mst || ""}__${row?.effective_from || ""}__${row?.effective_to || ""}`;
}

function createHelpers() {
  return {
    createRowState,
    findCell: (row, key) => row?.[key],
    makeRowKey,
    normalizeStatusLabel: (value) => String(value || "").trim(),
    tidyMST: (value) => String(value || "").replace(/\D/g, ""),
    toISO: (value) => String(value || "").trim(),
  };
}

function createWorkbookFile(name = "mst-import.xlsx") {
  return {
    name,
    arrayBuffer: vi.fn(async () => new ArrayBuffer(16)),
  };
}

describe("useMSTAssignmentImportSaveWorkspace", () => {
  beforeEach(() => {
    storeMocks.getMSTMap.mockReset();
    storeMocks.upsertMSTRows.mockReset();
  });

  it("imports workbook rows into the local working set and clears the selected file", async () => {
    const alertFn = vi.fn();
    const goToFirstPage = vi.fn();
    const workbookFile = createWorkbookFile();
    const xlsx = {
      read: vi.fn(() => ({
        SheetNames: ["Sheet1"],
        Sheets: { Sheet1: {} },
      })),
      utils: {
        sheet_to_json: vi.fn(() => [
          {
            mst: "0101234567",
            company: "Công ty A",
            person_import: "Lan",
            person_export: "Bình",
            team: "OPS",
            effective_from: "2025-03-01",
            effective_to: "",
            status: "assigned",
          },
        ]),
      },
    };

    const { result } = renderHook(() => {
      const [rows, setRows] = useState([
        createRowState(
          {
            mst: "0109999999",
            company: "Công ty Cũ",
            person_import: "Minh",
            person_export: "",
            team: "OPS",
            effective_from: "2025-01-01",
            effective_to: "",
            status: "pending",
          },
          { originalKey: "0109999999__2025-01-01__", isNew: false }
        ),
      ]);
      const [originalRows, setOriginalRows] = useState([]);
      const [recentlyImportedKeys, setRecentlyImportedKeys] = useState(new Set());

      const workspace = useMSTAssignmentImportSaveWorkspace({
        actor: "tester",
        applyFrom: "",
        helpers: createHelpers(),
        isReadOnly: false,
        refreshHistory: vi.fn(),
        rows,
        setOriginalRows,
        setRecentlyImportedKeys,
        setRows,
        goToFirstPage,
        alertFn,
        xlsx,
      });

      return {
        rows,
        originalRows,
        recentlyImportedKeys,
        ...workspace,
      };
    });

    act(() => {
      result.current.fileRef.current = {
        files: [workbookFile],
        value: "C:\\fakepath\\mst-import.xlsx",
      };
      result.current.handleFileChange({
        target: {
          files: [{ name: "mst-import.xlsx" }],
        },
      });
    });

    expect(result.current.selectedFileName).toBe("mst-import.xlsx");

    await act(async () => {
      await result.current.onImportXLSX();
    });

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2);
    });

    expect(result.current.rows[0]).toMatchObject({
      mst: "0101234567",
      company: "Công ty A",
      person_import: "Lan",
      status: "assigned",
      __isNew: true,
    });
    expect(goToFirstPage).toHaveBeenCalledTimes(1);
    expect(alertFn).toHaveBeenCalledWith("Đọc file thành công: 1 dòng. Bấm Lưu để ghi.");
    expect(result.current.recentlyImportedKeys.has("0101234567__2025-03-01__")).toBe(true);
    expect(result.current.fileRef.current.value).toBe("");
    expect(result.current.selectedFileName).toBe("");
  });

  it("saves the current working set and resets imported highlights", () => {
    const alertFn = vi.fn();
    const refreshHistory = vi.fn();

    storeMocks.getMSTMap.mockReturnValue([
      {
        mst: "0101234567",
        company: "Công ty A",
        person_import: "Lan",
        person_export: "",
        team: "OPS",
        effective_from: "2025-03-01",
        effective_to: "",
        status: "assigned",
      },
    ]);

    const { result } = renderHook(() => {
      const [rows, setRows] = useState([
        createRowState(
          {
            mst: "0101234567",
            company: "Công ty A",
            person_import: "Lan",
            person_export: "",
            team: "OPS",
            effective_from: "2025-03-01",
            effective_to: "",
            status: "assigned",
          },
          { originalKey: null, isNew: true }
        ),
      ]);
      const [originalRows, setOriginalRows] = useState([]);
      const [recentlyImportedKeys, setRecentlyImportedKeys] = useState(
        new Set(["0101234567__2025-03-01__"])
      );

      const workspace = useMSTAssignmentImportSaveWorkspace({
        actor: "tester",
        applyFrom: "",
        helpers: createHelpers(),
        isReadOnly: false,
        refreshHistory,
        rows,
        setOriginalRows,
        setRecentlyImportedKeys,
        setRows,
        goToFirstPage: vi.fn(),
        alertFn,
      });

      return {
        rows,
        originalRows,
        recentlyImportedKeys,
        ...workspace,
      };
    });

    act(() => {
      result.current.onSave();
    });

    expect(storeMocks.upsertMSTRows).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          mst: "0101234567",
          company: "Công ty A",
          __isNew: true,
        }),
      ],
      expect.objectContaining({
        actor: "tester",
        detail: "Cập nhật gán MST từ giao diện",
      })
    );
    expect(refreshHistory).toHaveBeenCalledTimes(1);
    expect(result.current.originalRows).toHaveLength(1);
    expect(result.current.originalRows[0]).toMatchObject({
      mst: "0101234567",
      __originalKey: "0101234567__2025-03-01__",
      __isNew: false,
    });
    expect(result.current.recentlyImportedKeys.size).toBe(0);
    expect(alertFn).toHaveBeenCalledWith("Lưu thành công!");
  });
});
