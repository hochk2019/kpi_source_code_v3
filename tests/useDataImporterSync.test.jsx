import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import useDataImporterSync from "@/components/dataImporter/useDataImporterSync.js";

const ECUS_CONFIG_ROUTE = "/api/v4/declarations/imports/ecus-config";
const ECUS_COMMIT_ROUTE = "/api/v4/declarations/imports/ecus-commit";
const ECUS_PREVIEW_ROUTE = "/api/v4/declarations/imports/ecus-preview";
const ECUS_STATUS_ROUTE = "/api/v4/declarations/imports/ecus-status";
const ALERTS_ROUTE = "/api/v4/declarations/imports/alerts";

describe("useDataImporterSync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads sync config, status, and alerts on mount", async () => {
    const fetchWithAuth = vi.fn(async (url) => {
      if (url === ECUS_CONFIG_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: true,
              schedule: "0 5 * * *",
              rangeDays: 2,
              preferMonthFirst: true,
              connection: {
                server: "srv01",
                database: "ecus",
                user: "sync-user",
                hasPassword: true,
              },
              includeTaxCodes: ["0312345678"],
              excludeTaxCodes: ["0399999999"],
            },
          }),
        };
      }

      if (url === ECUS_STATUS_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            backend: { status: "ok", checkedAt: "2026-03-11T00:00:00.000Z" },
            database: { status: "ok", checkedAt: "2026-03-11T00:01:00.000Z" },
          }),
        };
      }

      if (url === ALERTS_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            alerts: [{ id: "a1", resolved: false }],
            summary: {
              outstanding: 1,
              totalTracked: 3,
              lastEvaluatedAt: "2026-03-11T00:02:00.000Z",
            },
          }),
        };
      }

      throw new Error(`Unexpected url ${url}`);
    });

    const { result } = renderHook(() =>
      useDataImporterSync({
        actor: "tester",
        canManageSync: true,
        fetchWithAuth,
        extractErrorMessage: async (_response, fallback) => fallback,
        refreshDeclRowsFromServer: vi.fn(),
        loadSavedRows: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.syncForm).toMatchObject({
        enabled: true,
        schedule: "0 5 * * *",
        rangeDays: 2,
        preferMonthFirst: true,
        server: "srv01",
        database: "ecus",
        user: "sync-user",
        hasPassword: true,
        includeTaxCodesText: "0312345678",
        excludeTaxCodesText: "0399999999",
      });
      expect(result.current.statusInfo.database).toEqual({
        status: "ok",
        checkedAt: "2026-03-11T00:01:00.000Z",
      });
      expect(result.current.alertSummary).toEqual({
        outstanding: 1,
        totalTracked: 3,
        lastEvaluatedAt: "2026-03-11T00:02:00.000Z",
      });
      expect(result.current.mstFilterNotice).toBe("Lọc theo chỉ MST: 0312345678; loại trừ MST: 0399999999");
    });
  });

  it("saves sync config and runs sync with follow-up refresh", async () => {
    const refreshDeclRowsFromServer = vi.fn(async () => {});
    const loadSavedRows = vi.fn(() => true);

    const fetchWithAuth = vi.fn(async (url, options = {}) => {
      if (url === ECUS_CONFIG_ROUTE && !options.method) {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: false,
              schedule: "0 * * * *",
              rangeDays: 1,
              preferMonthFirst: false,
              connection: {
                server: "",
                database: "",
                user: "",
                hasPassword: false,
              },
              includeTaxCodes: [],
              excludeTaxCodes: [],
            },
          }),
        };
      }

      if (url === ECUS_STATUS_ROUTE && !options.method) {
        return {
          ok: true,
          json: async () => ({
            backend: { status: "ok", checkedAt: "2026-03-11T01:00:00.000Z" },
            database: { status: "ok", checkedAt: "2026-03-11T01:00:30.000Z" },
          }),
        };
      }

      if (url === ALERTS_ROUTE && !options.method) {
        return {
          ok: true,
          json: async () => ({
            alerts: [],
            summary: {
              outstanding: 0,
              totalTracked: 0,
              lastEvaluatedAt: null,
            },
          }),
        };
      }

      if (url === ECUS_CONFIG_ROUTE && options.method === "PUT") {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: true,
              schedule: "0 6 * * *",
              rangeDays: 3,
              preferMonthFirst: true,
              connection: {
                server: "srv02",
                database: "ecus2",
                user: "runner",
                hasPassword: true,
              },
              includeTaxCodes: ["0312345678"],
              excludeTaxCodes: ["0399999999"],
            },
          }),
        };
      }

      if (url === ECUS_COMMIT_ROUTE && options.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            result: {
              imported: 4,
              updated: 2,
              skipped: 1,
              reviewLocked: 2,
            },
          }),
        };
      }

      throw new Error(`Unexpected request ${url} ${options.method || "GET"}`);
    });

    const { result } = renderHook(() =>
      useDataImporterSync({
        actor: "tester",
        canManageSync: true,
        fetchWithAuth,
        extractErrorMessage: async (_response, fallback) => fallback,
        refreshDeclRowsFromServer,
        loadSavedRows,
      })
    );

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        ECUS_CONFIG_ROUTE,
        expect.objectContaining({ cache: "no-store", credentials: "include" })
      );
    });

    await act(async () => {
      result.current.setSyncForm((prev) => ({
        ...prev,
        enabled: true,
        schedule: "0 6 * * *",
        rangeDays: 3,
        preferMonthFirst: true,
        server: "srv02",
        database: "ecus2",
        user: "runner",
        password: "secret",
        hasPassword: false,
        includeTaxCodesText: "0312345678",
        excludeTaxCodesText: "0399999999",
      }));
    });

    await act(async () => {
      await result.current.handleSaveSyncConfig();
    });

    expect(fetchWithAuth).toHaveBeenCalledWith(
      ECUS_CONFIG_ROUTE,
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          config: {
            enabled: true,
            schedule: "0 6 * * *",
            rangeDays: 3,
            preferMonthFirst: true,
            connection: {
              server: "srv02",
              database: "ecus2",
              user: "runner",
              password: "secret",
            },
            includeTaxCodes: ["0312345678"],
            excludeTaxCodes: ["0399999999"],
          },
          preservePassword: false,
        }),
      })
    );

    await act(async () => {
      result.current.setManualRange({ from: "2026-03-01", to: "2026-03-05" });
    });

    await act(async () => {
      await result.current.handleRunSync();
    });

    expect(fetchWithAuth).toHaveBeenCalledWith(
      ECUS_COMMIT_ROUTE,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          actor: "tester",
          from: "2026-03-01",
          to: "2026-03-05",
          includeTaxCodes: ["0312345678"],
          excludeTaxCodes: ["0399999999"],
        }),
      })
    );
    expect(refreshDeclRowsFromServer).toHaveBeenCalledTimes(1);
    expect(loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(result.current.syncMessage).toBe(
      "Đã đồng bộ 4 tờ khai mới từ ECUS, cập nhật 2 tờ khai đã có, bỏ qua 1 tờ khai đã có, khóa 2 tờ khai đã rà soát. Lọc theo chỉ MST: 0312345678; loại trừ MST: 0399999999."
    );
  });

  it("preserves fetched preview totals from the server preview payload", async () => {
    const previewRange = { from: "2026-03-10", to: "2026-03-12" };
    const previewRows = [{ so_tk: "00000012345" }, { so_tk: "00000067890" }];
    const fetchWithAuth = vi.fn(async (url, options = {}) => {
      if (url === ECUS_CONFIG_ROUTE && !options.method) {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: true,
              schedule: "0 5 * * *",
              rangeDays: 2,
              preferMonthFirst: true,
              connection: {
                server: "srv01",
                database: "ecus",
                user: "sync-user",
                hasPassword: true,
              },
              includeTaxCodes: [],
              excludeTaxCodes: [],
            },
          }),
        };
      }

      if (url === ECUS_STATUS_ROUTE && !options.method) {
        return {
          ok: true,
          json: async () => ({
            backend: { status: "ok", checkedAt: "2026-03-11T00:00:00.000Z" },
            database: { status: "ok", checkedAt: "2026-03-11T00:01:00.000Z" },
          }),
        };
      }

      if (url === ALERTS_ROUTE && !options.method) {
        return {
          ok: true,
          json: async () => ({
            alerts: [],
            summary: {
              outstanding: 0,
              totalTracked: 0,
              lastEvaluatedAt: null,
            },
          }),
        };
      }

      if (url === ECUS_PREVIEW_ROUTE && options.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            preview: {
              rows: previewRows,
              fetched: 125,
              limited: true,
              range: previewRange,
            },
          }),
        };
      }

      throw new Error(`Unexpected request ${url} ${options.method || "GET"}`);
    });

    const { result } = renderHook(() =>
      useDataImporterSync({
        actor: "tester",
        canManageSync: true,
        fetchWithAuth,
        extractErrorMessage: async (_response, fallback) => fallback,
        refreshDeclRowsFromServer: vi.fn(),
        loadSavedRows: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        ECUS_CONFIG_ROUTE,
        expect.objectContaining({ cache: "no-store", credentials: "include" })
      );
    });

    let previewResult;
    await act(async () => {
      previewResult = await result.current.handlePreviewSync();
    });

    expect(fetchWithAuth).toHaveBeenCalledWith(
      ECUS_PREVIEW_ROUTE,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })
    );
    expect(previewResult).toEqual({
      ok: true,
      rows: previewRows,
      fetched: 125,
      limited: true,
      range: previewRange,
    });
    expect(result.current.previewRows).toEqual(previewRows);
    expect(result.current.previewLimited).toBe(true);
    expect(result.current.previewRangeInfo).toEqual(previewRange);
  });
});
