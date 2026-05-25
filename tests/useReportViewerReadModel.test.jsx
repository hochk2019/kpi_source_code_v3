import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import useReportViewerReadModel from "@/components/reporting/useReportViewerReadModel.js";

function createEmptyReport(range, rules) {
  return {
    empty: true,
    range,
    rules,
    summary: {
      decls: 0,
      items: 0,
      kpi: 0,
      licenses: 0,
    },
    staff: { list: [] },
    teams: { list: [] },
  };
}

function createEmptySchedules() {
  return {
    empty: true,
    items: [],
    aggregateStatus: { available: false },
  };
}

function createDeps(overrides = {}) {
  return {
    createEmptyReportingSchedulesViewModel: vi.fn(() => createEmptySchedules()),
    createEmptyReportingViewModel: vi.fn((range, rules) => createEmptyReport(range, rules)),
    fetchReportingSchedules: vi.fn(async () => ({
      items: [{ id: "schedule-1", active: true, nextRun: "2026-03-15T08:00:00.000Z" }],
      aggregateStatus: { available: true },
    })),
    fetchReportingViewModel: vi.fn(async (query) => ({
      summary: {
        decls: query.ruleId === "rule-b" ? 12 : 9,
        items: 0,
        kpi: query.ruleId === "rule-b" ? 18.5 : 16,
        licenses: 0,
      },
      staff: { list: [] },
      teams: { list: [] },
      query,
    })),
    refreshSharedKeys: vi.fn(async () => {}),
    subscribeReportingSchedules: vi.fn(() => () => {}),
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

function renderUseReportViewerReadModel(props = {}, deps = createDeps()) {
  const hookProps = {
    from: "2026-03-01",
    to: "2026-03-31",
    selectedRuleId: "rule-b",
    selectedRuleKey: "rule-b",
    activeRuleId: "rule-a",
    rules: { id: "rule-b", mode: "test" },
    refreshKeys: ["decl", "rules"],
    deps,
    ...props,
  };

  const view = renderHook((currentProps) => useReportViewerReadModel(currentProps), {
    initialProps: hookProps,
  });

  return { ...view, deps, hookProps };
}

describe("useReportViewerReadModel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the current report, baseline report, and schedule read model", async () => {
    let scheduleListener = null;
    const deps = createDeps({
      fetchReportingViewModel: vi.fn(async (query) => {
        if (query.ruleId === "rule-b") {
          return {
            summary: { decls: 14, items: 0, kpi: 19.25, licenses: 0 },
            staff: { list: [{ key: "staff-a" }] },
            teams: { list: [{ key: "team-a" }] },
          };
        }

        return {
          summary: { decls: 10, items: 0, kpi: 17.5, licenses: 0 },
          staff: { list: [] },
          teams: { list: [] },
        };
      }),
      fetchReportingSchedules: vi.fn(async () => ({
        items: [{ id: "schedule-1", active: true }],
        aggregateStatus: { available: true, status: "fresh" },
      })),
      subscribeReportingSchedules: vi.fn((listener) => {
        scheduleListener = listener;
        return () => {};
      }),
    });

    const { result } = renderUseReportViewerReadModel({}, deps);

    await waitFor(() => {
      expect(result.current.report.summary.decls).toBe(14);
      expect(result.current.baselineSummary.summary.decls).toBe(10);
      expect(result.current.scheduleReadModel.items).toHaveLength(1);
    });

    act(() => {
      scheduleListener?.({
        items: [{ id: "schedule-2", active: true }],
        aggregateStatus: { available: true, status: "updated" },
      });
    });

    expect(result.current.scheduleReadModel).toMatchObject({
      items: [{ id: "schedule-2", active: true }],
      aggregateStatus: { available: true, status: "updated" },
    });
  });

  it("falls back to empty read models when report or schedule loading fails", async () => {
    const reportError = new Error("Không tải được báo cáo");
    const scheduleError = new Error("Không tải được lịch");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = createDeps({
      fetchReportingViewModel: vi.fn(async () => {
        throw reportError;
      }),
      fetchReportingSchedules: vi.fn(async () => {
        throw scheduleError;
      }),
    });

    const { result, hookProps } = renderUseReportViewerReadModel({}, deps);

    await waitFor(() => {
      expect(result.current.reportError).toBe("Không tải được báo cáo");
      expect(result.current.report.empty).toBe(true);
      expect(result.current.baselineSummary).toBeNull();
      expect(result.current.scheduleReadModel.empty).toBe(true);
    });

    expect(deps.createEmptyReportingViewModel).toHaveBeenLastCalledWith(
      { from: hookProps.from, to: hookProps.to },
      hookProps.rules,
    );
    expect(deps.createEmptyReportingSchedulesViewModel).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalled();
  });

  it("reloads shared keys and refreshes the read models on demand", async () => {
    const deps = createDeps();
    const { result, hookProps } = renderUseReportViewerReadModel({}, deps);

    await waitFor(() => {
      expect(deps.fetchReportingViewModel).toHaveBeenCalledTimes(2);
      expect(deps.fetchReportingSchedules).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.handleReloadData();
    });

    expect(deps.refreshSharedKeys).toHaveBeenCalledWith(hookProps.refreshKeys);
    expect(deps.toast.success).toHaveBeenCalledWith("Đã tải lại dữ liệu báo cáo KPI mới nhất.");

    await waitFor(() => {
      expect(deps.fetchReportingViewModel).toHaveBeenCalledTimes(4);
      expect(deps.fetchReportingSchedules).toHaveBeenCalledTimes(2);
    });
  });
});
