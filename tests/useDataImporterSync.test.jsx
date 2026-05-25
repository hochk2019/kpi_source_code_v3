import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import {
  createSyncJob,
  createSyncProgressSteps,
  writeStoredSyncJobState,
} from "@/components/dataImporter/dataImporterSyncQueue.js";
import useDataImporterSync from "@/components/dataImporter/useDataImporterSync.js";

const dialogMocks = vi.hoisted(() => ({
  confirm: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => dialogMocks,
}));

const ECUS_CONFIG_ROUTE = "/api/v4/declarations/imports/ecus-config";
const ECUS_COMMIT_ROUTE = "/api/v4/declarations/imports/ecus-commit";
const ECUS_COMMIT_JOB_ROUTE = "/api/v4/declarations/imports/ecus-jobs";
const ECUS_PREVIEW_ROUTE = "/api/v4/declarations/imports/ecus-preview";
const ECUS_STATUS_ROUTE = "/api/v4/declarations/imports/ecus-status";
const ALERTS_ROUTE = "/api/v4/declarations/imports/alerts";

function getSyncStep(steps, key) {
  return steps.find((step) => step.key === key);
}

describe("useDataImporterSync", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    dialogMocks.confirm.mockResolvedValue(true);
    window.localStorage.clear();
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
      expect(result.current.syncPreflightSummary).toEqual({
        ready: true,
        blockingCount: 0,
        warningCount: 1,
      });
    });
  });

  it("resumes from the first incomplete post-commit phase instead of re-running ECUS commit", async () => {
    const progressSteps = createSyncProgressSteps().map((step) =>
      step.key === "commit"
        ? {
            ...step,
            status: "done",
            detail: "Đã nhập 5 mới, cập nhật 1, bỏ qua 0, khóa 0.",
          }
        : step,
    );
    const interruptedJob = {
      ...createSyncJob({
        actor: "tester",
        manualRange: { from: "2026-03-01", to: "2026-03-05" },
      }),
      status: "running",
      currentStepKey: "reconcile",
      attemptCount: 1,
      progressSteps,
      resultSummary: {
        imported: 5,
        updated: 1,
        skipped: 0,
        reviewLocked: 0,
      },
    };

    writeStoredSyncJobState({
      activeJob: interruptedJob,
      resumableJob: null,
      lastJob: null,
      jobHistory: [],
    });

    const refreshDeclRowsFromServer = vi.fn(async () => new Array(6).fill(null));
    const loadSavedRows = vi.fn(() => true);
    const fetchWithAuth = vi.fn(async (url) => {
      if (url === ECUS_CONFIG_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: true,
              schedule: "0 * * * *",
              rangeDays: 1,
              preferMonthFirst: false,
              connection: {
                server: "srv01",
                database: "ecus",
                user: "runner",
                hasPassword: true,
              },
              includeTaxCodes: [],
              excludeTaxCodes: [],
            },
          }),
        };
      }

      if (url === ECUS_STATUS_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            backend: { ok: true },
            database: { ok: true },
          }),
        };
      }

      if (url === ALERTS_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            alerts: [],
            summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null },
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
        refreshDeclRowsFromServer,
        loadSavedRows,
      }),
    );

    await waitFor(() => {
      expect(result.current.syncResumeJob).not.toBeNull();
      expect(result.current.syncPreflightSummary?.ready).toBe(true);
    });

    expect(result.current.syncResumeLabel).toContain("Tiếp tục từ bước: Làm mới cấu hình, trạng thái và cảnh báo.");

    await act(async () => {
      await result.current.handleResumeSync();
    });

    expect(fetchWithAuth.mock.calls.filter(([url]) => url === ECUS_COMMIT_ROUTE)).toHaveLength(0);
    expect(refreshDeclRowsFromServer).toHaveBeenCalledTimes(1);
    expect(loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(getSyncStep(result.current.syncProgressSteps, "commit")?.status).toBe("done");
    expect(getSyncStep(result.current.syncProgressSteps, "reconcile")?.status).toBe("done");
    expect(result.current.syncMessage).toContain("Đã đồng bộ 5 tờ khai mới từ ECUS, cập nhật 1 tờ khai đã có.");
    expect(result.current.syncResumeJob).toBeNull();
    expect(result.current.syncHistory[0]).toMatchObject({
      status: "completed",
      resultSummary: expect.objectContaining({
        imported: 5,
        updated: 1,
        affectedRows: 6,
      }),
    });
  });

  it("resumes a detached backend commit job by polling job status instead of re-submitting commit", async () => {
    const progressSteps = createSyncProgressSteps().map((step) =>
      step.key === "commit"
        ? {
            ...step,
            status: "active",
            detail: "Đang xử lý commit trên backend.",
          }
        : step,
    );
    const interruptedJob = {
      ...createSyncJob({
        actor: "tester",
        manualRange: { from: "2026-03-01", to: "2026-03-05" },
      }),
      status: "running",
      currentStepKey: "commit",
      attemptCount: 1,
      backendJobId: "ecus-sync-job-001",
      backendJobStatus: "running",
      progressSteps,
    };

    writeStoredSyncJobState({
      activeJob: interruptedJob,
      resumableJob: null,
      lastJob: null,
      jobHistory: [],
    });

    let pollCount = 0;
    const refreshDeclRowsFromServer = vi.fn(async () => new Array(3).fill(null));
    const loadSavedRows = vi.fn(() => true);
    const fetchWithAuth = vi.fn(async (url, options = {}) => {
      if (url === ECUS_CONFIG_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: true,
              schedule: "0 * * * *",
              rangeDays: 1,
              preferMonthFirst: false,
              connection: {
                server: "srv01",
                database: "ecus",
                user: "runner",
                hasPassword: true,
              },
              includeTaxCodes: [],
              excludeTaxCodes: [],
            },
          }),
        };
      }

      if (url === ECUS_STATUS_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            backend: { ok: true },
            database: { ok: true },
          }),
        };
      }

      if (url === ALERTS_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            alerts: [],
            summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null },
          }),
        };
      }

      if (url === `${ECUS_COMMIT_JOB_ROUTE}/ecus-sync-job-001`) {
        pollCount += 1;
        const status = pollCount >= 2 ? "completed" : "running";
        return {
          ok: true,
          json: async () => ({
            ok: true,
            job: {
              id: "ecus-sync-job-001",
              status,
              updatedAt: "2026-03-30T01:02:03.000Z",
              result:
                status === "completed"
                  ? {
                      fetched: 3,
                      imported: 2,
                      updated: 1,
                      skipped: 0,
                      reviewLocked: 0,
                    }
                  : null,
            },
          }),
        };
      }

      if (url === ECUS_COMMIT_ROUTE && options.method === "POST") {
        throw new Error("Should not submit commit again when backend job already exists");
      }

      throw new Error(`Unexpected url ${url}`);
    });

    const { result } = renderHook(() =>
      useDataImporterSync({
        actor: "tester",
        canManageSync: true,
        fetchWithAuth,
        refreshDeclRowsFromServer,
        loadSavedRows,
      }),
    );

    await waitFor(() => {
      expect(result.current.syncResumeJob).not.toBeNull();
      expect(result.current.syncPreflightSummary?.ready).toBe(true);
    });

    await act(async () => {
      await result.current.handleResumeSync();
    });

    expect(fetchWithAuth.mock.calls.filter(([url]) => url === ECUS_COMMIT_ROUTE)).toHaveLength(0);
    expect(fetchWithAuth.mock.calls.filter(([url]) => url === `${ECUS_COMMIT_JOB_ROUTE}/ecus-sync-job-001`).length).toBeGreaterThanOrEqual(2);
    expect(refreshDeclRowsFromServer).toHaveBeenCalledTimes(1);
    expect(loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(result.current.syncResumeJob).toBeNull();
    expect(result.current.syncHistory[0]).toMatchObject({
      status: "completed",
      resultSummary: expect.objectContaining({
        imported: 2,
        updated: 1,
      }),
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
          async: true,
        }),
      })
    );
    expect(refreshDeclRowsFromServer).toHaveBeenCalledTimes(1);
    expect(loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(result.current.syncMessage).toBe(
      "Đã đồng bộ 4 tờ khai mới từ ECUS, cập nhật 2 tờ khai đã có, bỏ qua 1 tờ khai đã có, khóa 2 tờ khai đã rà soát. Lọc theo chỉ MST: 0312345678; loại trừ MST: 0399999999."
    );
    expect(getSyncStep(result.current.syncProgressSteps, "commit")).toMatchObject({
      status: "done",
      detail: "Đã nhập 4 mới, cập nhật 2, bỏ qua 1, khóa 2.",
    });
    expect(getSyncStep(result.current.syncProgressSteps, "reconcile")).toMatchObject({
      status: "done",
    });
    expect(getSyncStep(result.current.syncProgressSteps, "refreshDeclRows")).toMatchObject({
      status: "done",
    });
    expect(getSyncStep(result.current.syncProgressSteps, "reloadSavedRows")).toMatchObject({
      status: "done",
      detail: "Danh sách tờ khai trên giao diện đã được làm mới.",
    });
    expect(result.current.syncActivityLog.at(-1)?.message).toContain("đã hoàn tất");
    expect(result.current.syncHistory[0]).toMatchObject({
      actor: "tester",
      status: "completed",
      from: "2026-03-01",
      to: "2026-03-05",
      resultSummary: {
        imported: 4,
        updated: 2,
        skipped: 1,
        reviewLocked: 2,
        affectedRows: 6,
        previewedRows: 9,
      },
    });
  });

  it("keeps the sync successful while surfacing a failed declaration refresh step", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const refreshDeclRowsFromServer = vi.fn(async () => {
      throw new Error("Không thể tải lại tờ khai");
    });
    const loadSavedRows = vi.fn(() => true);

    const fetchWithAuth = vi.fn(async (url, options = {}) => {
      if (url === ECUS_CONFIG_ROUTE && !options.method) {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: true,
              schedule: "0 * * * *",
              rangeDays: 1,
              preferMonthFirst: false,
              connection: {
                server: "srv01",
                database: "ecus",
                user: "runner",
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

      if (url === ECUS_COMMIT_ROUTE && options.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            result: {
              imported: 2,
              updated: 0,
              skipped: 0,
              reviewLocked: 0,
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
      result.current.setManualRange({ from: "2026-03-01", to: "2026-03-05" });
    });

    await act(async () => {
      await result.current.handleRunSync();
    });

    expect(result.current.syncMessage).toBe("Đã đồng bộ 2 tờ khai mới từ ECUS.");
    expect(result.current.syncError).toBe("");
    expect(loadSavedRows).toHaveBeenCalledWith({ bypassConfirm: true });
    expect(getSyncStep(result.current.syncProgressSteps, "refreshDeclRows")).toMatchObject({
      status: "error",
      detail: "Không thể tải lại tờ khai",
    });
    expect(getSyncStep(result.current.syncProgressSteps, "reloadSavedRows")).toMatchObject({
      status: "done",
    });
  });

  it("preserves fetched preview totals from the server preview payload", async () => {
    const previewRange = { from: "2026-03-10", to: "2026-03-12" };
    const previewRows = [
      { so_tk: "00000012345", status: "new", locked: false, changedFields: [] },
      {
        so_tk: "00000067890",
        status: "existing",
        locked: false,
        changedFields: ["nhan_vien"],
      },
    ];
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
    expect(result.current.previewConflictSummary).toEqual({
      totalRows: 2,
      newCount: 1,
      existingCount: 1,
      overwriteCount: 1,
      unchangedCount: 0,
      lockedCount: 0,
    });
    expect(result.current.previewConflictWarningActive).toBe(true);
  });

  it("asks for confirmation before overwriting existing declarations from preview conflicts", async () => {
    dialogMocks.confirm.mockResolvedValue(false);
    const fetchWithAuth = vi.fn(async (url, options = {}) => {
      if (url === ECUS_CONFIG_ROUTE && !options.method) {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: true,
              schedule: "0 * * * *",
              rangeDays: 1,
              preferMonthFirst: false,
              connection: {
                server: "srv01",
                database: "ecus",
                user: "runner",
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
            backend: { ok: true },
            database: { ok: true },
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
              rows: [
                {
                  so_tk: "00000067890",
                  status: "existing",
                  locked: false,
                  changedFields: ["nhan_vien"],
                },
              ],
              fetched: 1,
              limited: false,
              range: { from: "2026-03-10", to: "2026-03-12" },
            },
          }),
        };
      }

      if (url === ECUS_COMMIT_ROUTE && options.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            result: {
              imported: 0,
              updated: 1,
              skipped: 0,
              reviewLocked: 0,
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
        refreshDeclRowsFromServer: vi.fn(async () => []),
        loadSavedRows: vi.fn(() => true),
      }),
    );

    await waitFor(() => {
      expect(result.current.syncPreflightSummary?.ready).toBe(true);
    });

    await act(async () => {
      result.current.setManualRange({ from: "2026-03-10", to: "2026-03-12" });
    });

    await act(async () => {
      await result.current.handlePreviewSync();
    });

    await act(async () => {
      await result.current.handleRunSync();
    });

    expect(dialogMocks.confirm).toHaveBeenCalledWith(
      expect.stringContaining("1 tờ khai đã tồn tại sẽ bị cập nhật"),
    );
    expect(fetchWithAuth).not.toHaveBeenCalledWith(
      ECUS_COMMIT_ROUTE,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("blocks sync runs when the preflight checklist is not ready", async () => {
    const fetchWithAuth = vi.fn(async (url) => {
      if (url === ECUS_CONFIG_ROUTE) {
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

      if (url === ECUS_STATUS_ROUTE) {
        return {
          ok: true,
          json: async () => ({
            backend: { state: "timeout", message: "backend-timeout" },
            database: { state: "timeout", message: "sql-timeout" },
          }),
        };
      }

      if (url === ALERTS_ROUTE) {
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

      throw new Error(`Unexpected url ${url}`);
    });

    const { result } = renderHook(() =>
      useDataImporterSync({
        actor: "tester",
        canManageSync: true,
        fetchWithAuth,
        refreshDeclRowsFromServer: vi.fn(),
        loadSavedRows: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(result.current.syncPreflightSummary?.ready).toBe(false);
    });

    await act(async () => {
      await result.current.handleRunSync();
    });

    expect(fetchWithAuth).not.toHaveBeenCalledWith(
      ECUS_COMMIT_ROUTE,
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.syncError).toContain("Checklist trước khi chạy chưa đạt yêu cầu");
  });

  it("retries retriable ECUS commit failures and persists a resumable job snapshot", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dialogMocks.confirm.mockResolvedValue(true);

    const refreshDeclRowsFromServer = vi.fn(async () => []);
    const loadSavedRows = vi.fn(() => true);
    const fetchWithAuth = vi.fn(async (url, options = {}) => {
      if (url === ECUS_CONFIG_ROUTE && !options.method) {
        return {
          ok: true,
          json: async () => ({
            config: {
              enabled: true,
              schedule: "0 * * * *",
              rangeDays: 1,
              preferMonthFirst: false,
              connection: {
                server: "srv01",
                database: "ecus",
                user: "runner",
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
            backend: { ok: true, checkedAt: "2026-03-11T01:00:00.000Z" },
            database: { ok: true, checkedAt: "2026-03-11T01:00:30.000Z" },
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

      if (url === ECUS_COMMIT_ROUTE && options.method === "POST") {
        const commitCallCount = fetchWithAuth.mock.calls.filter(
          ([calledUrl, calledOptions]) => calledUrl === ECUS_COMMIT_ROUTE && calledOptions?.method === "POST",
        ).length;

        if (commitCallCount < 2) {
          return { ok: false, status: 500 };
        }

        return {
          ok: true,
          json: async () => ({
            result: {
              imported: 3,
              updated: 0,
              skipped: 0,
              reviewLocked: 0,
            },
          }),
        };
      }

      throw new Error(`Unexpected request ${url} ${options.method || "GET"}`);
    });

    const { result, unmount } = renderHook(() =>
      useDataImporterSync({
        actor: "tester",
        canManageSync: true,
        fetchWithAuth,
        refreshDeclRowsFromServer,
        loadSavedRows,
      })
    );

    await waitFor(() => {
      expect(result.current.syncPreflightSummary?.ready).toBe(true);
    });

    let runPromise;
    await act(async () => {
      runPromise = result.current.handleRunSync();
      await runPromise;
    });

    expect(fetchWithAuth.mock.calls.filter(([url]) => url === ECUS_COMMIT_ROUTE)).toHaveLength(2);
    expect(result.current.syncMessage).toContain("Hoàn tất sau 2 lần thử");
    expect(
      result.current.syncActivityLog.some((entry) => entry.message.includes("Sẽ thử lại sau 1.5 giây")),
    ).toBe(true);

    const stored = JSON.parse(window.localStorage.getItem("data-importer-ecus-sync-job-v1"));
    expect(stored.lastJob.status).toBe("completed");

    unmount();

    window.localStorage.setItem(
      "data-importer-ecus-sync-job-v1",
      JSON.stringify({
        activeJob: stored.lastJob,
        resumableJob: null,
        lastJob: null,
      }),
    );

    const resumed = renderHook(() =>
      useDataImporterSync({
        actor: "tester",
        canManageSync: true,
        fetchWithAuth: vi.fn(async (url) => {
          if (url === ECUS_CONFIG_ROUTE) {
            return {
              ok: true,
              json: async () => ({
                config: {
                  enabled: true,
                  schedule: "0 * * * *",
                  rangeDays: 1,
                  preferMonthFirst: false,
                  connection: {
                    server: "srv01",
                    database: "ecus",
                    user: "runner",
                    hasPassword: true,
                  },
                  includeTaxCodes: [],
                  excludeTaxCodes: [],
                },
              }),
            };
          }

          if (url === ECUS_STATUS_ROUTE) {
            return {
              ok: true,
              json: async () => ({
                backend: { ok: true },
                database: { ok: true },
              }),
            };
          }

          if (url === ALERTS_ROUTE) {
            return {
              ok: true,
              json: async () => ({ alerts: [], summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null } }),
            };
          }

          throw new Error(`Unexpected url ${url}`);
        }),
        refreshDeclRowsFromServer: vi.fn(),
        loadSavedRows: vi.fn(),
      })
    );

    await waitFor(() => {
      expect(resumed.result.current.syncResumeJob).not.toBeNull();
      expect(resumed.result.current.syncPreflightSummary?.ready).toBe(true);
    });

    expect(resumed.result.current.syncResumeLabel).toContain("Job lưu lúc");
    resumed.unmount();
  });
});
