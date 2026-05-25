import { describe, expect, it } from "vitest";

import {
  resolveReportingExportState,
  validateReportExportPermissionState,
} from "@/components/reporting/reportingExportState.js";

describe("reportingExportState", () => {
  it("returns permission reason when user cannot export", () => {
    expect(
      resolveReportingExportState({
        canExport: false,
        summary: { decls: 10 },
      }),
    ).toEqual({
      canExport: false,
      disabledReason: "Tài khoản hiện tại không có quyền xuất báo cáo.",
    });
  });

  it("returns loading reason when summary data is still empty", () => {
    const state = resolveReportingExportState({
      canExport: true,
      reportLoading: true,
      summary: { decls: 0 },
    });

    expect(state.canExport).toBe(false);
    expect(state.disabledReason).toMatch(/đang tải dữ liệu báo cáo kpi/i);
  });

  it("returns report-error reason even when summary exists", () => {
    const state = resolveReportingExportState({
      canExport: true,
      reportError: "boom",
      summary: { decls: 12 },
    });

    expect(state.canExport).toBe(false);
    expect(state.disabledReason).toMatch(/không thể xuất báo cáo khi dữ liệu đang lỗi tải: boom/i);
  });

  it("returns empty-data reason when no declarations are available", () => {
    const state = resolveReportingExportState({
      canExport: true,
      summary: { decls: 0 },
    });

    expect(state.canExport).toBe(false);
    expect(state.disabledReason).toMatch(/không có dữ liệu tờ khai để xuất báo cáo/i);
  });

  it("returns exporting reason while exporter is running", () => {
    const state = resolveReportingExportState({
      canExport: true,
      exporting: true,
      summary: { decls: 4 },
    });

    expect(state.canExport).toBe(false);
    expect(state.disabledReason).toMatch(/đang được tạo/i);
  });

  it("returns export-ready state when all guards pass", () => {
    expect(
      resolveReportingExportState({
        canExport: true,
        summary: { decls: 5 },
      }),
    ).toEqual({
      canExport: true,
      disabledReason: "",
    });
  });

  it("exposes permission-check message helper", () => {
    expect(
      validateReportExportPermissionState({
        canExport: true,
        summary: { decls: 5 },
      }),
    ).toBe("");

    expect(
      validateReportExportPermissionState({
        canExport: false,
        summary: { decls: 5 },
      }),
    ).toMatch(/không có quyền xuất báo cáo/i);
  });
});

