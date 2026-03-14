import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import useDataImporterOverview from "@/components/dataImporter/useDataImporterOverview.js";

describe("useDataImporterOverview", () => {
  it("builds saved-mode summary cards and outstanding alerts", () => {
    const { result } = renderHook(() =>
      useDataImporterOverview({
        rawRows: [
          { id: 1, nhan_vien: "An", team: "OPS", reviewed: true },
          { id: 2, nhan_vien: "", team: "", reviewed: false, deleted_at: "2026-03-10T00:00:00.000Z" },
          { id: 3, nhan_vien: "", team: "CS", reviewed: false },
        ],
        mode: "saved",
        showDeletedRows: false,
        alertSummary: {
          outstanding: 4,
          lastEvaluatedAt: "2026-03-11T09:00:00.000Z",
        },
        alertEntries: [
          { id: "a-1", resolved: false },
          { id: "a-2", resolved: true },
          { id: "a-3", resolved: false },
        ],
        syncConfig: {
          lastRun: "2026-03-11T08:30:00.000Z",
          lastSummary: {
            range: { from: "2026-03-01", to: "2026-03-10" },
            runAt: "2026-03-11T08:00:00.000Z",
          },
        },
        formatDateRangeLabel: ({ from, to }) => `${from} -> ${to}`,
        formatDisplayDate: (value) => `DATE:${value}`,
      }),
    );

    expect(result.current.summaryStats).toEqual({
      total: 2,
      missingStaff: 1,
      missingTeam: 0,
      reviewed: 1,
    });
    expect(result.current.summaryCards).toEqual([
      { label: "Tổng tờ khai (đang xem)", value: 2 },
      { label: "Chưa gán nhân viên", value: 1 },
      { label: "Chưa gán tổ đội", value: 0 },
      { label: "Đã rà soát", value: 1 },
      { label: "Cảnh báo chờ xử lý", value: 4 },
    ]);
    expect(result.current.outstandingAlerts).toEqual([
      { id: "a-1", resolved: false },
      { id: "a-3", resolved: false },
    ]);
    expect(result.current.lastSyncSummary).toEqual({
      range: { from: "2026-03-01", to: "2026-03-10" },
      runAt: "2026-03-11T08:00:00.000Z",
    });
    expect(result.current.lastSyncRangeLabel).toBe("2026-03-01 -> 2026-03-10");
    expect(result.current.lastSyncRunAtLabel).toBe("DATE:2026-03-11T08:00:00.000Z");
  });

  it("falls back gracefully when alert and sync timestamps are missing or invalid", () => {
    const { result } = renderHook(() =>
      useDataImporterOverview({
        rawRows: [],
        mode: "preview",
        showDeletedRows: false,
        alertSummary: {
          outstanding: 0,
          lastEvaluatedAt: "khong-hop-le",
        },
        alertEntries: [],
        syncConfig: {
          lastRun: "invalid-run-at",
          lastSummary: null,
        },
        formatDateRangeLabel: () => "",
        formatDisplayDate: () => "",
      }),
    );

    expect(result.current.summaryStats).toEqual({
      total: 0,
      missingStaff: 0,
      missingTeam: 0,
      reviewed: 0,
    });
    expect(result.current.lastAlertEvaluated).toBe("khong-hop-le");
    expect(result.current.syncLastRunLabel).toBe("invalid-run-at");
    expect(result.current.lastSyncSummary).toBeNull();
    expect(result.current.lastSyncRangeLabel).toBe("");
    expect(result.current.lastSyncRunAtLabel).toBe("");
  });
});
