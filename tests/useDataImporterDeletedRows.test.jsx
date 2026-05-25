import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import useDataImporterDeletedRows from "@/components/dataImporter/useDataImporterDeletedRows.js";

function createProps(overrides = {}) {
  return {
    searchRange: { from: "2026-03-01", to: "2026-03-05" },
    softDeletedRows: [],
    baseFilterInputs: {},
    fetchWithAuth: vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rows: [{ id: "hard-1", deleted_at: "2026-03-04T00:00:00.000Z" }],
      }),
    })),
    extractErrorMessage: vi.fn(async (_response, fallback) => fallback),
    filterDeclRows: vi.fn((rows) => rows),
    keyOfRow: (row) => row?.id ?? "",
    formatDateTime: (value) => `TIME:${value instanceof Date ? value.toISOString() : value}`,
    formatDisplayDate: (value) => `DATE:${value}`,
    formatDateRangeLabel: ({ from, to }) => `${from} -> ${to}`,
    ...overrides,
  };
}

describe("useDataImporterDeletedRows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches hard-deleted rows when the dialog opens and stores the returned rows", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterDeletedRows(props));

    act(() => {
      result.current.openDeletedDialog();
    });

    await waitFor(() => {
      expect(props.fetchWithAuth).toHaveBeenCalledWith(
        "/api/v4/declarations/imports/deleted-declarations?type=hard&from=2026-03-01&to=2026-03-05",
        expect.objectContaining({
          cache: "no-store",
          credentials: "include",
          signal: expect.any(AbortSignal),
        })
      );
      expect(result.current.deletedDialogOpen).toBe(true);
      expect(result.current.hardDeletedRows).toEqual([
        { id: "hard-1", deleted_at: "2026-03-04T00:00:00.000Z" },
      ]);
      expect(result.current.hardDeletedError).toBe("");
      expect(result.current.hardDeletedLoading).toBe(false);
    });
  });

  it("retries the current range when requested again after the first fetch completes", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterDeletedRows(props));

    act(() => {
      result.current.openDeletedDialog();
    });

    await waitFor(() => {
      expect(props.fetchWithAuth).toHaveBeenCalledTimes(1);
      expect(result.current.hardDeletedLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleHardDeletedRetry();
    });

    await waitFor(() => {
      expect(props.fetchWithAuth).toHaveBeenCalledTimes(2);
      expect(props.fetchWithAuth).toHaveBeenLastCalledWith(
        "/api/v4/declarations/imports/deleted-declarations?type=hard&from=2026-03-01&to=2026-03-05",
        expect.objectContaining({
          cache: "no-store",
          credentials: "include",
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  it("derives deleted-entry counts and range labels for the dialog", async () => {
    const props = createProps({
      softDeletedRows: [
        {
          id: "soft-1",
          so_tk: "10203040506",
          deleted_at: "2026-03-02T10:00:00.000Z",
          deleted_by: "tester",
        },
      ],
      fetchWithAuth: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          rows: [
            { id: "hard-1", so_tk: "55667788990", deleted_at: "2026-03-04T00:00:00.000Z", keep: true },
            { id: "hard-2", so_tk: "11111111111", deleted_at: "", keep: true },
            { id: "hard-3", so_tk: "22222222222", deleted_at: "2026-03-05T00:00:00.000Z", keep: false },
          ],
        }),
      })),
      filterDeclRows: vi.fn((rows) => rows.filter((row) => row.keep !== false)),
    });
    const { result } = renderHook(() => useDataImporterDeletedRows(props));

    act(() => {
      result.current.openDeletedDialog();
    });

    await waitFor(() => {
      expect(result.current.hardDeletedRows).toHaveLength(3);
      expect(result.current.filteredHardDeletedRows).toEqual([
        { id: "hard-1", so_tk: "55667788990", deleted_at: "2026-03-04T00:00:00.000Z", keep: true },
      ]);
      expect(result.current.softDeletedCount).toBe(1);
      expect(result.current.hardDeletedCount).toBe(1);
      expect(result.current.deletedTotalCount).toBe(2);
      expect(result.current.deletedRangeLabel).toBe("2026-03-01 -> 2026-03-05");
      expect(result.current.deletedEntries.map((entry) => entry.key)).toEqual(["hard:hard-1", "soft:soft-1"]);
    });
  });

  it("aborts the inflight request and clears loading when the dialog closes", async () => {
    let observedSignal = null;
    const fetchWithAuth = vi.fn(
      (_url, options = {}) =>
        new Promise((_resolve, reject) => {
          observedSignal = options.signal;
          options.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        })
    );

    const { result } = renderHook(() =>
      useDataImporterDeletedRows(
        createProps({
          fetchWithAuth,
        })
      )
    );

    act(() => {
      result.current.openDeletedDialog();
    });

    await waitFor(() => {
      expect(observedSignal).toBeInstanceOf(AbortSignal);
      expect(fetchWithAuth.mock.calls.length).toBeGreaterThan(0);
      expect(result.current.hardDeletedLoading).toBe(true);
    });

    const inflightSignal = observedSignal;

    act(() => {
      result.current.handleDeletedDialogOpenChange(false);
    });

    expect(inflightSignal?.aborted).toBe(true);

    await waitFor(() => {
      expect(result.current.deletedDialogOpen).toBe(false);
      expect(result.current.hardDeletedLoading).toBe(false);
    });
  });
});
