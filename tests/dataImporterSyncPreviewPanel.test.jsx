import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterSyncPreviewPanel from "@/components/dataImporter/DataImporterSyncPreviewPanel.jsx";

function renderPanel(props = {}) {
  const handlers = {
    onApplyRangePreset: vi.fn(),
    onManualRangeChange: vi.fn(),
    onPreview: vi.fn(),
    onRunSync: vi.fn(),
    onResumeSync: vi.fn(),
    ...props,
  };

  render(
    <DataImporterSyncPreviewPanel
      rangePresets={[
        { days: 1, label: "Hôm nay" },
        { days: 7, label: "7 ngày" },
      ]}
      manualRange={{ from: "2026-03-01", to: "2026-03-08" }}
      syncRunning={false}
      previewLoading={false}
      mstFilterNotice="0100109106"
      showPreviewRange
      previewRangeLabel="01/03/2026 - 08/03/2026"
      previewLimited
      syncPreflightChecks={[
        {
          key: "backend",
          label: "Backend đồng bộ sẵn sàng",
          status: "pass",
          detail: "Backend đang phản hồi bình thường.",
        },
        {
          key: "range",
          label: "Khoảng dữ liệu hợp lệ",
          status: "warn",
          detail: "Chưa chọn khoảng ngày thủ công. Lần chạy này sẽ dùng RangeDays mặc định trong cấu hình.",
        },
      ]}
      syncPreflightSummary={{ ready: true, blockingCount: 0, warningCount: 1 }}
      syncActivityLog={[
        {
          id: "log-1",
          level: "info",
          at: "2026-03-11T08:09:10.000Z",
          message: "Đã tạo job đồng bộ.",
        },
      ]}
      syncHistory={[
        {
          id: "job-history-1",
          actor: "tester",
          status: "completed",
          from: "2026-03-01",
          to: "2026-03-08",
          finishedAt: "2026-03-11T08:10:10.000Z",
          mstFilterNotice: "Lọc theo chỉ MST: 0100109106",
          resultSummary: {
            imported: 1,
            updated: 2,
            skipped: 0,
            reviewLocked: 1,
            affectedRows: 3,
            previewedRows: 4,
          },
        },
      ]}
      syncResumeJob={{ id: "job-1" }}
      syncResumeLabel="Job lưu lúc 11/03/2026 15:09:10 cho khoảng 2026-03-01 → 2026-03-08."
      previewRows={[
        {
          so_tk: "102030",
          date: "2026-03-07",
          mst: "0100109106",
          cong_ty: "Công ty A",
          nhan_vien: "",
          status: "new",
        },
      ]}
      previewConflictSummary={{
        totalRows: 3,
        newCount: 1,
        existingCount: 2,
        overwriteCount: 2,
        unchangedCount: 0,
        lockedCount: 1,
      }}
      previewConflictWarningActive
      syncProgressSteps={[
        {
          key: "commit",
          label: "Đồng bộ dữ liệu từ ECUS",
          status: "done",
          detail: "Đã nhập 1 mới, cập nhật 0, bỏ qua 0, khóa 0.",
        },
        {
          key: "reconcile",
          label: "Làm mới cấu hình, trạng thái và cảnh báo",
          status: "active",
          detail: "Đang tải lại cấu hình, trạng thái kết nối và cảnh báo sau khi đồng bộ.",
        },
        {
          key: "refreshDeclRows",
          label: "Tải lại tờ khai từ server",
          status: "pending",
          detail: "",
        },
      ]}
      syncMessage="Đã đồng bộ thành công"
      syncError=""
      syncRecoveryHints={[
        {
          key: "retry-backend",
          title: "Làm mới trạng thái rồi thử lại",
          detail: "Bấm 'Kiểm tra kết nối', chờ Backend và SQL Server về trạng thái sẵn sàng, rồi thử lại thao tác xem trước hoặc đồng bộ.",
        },
      ]}
      formatDate={(value) => `fmt:${value}`}
      {...handlers}
    />,
  );

  return handlers;
}

afterEach(() => {
  cleanup();
});

describe("DataImporterSyncPreviewPanel", () => {
  it("hiển thị preview panel và gọi đúng callback", async () => {
    const user = userEvent.setup();
    const handlers = renderPanel();

    await user.click(screen.getByRole("button", { name: "7 ngày" }));
    await user.type(screen.getByDisplayValue("2026-03-01"), "9");
    await user.type(screen.getByDisplayValue("2026-03-08"), "0");
    await user.click(screen.getByRole("button", { name: "Xem trước dữ liệu" }));
    await user.click(screen.getByRole("button", { name: "Đồng bộ ngay" }));
    await user.click(screen.getByRole("button", { name: "Tiếp tục job dang dở" }));

    expect(handlers.onApplyRangePreset).toHaveBeenCalledWith(7);
    expect(handlers.onManualRangeChange).toHaveBeenCalled();
    expect(handlers.onPreview).toHaveBeenCalledTimes(1);
    expect(handlers.onRunSync).toHaveBeenCalledTimes(1);
    expect(handlers.onResumeSync).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Đang bật bộ lọc MST: 0100109106.")).toBeInTheDocument();
    expect(screen.getByText("Checklist trước khi chạy")).toBeInTheDocument();
    expect(screen.getByText("Sẵn sàng chạy")).toBeInTheDocument();
    expect(screen.getByText("Job lưu lúc 11/03/2026 15:09:10 cho khoảng 2026-03-01 → 2026-03-08.")).toBeInTheDocument();
    expect(screen.getByText("Khoảng xem trước: 01/03/2026 - 08/03/2026 (giới hạn 100 dòng đầu tiên)")).toBeInTheDocument();
    expect(screen.getByText("Gợi ý khắc phục")).toBeInTheDocument();
    expect(screen.getByText("Làm mới trạng thái rồi thử lại")).toBeInTheDocument();
    expect(screen.getByText("Cảnh báo overwrite trước khi đồng bộ")).toBeInTheDocument();
    expect(screen.getByText(/2 tờ khai đã tồn tại sẽ bị cập nhật/)).toBeInTheDocument();
    expect(screen.getByText(/1 tờ khai đang khóa rà soát sẽ bị bỏ qua/)).toBeInTheDocument();
    expect(screen.getByText("Xem trước 1 dòng đầu tiên sẽ nhập vào hệ thống.")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Bảng xem trước dữ liệu đồng bộ ECUS" })).toBeInTheDocument();
    expect(screen.getByText("fmt:2026-03-07")).toBeInTheDocument();
    expect(screen.getByText("(chưa gán)")).toBeInTheDocument();
    expect(screen.getByText("Mới")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Tiến trình đồng bộ ECUS" })).toBeInTheDocument();
    expect(screen.getByText("Đồng bộ dữ liệu từ ECUS")).toBeInTheDocument();
    expect(screen.getByText("Đã nhập 1 mới, cập nhật 0, bỏ qua 0, khóa 0.")).toBeInTheDocument();
    expect(screen.getByText("Làm mới cấu hình, trạng thái và cảnh báo")).toBeInTheDocument();
    expect(screen.getByText("Đang chạy")).toBeInTheDocument();
    expect(screen.getByText("Nhật ký queue và retry")).toBeInTheDocument();
    expect(screen.getByText(/Đã tạo job đồng bộ/)).toBeInTheDocument();
    expect(screen.getByText("Lịch sử đồng bộ gần đây")).toBeInTheDocument();
    expect(screen.getByText(/tester ·/)).toBeInTheDocument();
    expect(screen.getByText("Khoảng chạy: 2026-03-01 → 2026-03-08")).toBeInTheDocument();
    expect(screen.getByText(/Tác động 3 bản ghi/)).toBeInTheDocument();
    expect(screen.getByText("Lọc theo chỉ MST: 0100109106")).toBeInTheDocument();
    expect(screen.getByText("Đã đồng bộ thành công")).toBeInTheDocument();
  });

  it("khóa thao tác khi đang chạy và hiển thị lỗi preview", () => {
    render(
      <DataImporterSyncPreviewPanel
        rangePresets={[{ days: 1, label: "Hôm nay" }]}
        manualRange={{ from: "", to: "" }}
        syncRunning
        previewLoading
        syncProgressSteps={[
          {
            key: "commit",
            label: "Đồng bộ dữ liệu từ ECUS",
            status: "error",
            detail: "HTTP 500",
          },
        ]}
        previewError="Không thể tải xem trước"
        syncError="Đồng bộ thất bại"
        syncRecoveryHints={[
          {
            key: "network",
            title: "Kiểm tra mạng trước khi chạy lại",
            detail: "Lỗi hiện tại giống mất kết nối hoặc timeout. Hãy kiểm tra VPN, Wi-Fi hoặc mạng nội bộ rồi chạy lại thao tác vừa thất bại.",
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Hôm nay" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang xem trước..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang đồng bộ..." })).toBeDisabled();
    expect(screen.getByText("HTTP 500")).toBeInTheDocument();
    expect(screen.getByText("Gặp lỗi")).toBeInTheDocument();
    expect(screen.getByText("Không thể tải xem trước")).toBeInTheDocument();
    expect(screen.getByText("Đồng bộ thất bại")).toBeInTheDocument();
    expect(screen.getByText("Kiểm tra mạng trước khi chạy lại")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Bảng xem trước dữ liệu đồng bộ ECUS" })).not.toBeInTheDocument();
  });

  it("replaces the inline table with a handoff note after sync preview is promoted", () => {
    render(
      <DataImporterSyncPreviewPanel
        previewRows={[
          {
            so_tk: "102030",
            date: "2026-03-07",
            mst: "0100109106",
            cong_ty: "Công ty A",
            nhan_vien: "",
            status: "new",
          },
        ]}
        showPreviewTableInline={false}
      />,
    );

    expect(
      screen.getByText("Dữ liệu xem trước đã được chuyển sang bước 2 để rà soát trước khi đồng bộ."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Bảng xem trước dữ liệu đồng bộ ECUS" })).not.toBeInTheDocument();
  });
});
