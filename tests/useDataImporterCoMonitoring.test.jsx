import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import useDataImporterCoMonitoring from "@/components/dataImporter/useDataImporterCoMonitoring.js";

describe("useDataImporterCoMonitoring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads co-code and discrepancy configs on mount", async () => {
    const fetchWithAuth = vi.fn(async (url) => {
      if (url === "/api/import/co-codes") {
        return {
          ok: true,
          json: async () => ({
            config: {
              whitelist: ["A01", "B02"],
              blacklist: ["X99"],
              updatedAt: "2026-03-11T00:00:00.000Z",
              updatedBy: "tester",
            },
          }),
        };
      }

      if (url === "/api/import/co-discrepancy") {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: true,
              cron: "0 6 * * *",
              rangeDays: 5,
              threshold: 12,
              sampleLimit: 25,
            },
            state: {
              status: "warning",
              mismatches: [{ declarationNo: "TK-01" }],
            },
          }),
        };
      }

      throw new Error(`Unexpected url ${url}`);
    });

    const { result } = renderHook(() =>
      useDataImporterCoMonitoring({
        canManageSync: true,
        fetchWithAuth,
      })
    );

    await waitFor(() => {
      expect(result.current.coCodeConfig?.whitelist).toEqual(["A01", "B02"]);
      expect(result.current.coCodeForm).toEqual({
        whitelist: "A01\nB02",
        blacklist: "X99",
      });
      expect(result.current.coDiscrepancyForm).toEqual({
        enabled: true,
        cron: "0 6 * * *",
        rangeDays: 5,
        threshold: 12,
        sampleLimit: 25,
      });
      expect(result.current.coDiscrepancyState).toEqual({
        lastRunAt: null,
        range: null,
        mismatchCount: 1,
        totalChecked: 0,
        status: "warning",
        error: null,
        durationMs: 0,
        mismatches: [{ declarationNo: "TK-01" }],
        triggered: false,
        limited: false,
        actor: null,
        reason: null,
      });
      expect(result.current.coDiscrepancyStatusLabel).toBe("Có chênh lệch");
    });
  });

  it("saves co-code config and runs discrepancy manually", async () => {
    const fetchWithAuth = vi.fn(async (url, options = {}) => {
      if (url === "/api/import/co-codes" && !options.method) {
        return {
          ok: true,
          json: async () => ({
            config: {
              whitelist: [],
              blacklist: [],
            },
          }),
        };
      }

      if (url === "/api/import/co-discrepancy" && !options.method) {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: false,
              cron: "",
              rangeDays: 3,
              threshold: 10,
              sampleLimit: 0,
            },
            state: null,
          }),
        };
      }

      if (url === "/api/import/co-codes" && options.method === "PUT") {
        return {
          ok: true,
          json: async () => ({
            config: {
              whitelist: ["A01", "B02"],
              blacklist: ["X99"],
            },
          }),
        };
      }

      if (url === "/api/import/co-discrepancy/run" && options.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            result: {
              config: {
                enabled: true,
                cron: "0 4 * * *",
                rangeDays: 7,
                threshold: 20,
                sampleLimit: 100,
              },
              state: {
                lastRunAt: "2026-03-11T05:00:00.000Z",
                range: {
                  from: "2026-03-01",
                  to: "2026-03-05",
                },
                mismatchCount: 1,
                totalChecked: 2,
                status: "ok",
                error: null,
                durationMs: 4500,
                mismatches: [{ declarationNo: "TK-02" }],
                triggered: false,
                limited: true,
                actor: "tester",
                reason: "manual",
              },
            },
          }),
        };
      }

      throw new Error(`Unexpected request ${url} ${options.method || "GET"}`);
    });

    const { result } = renderHook(() =>
      useDataImporterCoMonitoring({
        canManageSync: true,
        fetchWithAuth,
      })
    );

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "/api/import/co-codes",
        expect.objectContaining({ cache: "no-store", credentials: "include" })
      );
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "/api/import/co-discrepancy",
        expect.objectContaining({ cache: "no-store", credentials: "include" })
      );
    });

    await act(async () => {
      result.current.setCoCodeForm({
        whitelist: "A01, B02",
        blacklist: "X99",
      });
    });

    await act(async () => {
      await result.current.handleSaveCoCodeConfig();
    });

    expect(fetchWithAuth).toHaveBeenCalledWith(
      "/api/import/co-codes",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          config: {
            whitelist: ["A01", "B02"],
            blacklist: ["X99"],
          },
        }),
      })
    );
    expect(result.current.coCodeMessage).toBe("Đã lưu cấu hình mã ưu đãi C/O.");

    await act(async () => {
      result.current.setCoDiscrepancyRange({ from: "2026-03-01", to: "2026-03-05" });
    });

    await act(async () => {
      await result.current.handleRunCoDiscrepancy();
    });

    expect(fetchWithAuth).toHaveBeenCalledWith(
      "/api/import/co-discrepancy/run",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          range: {
            from: "2026-03-01",
            to: "2026-03-05",
          },
        }),
      })
    );
    expect(result.current.coDiscrepancyMessage).toBe(
      "Đã chạy đối soát C/O: phát hiện 1 chênh lệch trên 2 tờ khai, đã cắt bớt danh sách do vượt giới hạn mẫu."
    );
    expect(result.current.coDiscrepancyStatusLabel).toBe("Có chênh lệch");
    expect(result.current.coDiscrepancyState).toEqual({
      lastRunAt: "2026-03-11T05:00:00.000Z",
      range: {
        from: "2026-03-01",
        to: "2026-03-05",
      },
      mismatchCount: 1,
      totalChecked: 2,
      status: "ok",
      error: null,
      durationMs: 4500,
      mismatches: [{ declarationNo: "TK-02" }],
      triggered: false,
      limited: true,
      actor: "tester",
      reason: "manual",
    });
  });
});
