import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterSyncConfigPanel from "@/components/dataImporter/DataImporterSyncConfigPanel.jsx";

afterEach(() => {
  cleanup();
});

function createProps(overrides = {}) {
  return {
    isAdminRole: true,
    canManageSync: true,
    syncLastRunLabel: "10/03/2026 21:00",
    syncConfig: { lastStatus: "healthy" },
    fetchSyncConfig: vi.fn(),
    fetchSyncStatus: vi.fn(),
    handleSaveSyncConfig: vi.fn(),
    syncLoading: false,
    statusLoading: false,
    syncForm: {
      enabled: true,
      schedule: "0 * * * *",
      rangeDays: 7,
      preferMonthFirst: false,
      server: "192.168.1.10\\SQL2019",
      database: "ECUS5VNACCS",
      user: "sa",
      password: "",
      hasPassword: true,
      includeTaxCodesText: "0100109106",
      excludeTaxCodesText: "0401234567",
    },
    setSyncForm: vi.fn(),
    toneClassMap: {
      muted: "bg-gray-100 text-gray-600",
      success: "bg-emerald-100 text-emerald-700",
      warning: "bg-amber-100 text-amber-700",
    },
    backendMeta: { tone: "success", label: "Sẵn sàng", detail: "Bridge healthy" },
    databaseMeta: { tone: "warning", label: "Cần kiểm tra", detail: "SQL ping chậm" },
    statusCheckedLabel: "10/03/2026 21:05",
    statusError: "",
    lastSyncSummaryCard: <div>Tóm tắt lần đồng bộ gần nhất</div>,
    rangePresets: [
      { days: 1, label: "Hôm nay" },
      { days: 7, label: "7 ngày" },
    ],
    manualRange: { from: "2026-03-01", to: "2026-03-08" },
    onApplyRangePreset: vi.fn(),
    onManualRangeChange: vi.fn(),
    syncRunning: false,
    previewLoading: false,
    onPreview: vi.fn(),
    onRunSync: vi.fn(),
    mstFilterNotice: "0100109106",
    showPreviewRange: true,
    previewRangeLabel: "01/03/2026 - 08/03/2026",
    previewLimited: false,
    previewError: "",
    previewRows: [
      {
        so_tk: "102030",
        date: "2026-03-07",
        mst: "0100109106",
        cong_ty: "Công ty A",
        nhan_vien: "",
        status: "new",
      },
    ],
    previewConflictSummary: {
      totalRows: 3,
      newCount: 1,
      existingCount: 2,
      overwriteCount: 2,
      unchangedCount: 0,
      lockedCount: 1,
    },
    previewConflictWarningActive: true,
    syncRecoveryHints: [
      {
        key: "vpn-sql",
        title: "Kiểm tra VPN và đường vào SQL Server",
        detail: "Nếu đang làm việc ngoài văn phòng, hãy kết nối VPN hoặc mạng nội bộ rồi thử lại.",
      },
    ],
    syncHistory: [
      {
        id: "job-history-1",
        actor: "tester",
        status: "completed",
        from: "2026-03-01",
        to: "2026-03-08",
        finishedAt: "2026-03-11T08:10:10.000Z",
        resultSummary: {
          imported: 1,
          updated: 2,
          skipped: 0,
          reviewLocked: 1,
          affectedRows: 3,
          previewedRows: 4,
        },
      },
    ],
    formatDisplayDate: (value) => `fmt:${value}`,
    syncMessage: "Đã đồng bộ thành công",
    syncError: "",
    cardSurfaceClass: "rounded border bg-white shadow-sm",
    ...overrides,
  };
}

describe("DataImporterSyncConfigPanel", () => {
  it("renders the manage-sync card and forwards key actions", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<DataImporterSyncConfigPanel {...props} />);

    expect(screen.getByText("Đồng bộ tự động từ ECUS5VNACCS")).toBeInTheDocument();
    expect(screen.getByText("Backend: Sẵn sàng")).toBeInTheDocument();
    expect(screen.getByText("SQL Server: Cần kiểm tra")).toBeInTheDocument();
    expect(screen.getByText("Lần kiểm tra: 10/03/2026 21:05")).toBeInTheDocument();
    expect(screen.getByText("Tóm tắt lần đồng bộ gần nhất")).toBeInTheDocument();
    expect(screen.getByLabelText("Biểu thức cron")).toHaveValue("0 * * * *");
    expect(screen.getByLabelText("Chỉ đồng bộ các MST")).toHaveValue("0100109106");
    expect(screen.getByText("Cảnh báo overwrite trước khi đồng bộ")).toBeInTheDocument();
    expect(screen.getByText("Gợi ý khắc phục")).toBeInTheDocument();
    expect(screen.getByText("Kiểm tra VPN và đường vào SQL Server")).toBeInTheDocument();
    expect(screen.getByText("Lịch sử đồng bộ gần đây")).toBeInTheDocument();
    expect(screen.getByText(/Khoảng chạy: 2026-03-01 → 2026-03-08/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tải lại cấu hình" }));
    await user.click(screen.getByRole("button", { name: "Kiểm tra kết nối" }));
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    await user.click(screen.getByRole("button", { name: "7 ngày" }));
    await user.click(screen.getByRole("button", { name: "Xem trước dữ liệu" }));
    await user.click(screen.getByRole("button", { name: "Đồng bộ ngay" }));

    fireEvent.change(screen.getByLabelText("Biểu thức cron"), { target: { value: "*/30 * * * *" } });
    fireEvent.change(screen.getByLabelText("Chỉ đồng bộ các MST"), {
      target: { value: "0100109106;0312345678" },
    });

    expect(props.fetchSyncConfig).toHaveBeenCalledTimes(1);
    expect(props.fetchSyncStatus).toHaveBeenCalledTimes(1);
    expect(props.handleSaveSyncConfig).toHaveBeenCalledTimes(1);
    expect(props.onApplyRangePreset).toHaveBeenCalledWith(7);
    expect(props.onPreview).toHaveBeenCalledTimes(1);
    expect(props.onRunSync).toHaveBeenCalledTimes(1);
    expect(props.setSyncForm).toHaveBeenCalled();
  });

  it("renders the readonly status card and refreshes both sync sources together", async () => {
    const user = userEvent.setup();
    const props = createProps({
      canManageSync: false,
      syncLoading: false,
      statusLoading: false,
    });

    render(<DataImporterSyncConfigPanel {...props} />);

    expect(screen.getByText("Đồng bộ ECUS")).toBeInTheDocument();
    expect(
      screen.getByText("Lần chạy gần nhất: 10/03/2026 21:00 • Trạng thái: healthy"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cập nhật trạng thái" }));

    expect(props.fetchSyncConfig).toHaveBeenCalledTimes(1);
    expect(props.fetchSyncStatus).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Lưu cấu hình" })).toBeNull();
    expect(screen.queryByLabelText("Biểu thức cron")).toBeNull();
  });
});
