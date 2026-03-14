import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildReportingViewModel,
  buildReportingSchedulesViewModel,
  createEmptyReportingViewModel,
  deleteReportingSchedule,
  fetchReportingViewModel,
  fetchReportingSchedules,
  mergeReportingScheduleItems,
  normalizeStoredReportingScheduleItems,
  saveReportingSchedule,
  subscribeReportingSchedules,
} from "../packages/api-client/src/reportingClient.js";
import * as storageClient from "@/lib/storageClient.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("reportingClient", () => {
  it("builds a ReportViewer-compatible model from reporting read responses", () => {
    const currentRules = {
      id: "boosted-kpi",
      name: "Boosted KPI",
      applyFrom: "2026-02-01",
      version: 3,
      serverOnlyRuleMeta: { etag: "rule-v3" },
      license: {
        exclude: {
          codes: ["ZN02", "HDGC"],
          agencies: [{ agency: "G&B", codes: ["ZB02"] }],
        },
      },
    };

    const duplicatedRow = {
      date: "2026-02-01",
      so_tk: "10234567890",
      mst: "0101234567",
      cong_ty: "Cong ty A",
      nhan_vien: "Lan",
      team: "Blue Team",
      licenseCodes: ["A11", " B22 "],
      licenseExcludedCodes: ["X01", ""],
      kpi: 3.5,
    };

    const report = buildReportingViewModel({
      currentRules,
      summary: {
        range: { from: "2026-02-01", to: "2026-02-28" },
        ruleSet: { id: "boosted-kpi", name: "Boosted KPI" },
        summary: { decls: 2, kpi: 5.5, serverOnlySummaryMeta: { etag: "summary-v1" } },
        trend: { series: [{ period: "02/2026", kpi: 5.5 }], topTeams: ["Blue Team"] },
        adjustments: {
          list: [{ id: "adj-1" }],
          applied: [
            {
              date: "2026-02-01",
              displayDate: "2026-02",
              so_tk: "Điểm bổ sung (10234567890)",
              loai_hinh: "Hỗ trợ",
              nhan_vien: "Lan",
              team: "Blue Team",
              kpi: 2,
              adjustment: {
                id: "adj-1",
                label: "Hỗ trợ thông quan",
                quantity: "1",
                unitPoints: "2",
                references: ["10234567890", ""],
                note: "Ghi chú test",
                serverOnlyAdjustmentMeta: { etag: "adj-v1" },
              },
            },
          ],
          totalPoints: 2,
          approvedCount: 1,
          appliedCount: 1,
          pendingCount: 0,
          rejectedCount: 0,
          totals: { support: { points: "2", quantity: "1" } },
        },
        companies: {
          staff: [
            {
              mst: "0101234567",
              cong_ty: "Cong ty A",
              staff: "Lan",
              decls: 1,
              items: 10,
              licenses: 0,
              kpi: 3.5,
            },
          ],
          teams: [
            {
              mst: "0101234567",
              cong_ty: "Cong ty A",
              team: "Blue Team",
              staff: "Lan",
              decls: 1,
              items: 10,
              licenses: 0,
              kpi: 3.5,
            },
          ],
        },
      },
      staff: {
        keysHash: "lan|minh",
        items: [
          {
            key: "lan",
            name: "Lan",
            serverOnly: { etag: "staff-lan-v1" },
            stats: {
              licenseCodes: ["GCN01", "  ", "GCN02"],
            },
            adjustmentSummary: {
              support: { key: "support", points: "2", quantity: "1" },
              tax: { key: "tax", points: "-1", quantity: "1" },
            },
            rows: [
              duplicatedRow,
              {
                isAdjustment: true,
                kpi: 2,
              },
              {
                isAdjustment: true,
                kpi: 0,
              },
            ],
            companies: [
              {
                mst: "0101234567",
                cong_ty: "Cong ty A",
                decls: 1,
                items: 10,
                licenses: 0,
                kpi: 3.5,
              },
            ],
          },
          {
            key: "minh",
            name: "Minh",
            rows: [
              duplicatedRow,
              {
                date: "2026-02-03",
                so_tk: "20234567890",
                mst: "0201234567",
                cong_ty: "Cong ty B",
                nhan_vien: "Minh",
                team: "Blue Team",
                kpi: 2,
              },
            ],
            companies: [
              {
                mst: "0101234567",
                cong_ty: "Cong ty A",
                decls: 1,
                items: 10,
                licenses: 0,
                kpi: 3.5,
              },
              {
                mst: "0201234567",
                cong_ty: "Cong ty B",
                decls: 1,
                items: 0,
                licenses: 0,
                kpi: 2,
              },
            ],
          },
        ],
      },
      teams: {
        keysHash: "blue-team",
        items: [
          {
            key: "blue-team",
            name: "Blue Team",
            serverOnly: { etag: "team-blue-v1" },
            stats: {
              licenseCodes: ["TEAM01"],
            },
            adjustmentSummary: {
              teamwork: { key: "teamwork", points: "1.5", quantity: "3" },
            },
            rows: [
              {
                isAdjustment: true,
                kpi: -1.5,
              },
            ],
            members: [
              {
                key: "lan",
                name: "Lan",
                stats: {
                  decls: 1,
                  kpi: 3.5,
                  import: 1,
                  export: 0,
                  licenseCodes: ["MEM01", " MEM02 "],
                },
              },
            ],
            companies: [
              {
                mst: "0101234567",
                cong_ty: "Cong ty A",
                staff: "Lan",
                decls: 1,
                items: 10,
                licenses: 0,
                kpi: 3.5,
              },
            ],
          },
        ],
      },
    });

    expect(report.range).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(report.rules).toEqual(
      expect.objectContaining({
        id: "boosted-kpi",
        name: "Boosted KPI",
        applyFrom: "2026-02-01",
        version: 3,
        licenseExcludedSummary: "ZN02, HDGC",
        license: {
          exclude: {
            codes: ["ZN02", "HDGC"],
          },
        },
      })
    );
    expect("serverOnlyRuleMeta" in report.rules).toBe(false);
    expect(report.summary).toEqual(expect.objectContaining({ decls: 2, kpi: 5.5 }));
    expect("serverOnlySummaryMeta" in report.summary).toBe(false);
    expect(report.adjustments).toEqual(
      expect.objectContaining({
        totalPoints: 2,
        approvedCount: 1,
      })
    );
    expect(report.adjustments.totalsByCategory).toEqual({
      support: { points: 2, quantity: 1 },
    });
    expect(report.adjustments.totalsList).toEqual([
      expect.objectContaining({ key: "support", points: 2, quantity: 1 }),
    ]);
    expect(report.adjustments.applied).toEqual([
      {
        key: "adj-1",
        date: "2026-02-01",
        displayDate: "2026-02",
        label: "Hỗ trợ thông quan",
        staffName: "Lan",
        teamName: "Blue Team",
        quantity: 1,
        unitPoints: 2,
        references: ["10234567890"],
        referencesText: "10234567890",
        note: "Ghi chú test",
        kpi: 2,
      },
    ]);
    expect(report.companies).toEqual({
      staff: [
        expect.objectContaining({
          mst: "0101234567",
          cong_ty: "Cong ty A",
          staff: "Lan",
        }),
      ],
      teams: [
        expect.objectContaining({
          mst: "0101234567",
          cong_ty: "Cong ty A",
          team: "Blue Team",
          staff: "Lan",
        }),
      ],
    });
    expect("teamSeries" in report.trend).toBe(false);
    expect("topTeams" in report.trend).toBe(false);
    expect("rows" in report).toBe(false);
    expect("keysHash" in report.staff).toBe(false);
    expect("keysHash" in report.teams).toBe(false);
    expect(report.staff.byKey.get("lan")).toEqual(
      expect.objectContaining({
        name: "Lan",
        licenseSummary: "GCN01, GCN02",
        adjustmentTotals: [
          expect.objectContaining({ key: "support", points: 2, quantity: 1 }),
          expect.objectContaining({ key: "tax", points: -1, quantity: 1 }),
        ],
        adjustmentMetrics: {
          totalPoints: 1,
          entryCount: 2,
          positive: 1,
          negative: 0,
          neutral: 1,
        },
        companies: [
          expect.objectContaining({
            mst: "0101234567",
            cong_ty: "Cong ty A",
          }),
        ],
        rows: [
          expect.objectContaining({
            licenseSummary: "A11, B22",
            licenseExcludedSummary: "X01",
          }),
          expect.any(Object),
          expect.any(Object),
        ],
      })
    );
    expect("serverOnly" in report.staff.byKey.get("lan")).toBe(false);
    expect(report.teams.byKey.get("blue-team")).toEqual(
      expect.objectContaining({
        name: "Blue Team",
        licenseSummary: "TEAM01",
        adjustmentTotals: [
          expect.objectContaining({ key: "teamwork", points: 1.5, quantity: 3 }),
        ],
        adjustmentMetrics: {
          totalPoints: 1.5,
          entryCount: 1,
          positive: 0,
          negative: 1,
          neutral: 0,
        },
        members: [
          expect.objectContaining({
            key: "lan",
            name: "Lan",
            licenseSummary: "MEM01, MEM02",
          }),
        ],
        rows: [
          expect.objectContaining({
            licenseSummary: "",
            licenseExcludedSummary: "",
          }),
        ],
        companies: [
          expect.objectContaining({
            mst: "0101234567",
            cong_ty: "Cong ty A",
            staff: "Lan",
          }),
        ],
      })
    );
    expect("serverOnly" in report.teams.byKey.get("blue-team")).toBe(false);
  });

  it("creates an empty safe fallback model", () => {
    const report = createEmptyReportingViewModel({ from: "2026-03-01", to: "2026-03-31" }, null);

    expect(report.range).toEqual({ from: "2026-03-01", to: "2026-03-31" });
    expect("rows" in report).toBe(false);
    expect("keysHash" in report.staff).toBe(false);
    expect("keysHash" in report.teams).toBe(false);
    expect(report.staff.list).toEqual([]);
    expect(report.teams.list).toEqual([]);
    expect(report.companies).toEqual({ staff: [], teams: [] });
    expect(report.adjustments.totalPoints).toBe(0);
    expect(report.trend.series).toEqual([]);
    expect("teamSeries" in report.trend).toBe(false);
    expect("topTeams" in report.trend).toBe(false);
    expect(report.rules).toEqual({ id: "default", name: "Default KPI" });
  });

  it("loads the combined reporting view through a single reporting endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          meta: {
            servedAt: "2026-03-12T10:00:00.000Z",
            aggregateStatus: {
              available: true,
              generatedAt: "2026-03-09T09:00:00.000Z",
              queryKey: JSON.stringify({ from: "2026-02-01", to: "2026-02-28", limit: 0 }),
              total: 1,
              range: { from: "2026-02-01", to: "2026-02-28" },
            },
          },
          summary: {
            range: { from: "2026-02-01", to: "2026-02-28" },
            ruleSet: { id: "legacy-kpi", name: "Legacy KPI" },
            summary: { decls: 2, kpi: 1.6, companyCount: 0, licenseSummary: "—" },
            trend: { series: [{ period: "02/2026", kpi: 1.6 }], comparison: null },
            adjustments: { list: [], applied: [], totalsByCategory: {} },
            companies: { staff: [], teams: [] },
          },
          staff: {
            range: { from: "2026-02-01", to: "2026-02-28" },
            ruleSet: { id: "legacy-kpi", name: "Legacy KPI" },
            total: 1,
            items: [{ key: "lan", name: "Lan", stats: { decls: 2, kpi: 1.6 }, rows: [] }],
          },
          teams: {
            range: { from: "2026-02-01", to: "2026-02-28" },
            ruleSet: { id: "legacy-kpi", name: "Legacy KPI" },
            total: 1,
            items: [{ key: "blue-team", name: "Blue Team", stats: { decls: 2, kpi: 1.6 }, rows: [] }],
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const report = await fetchReportingViewModel(
      {
        from: "2026-02-01",
        to: "2026-02-28",
        ruleId: "legacy-kpi",
      },
      { id: "legacy-kpi", name: "Legacy KPI" }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain("/api/v4/reporting/view?from=2026-02-01&to=2026-02-28&ruleId=legacy-kpi");
    expect(report.meta).toEqual({
      servedAt: "2026-03-12T10:00:00.000Z",
      aggregateStatus: {
        available: true,
        generatedAt: "2026-03-09T09:00:00.000Z",
        queryKey: JSON.stringify({ from: "2026-02-01", to: "2026-02-28", limit: 0 }),
        total: 1,
        range: { from: "2026-02-01", to: "2026-02-28" },
      },
    });
    expect(report.summary).toEqual(
      expect.objectContaining({
        decls: 2,
        kpi: 1.6,
      })
    );
    expect(report.staff.list).toEqual([expect.objectContaining({ key: "lan" })]);
    expect(report.teams.list).toEqual([expect.objectContaining({ key: "blue-team" })]);
  });

  it("normalizes reporting schedules and preserves local overrides over stale remote snapshots", () => {
    const schedules = buildReportingSchedulesViewModel({
      total: 1,
      items: [
        {
          id: "weekly-blue",
          name: "Weekly Blue",
          frequency: "weekly",
          time: "08:30",
          dayOfWeek: 1,
          dayOfMonth: null,
          formats: ["pdf", " excel "],
          recipients: ["ops@example.com", " lead@example.com "],
          active: true,
          lastRun: "2026-03-02T01:30:00.000Z",
          nextRun: "2026-03-09T01:30:00.000Z",
          serverOnlyScheduleMeta: { etag: "schedule-v1" },
        },
      ],
      aggregateStatus: {
        available: true,
        generatedAt: "2026-03-09T09:00:00.000Z",
        queryKey: "monthly-default-v1",
        total: "2",
        range: {
          from: "2026-01-01",
          to: "2026-02-28",
        },
      },
    });

    expect(schedules.aggregateStatus).toEqual({
      available: true,
      generatedAt: "2026-03-09T09:00:00.000Z",
      queryKey: "monthly-default-v1",
      total: 2,
      range: {
        from: "2026-01-01",
        to: "2026-02-28",
      },
    });
    expect(schedules.items).toEqual([
      expect.objectContaining({
        id: "weekly-blue",
        formats: ["pdf", "excel"],
        formatsSummary: "PDF, EXCEL",
        recipients: ["ops@example.com", "lead@example.com"],
        recipientsSummary: "ops@example.com, lead@example.com",
      }),
    ]);
    expect("serverOnlyScheduleMeta" in schedules.items[0]).toBe(false);

    const merged = mergeReportingScheduleItems(schedules.items, [
      {
        id: "weekly-blue",
        name: "Weekly Blue (local)",
        frequency: "weekly",
        time: "08:45",
        dayOfWeek: 1,
        formats: ["excel"],
        recipients: ["local@example.com"],
        active: false,
      },
      {
        id: "monthly-local",
        name: "Monthly Local",
        frequency: "monthly",
        dayOfMonth: 20,
        time: "09:15",
        formats: ["pdf"],
        recipients: ["finance@example.com"],
        active: true,
      },
    ]);

    expect(merged).toEqual([
      expect.objectContaining({
        id: "weekly-blue",
        name: "Weekly Blue (local)",
        time: "08:45",
        active: false,
        formats: ["excel"],
        formatsSummary: "EXCEL",
        recipients: ["local@example.com"],
        recipientsSummary: "local@example.com",
        nextRun: "2026-03-09T01:30:00.000Z",
      }),
      expect.objectContaining({
        id: "monthly-local",
        name: "Monthly Local",
        formatsSummary: "PDF",
        recipientsSummary: "finance@example.com",
      }),
    ]);
  });

  it("normalizes stored schedule overlays with the same reporting contract", () => {
    const schedules = normalizeStoredReportingScheduleItems([
      {
        id: "stored-monthly",
        name: " Stored Monthly ",
        frequency: "monthly",
        dayOfMonth: 12,
        time: "09:05",
        formats: [" pdf ", "excel", "pdf"],
        recipients: ["ops@example.com", " ops@example.com ", "finance@example.com"],
        active: true,
        nextRun: "2026-03-12T02:05:00.000Z",
      },
    ]);

    expect(schedules).toEqual([
      expect.objectContaining({
        id: "stored-monthly",
        name: "Stored Monthly",
        formats: ["pdf", "excel"],
        formatsSummary: "PDF, EXCEL",
        recipients: ["ops@example.com", "finance@example.com"],
        recipientsSummary: "ops@example.com, finance@example.com",
        nextRun: "2026-03-12T02:05:00.000Z",
      }),
    ]);
  });

  it("saves reporting schedules through the reporting API boundary without falling back to shared-storage refresh", async () => {
    const refreshSpy = vi.spyOn(storageClient, "refreshSharedKeys").mockResolvedValue(undefined);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          item: {
            id: "weekly-red",
            name: "Weekly Red",
            frequency: "weekly",
            time: "09:45",
            dayOfWeek: 5,
            dayOfMonth: null,
            formats: ["pdf", "excel"],
            recipients: ["ops@example.com", "lead@example.com"],
            active: true,
            lastRun: "",
            nextRun: "2026-03-13T02:45:00.000Z",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const saved = await saveReportingSchedule(
      {
        name: "Weekly Red",
        frequency: "weekly",
        time: "09:45",
        dayOfWeek: 5,
        formats: ["pdf", " excel "],
        recipients: "ops@example.com\nlead@example.com",
        active: true,
      },
      { actor: "ui.report" }
    );

    expect(fetchSpy.mock.calls[0][0]).toContain("/api/v4/reporting/schedules");
    expect(fetchSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({
      name: "Weekly Red",
      frequency: "weekly",
      time: "09:45",
      dayOfWeek: 5,
      formats: ["pdf", " excel "],
      recipients: "ops@example.com\nlead@example.com",
      active: true,
    });
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(saved).toEqual(
      expect.objectContaining({
        id: "weekly-red",
        formatsSummary: "PDF, EXCEL",
        recipientsSummary: "ops@example.com, lead@example.com",
      })
    );
  });

  it("deletes reporting schedules through the reporting API boundary without falling back to shared-storage refresh", async () => {
    const refreshSpy = vi.spyOn(storageClient, "refreshSharedKeys").mockResolvedValue(undefined);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          deleted: true,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const deleted = await deleteReportingSchedule("weekly-red", { actor: "ui.report" });

    expect(fetchSpy.mock.calls[0][0]).toContain("/api/v4/reporting/schedules/weekly-red");
    expect(fetchSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "DELETE",
        credentials: "include",
      })
    );
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(deleted).toBe(true);
  });

  it("publishes refreshed schedule collections to reporting subscribers", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          total: 1,
          items: [
            {
              id: "weekly-blue",
              name: "Weekly Blue",
              frequency: "weekly",
              time: "08:30",
              dayOfWeek: 1,
              dayOfMonth: null,
              formats: ["pdf", "excel"],
              recipients: ["ops@example.com", "lead@example.com"],
              active: true,
              lastRun: "2026-03-02T01:30:00.000Z",
              nextRun: "2026-03-09T01:30:00.000Z",
            },
          ],
          aggregateStatus: {
            available: true,
            generatedAt: "2026-03-08T00:00:00.000Z",
            queryKey: "default-2026-02",
            total: 1,
            range: {
              from: "2026-02-01",
              to: "2026-02-28",
            },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const listener = vi.fn();
    const unsubscribe = subscribeReportingSchedules(listener);

    const schedules = await fetchReportingSchedules();

    expect(schedules.total).toBe(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        items: [expect.objectContaining({ id: "weekly-blue" })],
      })
    );

    unsubscribe();
  });

  it("publishes optimistic schedule updates to subscribers after save and delete without a refetch", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            total: 1,
            items: [
              {
                id: "weekly-blue",
                name: "Weekly Blue",
                frequency: "weekly",
                time: "08:30",
                dayOfWeek: 1,
                dayOfMonth: null,
                formats: ["pdf"],
                recipients: ["ops@example.com"],
                active: true,
                lastRun: "",
                nextRun: "2026-03-09T01:30:00.000Z",
              },
            ],
            aggregateStatus: {
              available: true,
              generatedAt: "2026-03-08T00:00:00.000Z",
              queryKey: "default-2026-02",
              total: 1,
              range: {
                from: "2026-02-01",
                to: "2026-02-28",
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            item: {
              id: "monthly-red",
              name: "Monthly Red",
              frequency: "monthly",
              time: "09:45",
              dayOfWeek: null,
              dayOfMonth: 20,
              formats: ["pdf", "excel"],
              recipients: ["ops@example.com", "lead@example.com"],
              active: true,
              lastRun: "",
              nextRun: "2026-03-20T02:45:00.000Z",
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            deleted: true,
          },
        }),
      });
    vi.stubGlobal("fetch", fetchSpy);
    const listener = vi.fn();
    const unsubscribe = subscribeReportingSchedules(listener);

    await fetchReportingSchedules();
    await saveReportingSchedule({
      id: "monthly-red",
      name: "Monthly Red",
      frequency: "monthly",
      time: "09:45",
      dayOfMonth: 20,
      formats: ["pdf", "excel"],
      recipients: ["ops@example.com", "lead@example.com"],
      active: true,
    });

    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        total: 2,
        items: [
          expect.objectContaining({ id: "weekly-blue" }),
          expect.objectContaining({ id: "monthly-red" }),
        ],
      })
    );

    await deleteReportingSchedule("monthly-red");

    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        total: 1,
        items: [expect.objectContaining({ id: "weekly-blue" })],
      })
    );

    unsubscribe();
  });
});
