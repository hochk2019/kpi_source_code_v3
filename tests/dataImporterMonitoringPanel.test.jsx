import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import DataImporterMonitoringPanel from "@/components/dataImporter/DataImporterMonitoringPanel.jsx";

afterEach(() => {
  cleanup();
});

function createCoDiscrepancyProps(overrides = {}) {
  return {
    canManageSync: true,
    range: {
      from: "2026-03-01",
      to: "2026-03-10",
    },
    onRangeChange: vi.fn(),
    onRun: vi.fn(),
    onRefresh: vi.fn(),
    running: false,
    loading: false,
    error: "",
    message: "Đã cập nhật kết quả đối soát.",
    statusLabel: "Đang hoạt động",
    lastRunLabel: "10/03/2026 08:30",
    mismatchCount: 4,
    checkedCount: 18,
    form: {
      enabled: true,
      cron: "30 4 * * *",
      rangeDays: "7",
      threshold: "2",
      sampleLimit: "25",
    },
    onFormChange: vi.fn(),
    saving: false,
    onSaveConfig: vi.fn(),
    onResetForm: vi.fn(),
    rangeLabel: "01/03/2026 - 10/03/2026",
    mismatchLimited: true,
    mismatchPreview: [
      {
        key: "co-1",
        so_tk: "1029384756",
        stored: { has_co: true, co_line_count: 2 },
        remote: { has_co: false, co_line_count: 0, co_codes: [] },
      },
    ],
    mismatchKeyCount: 1,
    onSelectMismatches: vi.fn(),
    ...overrides,
  };
}

function createAlertsProps(overrides = {}) {
  return {
    lastEvaluated: "10/03/2026 09:00",
    summary: { totalTracked: 12 },
    onRefresh: vi.fn(),
    loading: false,
    outstandingAlerts: [
      {
        key: "alert-1",
        so_tk: "9988776655",
        mst: "0102030405",
        company: "Cong ty A",
        missing: ["C/O", "Ngay thong quan"],
        date: "2026-03-09",
        lastUpdated: "2026-03-10T02:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("DataImporterMonitoringPanel", () => {
  it("renders populated discrepancy and alert states with working actions", () => {
    const coDiscrepancy = createCoDiscrepancyProps();
    const alerts = createAlertsProps();
    const formatDeclarationLabel = vi.fn((item) => `TK-${item.so_tk}`);
    const formatDisplayDate = vi.fn((value) => `DATE:${value}`);

    render(
      <DataImporterMonitoringPanel
        coDiscrepancy={coDiscrepancy}
        alerts={alerts}
        formatDeclarationLabel={formatDeclarationLabel}
        formatDisplayDate={formatDisplayDate}
      />,
    );

    expect(screen.getByText("Đối soát C/O")).toBeInTheDocument();
    expect(screen.getByText("Chênh lệch gợi ý (1 / 4)")).toBeInTheDocument();
    expect(screen.getByText("Cảnh báo tờ khai thiếu thông tin")).toBeInTheDocument();
    expect(screen.getByText("TK-1029384756")).toBeInTheDocument();
    expect(screen.getByText("Cong ty A")).toBeInTheDocument();
    expect(screen.getByText("DATE:2026-03-09")).toBeInTheDocument();
    expect(screen.getByText(/Đã cắt bớt danh sách/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chạy kiểm tra" }));
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục" }));
    fireEvent.click(screen.getByRole("button", { name: "Chọn trên bảng" }));
    fireEvent.click(screen.getByRole("button", { name: "Làm mới danh sách" }));

    expect(coDiscrepancy.onRun).toHaveBeenCalledTimes(1);
    expect(coDiscrepancy.onRefresh).toHaveBeenCalledTimes(1);
    expect(coDiscrepancy.onSaveConfig).toHaveBeenCalledTimes(1);
    expect(coDiscrepancy.onResetForm).toHaveBeenCalledTimes(1);
    expect(coDiscrepancy.onSelectMismatches).toHaveBeenCalledTimes(1);
    expect(alerts.onRefresh).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByDisplayValue("2026-03-01"), { target: { value: "2026-03-03" } });
    fireEvent.change(screen.getByDisplayValue("30 4 * * *"), { target: { value: "15 5 * * *" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Bật đối soát tự động" }));

    expect(coDiscrepancy.onRangeChange).toHaveBeenCalledWith({
      from: "2026-03-03",
      to: "2026-03-10",
    });
    expect(coDiscrepancy.onFormChange).toHaveBeenCalledWith({
      enabled: true,
      cron: "15 5 * * *",
      rangeDays: "7",
      threshold: "2",
      sampleLimit: "25",
    });
    expect(coDiscrepancy.onFormChange).toHaveBeenCalledWith({
      enabled: false,
      cron: "30 4 * * *",
      rangeDays: "7",
      threshold: "2",
      sampleLimit: "25",
    });
    expect(formatDeclarationLabel).toHaveBeenCalled();
    expect(formatDisplayDate).toHaveBeenCalledWith("2026-03-09");
  });

  it("renders empty and loading states", () => {
    render(
      <DataImporterMonitoringPanel
        coDiscrepancy={createCoDiscrepancyProps({
          message: "",
          mismatchCount: 0,
          checkedCount: 0,
          mismatchPreview: [],
          mismatchKeyCount: 0,
          mismatchLimited: false,
          rangeLabel: "",
        })}
        alerts={createAlertsProps({
          loading: true,
          outstandingAlerts: [],
        })}
        formatDeclarationLabel={(item) => item.so_tk}
        formatDisplayDate={(value) => value}
      />,
    );

    expect(screen.getByText("Chưa phát hiện chênh lệch nào.")).toBeInTheDocument();
    expect(screen.getByText("Chưa có kết quả đối soát.")).toBeInTheDocument();
    expect(screen.getByText("Đang tải danh sách cảnh báo...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chọn trên bảng" })).toBeDisabled();
  });

  it("renders empty alert state after loading completes", () => {
    render(
      <DataImporterMonitoringPanel
        coDiscrepancy={createCoDiscrepancyProps()}
        alerts={createAlertsProps({
          loading: false,
          outstandingAlerts: [],
        })}
        formatDeclarationLabel={(item) => item.so_tk}
        formatDisplayDate={(value) => value}
      />,
    );

    expect(screen.getByText("Không có cảnh báo nào đang chờ xử lý.")).toBeInTheDocument();
  });
});
