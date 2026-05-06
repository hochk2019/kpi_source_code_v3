import React from "react";

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@testing-library/react";

import ReportViewer from "@/components/ReportViewer.tsx";

import { DECL_KEY, RULES_KEY, KPI_ADJUSTMENTS_KEY } from "@/lib/store.js";

import { DEFAULT_RULES } from "@/lib/rules.js";

import { clearStorageCache, setItem as sharedSetItem } from "@/lib/storageClient.js";

import { installMockApi } from "./helpers/mockApi.js";

const REPORT_PREFS_STORAGE_KEY = "kpi_report_viewer_prefs_v1";

function ensureTestGlobals() {
  if (!globalThis.ResizeObserver) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}

        unobserve() {}

        disconnect() {}
      }
    );
  }
}

beforeEach(() => {
  clearStorageCache();
  ensureTestGlobals();
  installMockApi();
  window.localStorage.setItem(
    REPORT_PREFS_STORAGE_KEY,
    JSON.stringify({
      quickRange: "all_time",
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("ReportViewer", () => {
  it("hiển thị dashboard tổng quan và dữ liệu nhân viên theo quy tắc hiện hành", async () => {
    const rows = [
      {
        date: "2024-08-01",
        so_tk: "10234567890",
        loai_hinh: "E11",
        num_items: 10,
        licenses: 1,
        nhan_vien: "Phương",
        team: "Team 1",
        mst: "0101234567",
        cong_ty: "Công ty A",
      },
      {
        date: "2024-08-05",
        so_tk: "30234567890",
        loai_hinh: "B11",
        num_items: 15,
        licenses: 2,
        nhan_vien: "Tuấn",
        team: "Team 2",
        mst: "0201234567",
        cong_ty: "Công ty B",
      },
    ];

    const rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    rules.name = "Rules tháng 8";
    rules.applyFrom = "2024-08-01";

    sharedSetItem(DECL_KEY, JSON.stringify(rows));
    sharedSetItem(RULES_KEY, JSON.stringify(rules));
    sharedSetItem(
      KPI_ADJUSTMENTS_KEY,
      JSON.stringify([
        {
          id: "adj-test-1",
          category: "support_fixed",
          month: "2024-08",
          staffName: "Phương",
          teamName: "Team 1",
          quantity: 1,
          unitPoints: 5,
          totalPoints: 5,
          status: "approved",
          references: ["10234567890"],
          note: "Hỗ trợ thông quan",
          createdAt: "2024-08-02T00:00:00Z",
          updatedAt: "2024-08-02T00:00:00Z",
          history: [],
        },
      ])
    );

    render(<ReportViewer />);

    expect((await screen.findAllByText(/Rules tháng 8/)).length).toBeGreaterThan(0);
    expect(screen.getByText("Áp dụng từ 2024-08-01")).toBeTruthy();
    expect(await screen.findByText(/Tổng hợp tháng mặc định: 2024-08-01 → 2024-08-31/i)).toBeTruthy();
    expect(screen.getByText("Tổng tờ khai")).toBeTruthy();
    expect(screen.getAllByText(/2\s+tờ khai hợp lệ/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Phương").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Team 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Điểm KPI +/- bổ sung").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Điểm đã áp dụng/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Xu hướng KPI 6 kỳ gần nhất").length).toBeGreaterThan(0);
    expect(screen.getByText("Phân bổ lượng tờ khai theo tổ đội")).toBeTruthy();
    expect(screen.getByText(/Top nhân viên theo .*điểm KPI/i)).toBeTruthy();
  });

  it("dùng reporting view cho cả baseline khi người dùng chọn rule khác rule đang áp dụng", async () => {
    const legacyRules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    legacyRules.id = "legacy-kpi";
    legacyRules.name = "Legacy KPI";
    legacyRules.applyFrom = "2024-08-01";

    const boostedRules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    boostedRules.id = "boosted-kpi";
    boostedRules.name = "Boosted KPI";
    boostedRules.applyFrom = "2024-08-15";

    sharedSetItem(
      RULES_KEY,
      JSON.stringify({
        version: 2,
        activeId: "legacy-kpi",
        sets: [legacyRules, boostedRules],
      })
    );

    window.localStorage.setItem(
      REPORT_PREFS_STORAGE_KEY,
      JSON.stringify({
        quickRange: "all_time",
        ruleId: "boosted-kpi",
      })
    );

    const fetchMock = installMockApi();

    render(<ReportViewer />);

    await waitFor(() => {
      const viewCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/v4/reporting/view"));
      expect(viewCalls.length).toBeGreaterThanOrEqual(2);
    });

    const summaryCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/v4/reporting/summary"));
    expect(summaryCalls).toHaveLength(0);
  });

  it("gắn shell semantics rõ ràng cho panel điều khiển và lịch gửi báo cáo", async () => {
    sharedSetItem(
      DECL_KEY,
      JSON.stringify([
        {
          date: "2024-08-01",
          so_tk: "10234567890",
          loai_hinh: "E11",
          num_items: 10,
          licenses: 1,
          nhan_vien: "Phương",
          team: "Team 1",
          mst: "0101234567",
          cong_ty: "Công ty A",
        },
      ])
    );
    sharedSetItem(RULES_KEY, JSON.stringify(DEFAULT_RULES));

    render(<ReportViewer currentUser={{ role: "admin" }} />);

    expect((await screen.findAllByRole("region", { name: /điều khiển báo cáo kpi/i })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("region", { name: /lập lịch gửi báo cáo kpi/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("form", { name: /biểu mẫu lịch gửi báo cáo kpi/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /thu gọn/i })).toHaveAttribute("aria-expanded", "true");
  });

  it("tách report workspace thành insight, drill-down và lịch gửi theo thứ tự đọc mobile-first", async () => {
    sharedSetItem(
      DECL_KEY,
      JSON.stringify([
        {
          date: "2024-08-01",
          so_tk: "10234567890",
          loai_hinh: "E11",
          num_items: 10,
          licenses: 1,
          nhan_vien: "Phương",
          team: "Team 1",
          mst: "0101234567",
          cong_ty: "Công ty A",
        },
      ])
    );
    sharedSetItem(RULES_KEY, JSON.stringify(DEFAULT_RULES));

    render(<ReportViewer currentUser={{ role: "admin" }} />);

    const insightRegions = await screen.findAllByRole("region", { name: /dashboard insight kpi/i });
    const [guideRegion] = screen.getAllByRole("region", { name: /sơ đồ điều hướng report center/i });
    const [explorerRegion] = screen.getAllByRole("region", { name: /khám phá phạm vi báo cáo kpi/i });
    const scheduleRegions = screen.getAllByRole("region", { name: /lập lịch gửi báo cáo kpi/i });
    const [notesRegion] = screen.getAllByRole("region", { name: /ghi chú báo cáo kpi/i });
    const insightAnchor = document.getElementById("report-viewer-insights");
    const explorerAnchor = document.getElementById("report-viewer-explorer");
    const scheduleAnchor = document.getElementById("report-viewer-schedule");
    const notesAnchor = document.getElementById("report-viewer-notes");

    expect(insightRegions.length).toBeGreaterThan(0);
    expect(scheduleRegions.length).toBeGreaterThan(0);
    expect(guideRegion).toBeTruthy();
    expect(explorerRegion).toBeTruthy();
    expect(insightAnchor).toBeTruthy();
    expect(explorerAnchor).toBeTruthy();
    expect(scheduleAnchor).toBeTruthy();
    expect(notesAnchor).toBeTruthy();
    expect(notesRegion).toBeTruthy();
    expect(
      guideRegion.compareDocumentPosition(insightAnchor) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      insightAnchor.compareDocumentPosition(explorerAnchor) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      explorerAnchor.compareDocumentPosition(scheduleAnchor) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
