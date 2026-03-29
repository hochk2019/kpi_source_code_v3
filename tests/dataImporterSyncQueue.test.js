import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  appendSyncJobLog,
  buildSyncPreflightChecks,
  createSyncJob,
  createSyncProgressSteps,
  formatRetryDelayLabel,
  getSyncRetryDelayMs,
  isHealthySyncStatus,
  isRetriableSyncError,
  readStoredSyncJobState,
  summarizeSyncPreflight,
  updateSyncJobProgress,
  writeStoredSyncJobState,
} from "@/components/dataImporter/dataImporterSyncQueue.js";

describe("dataImporterSyncQueue", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("builds blocking and warning preflight checks from current sync state", () => {
    const checks = buildSyncPreflightChecks({
      statusInfo: {
        backend: { ok: true, message: "backend-ready" },
        database: { state: "timeout", message: "sql-timeout" },
      },
      syncForm: {
        server: "srv01",
        database: "ecus",
        user: "runner",
        hasPassword: true,
      },
      manualRange: { from: "", to: "" },
    });

    expect(checks).toEqual([
      expect.objectContaining({ key: "backend", status: "pass", blocking: true }),
      expect.objectContaining({ key: "database", status: "fail", blocking: true }),
      expect.objectContaining({ key: "connection", status: "pass", blocking: true }),
      expect.objectContaining({ key: "range", status: "warn", blocking: false }),
    ]);
    expect(summarizeSyncPreflight(checks)).toEqual({
      ready: false,
      blockingCount: 1,
      warningCount: 1,
    });
  });

  it("creates, updates, stores, and restores resumable jobs", () => {
    const createdJob = createSyncJob({
      actor: "tester",
      manualRange: { from: "2026-03-01", to: "2026-03-05" },
      includeTaxCodes: ["0312345678"],
      excludeTaxCodes: ["0399999999"],
      mstFilterNotice: "Lọc theo chỉ MST: 0312345678",
    });

    const progressedJob = appendSyncJobLog(
      updateSyncJobProgress(createdJob, "commit", "active", "Đang gửi yêu cầu đồng bộ tới ECUS."),
      "Đang chạy job đầu tiên.",
    );

    writeStoredSyncJobState({
      activeJob: progressedJob,
      resumableJob: null,
      lastJob: null,
    });

    const restored = readStoredSyncJobState();

    expect(restored.activeJob).toBeNull();
    expect(restored.resumableJob).toMatchObject({
      id: progressedJob.id,
      status: "resume_required",
      from: "2026-03-01",
      to: "2026-03-05",
    });
    expect(restored.resumableJob.logs.at(-1)?.message).toContain("Bạn có thể tiếp tục");
  });

  it("recognizes healthy statuses and retriable failures", () => {
    expect(isHealthySyncStatus({ ok: true })).toBe(true);
    expect(isHealthySyncStatus({ status: "ok" })).toBe(true);
    expect(isHealthySyncStatus({ state: "ready" })).toBe(true);
    expect(isHealthySyncStatus({ state: "timeout" })).toBe(false);

    expect(isRetriableSyncError(new Error("HTTP 500"))).toBe(true);
    expect(isRetriableSyncError(new Error("HTTP 429"))).toBe(true);
    expect(isRetriableSyncError(new Error("Failed to fetch"))).toBe(true);
    expect(isRetriableSyncError(new Error("HTTP 400"))).toBe(false);

    expect(getSyncRetryDelayMs(0)).toBe(1500);
    expect(getSyncRetryDelayMs(1)).toBe(5000);
    expect(getSyncRetryDelayMs(2)).toBeNull();
    expect(formatRetryDelayLabel(1500)).toBe("1.5 giây");
    expect(formatRetryDelayLabel(5000)).toBe("5 giây");
  });

  it("creates default progress steps for all ECUS phases", () => {
    expect(createSyncProgressSteps()).toEqual([
      expect.objectContaining({ key: "commit", status: "pending" }),
      expect.objectContaining({ key: "reconcile", status: "pending" }),
      expect.objectContaining({ key: "refreshDeclRows", status: "pending" }),
      expect.objectContaining({ key: "reloadSavedRows", status: "pending" }),
    ]);
  });
});
