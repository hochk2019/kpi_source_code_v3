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
      syncMessage="Đã đồng bộ thành công"
      syncError=""
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

    expect(handlers.onApplyRangePreset).toHaveBeenCalledWith(7);
    expect(handlers.onManualRangeChange).toHaveBeenCalled();
    expect(handlers.onPreview).toHaveBeenCalledTimes(1);
    expect(handlers.onRunSync).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Đang bật bộ lọc MST: 0100109106.")).toBeInTheDocument();
    expect(screen.getByText("Khoảng xem trước: 01/03/2026 - 08/03/2026 (giới hạn 100 dòng đầu tiên)")).toBeInTheDocument();
    expect(screen.getByText("Xem trước 1 dòng đầu tiên sẽ nhập vào hệ thống.")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Bảng xem trước dữ liệu đồng bộ ECUS" })).toBeInTheDocument();
    expect(screen.getByText("fmt:2026-03-07")).toBeInTheDocument();
    expect(screen.getByText("(chưa gán)")).toBeInTheDocument();
    expect(screen.getByText("Mới")).toBeInTheDocument();
    expect(screen.getByText("Đã đồng bộ thành công")).toBeInTheDocument();
  });

  it("khóa thao tác khi đang chạy và hiển thị lỗi preview", () => {
    render(
      <DataImporterSyncPreviewPanel
        rangePresets={[{ days: 1, label: "Hôm nay" }]}
        manualRange={{ from: "", to: "" }}
        syncRunning
        previewLoading
        previewError="Không thể tải xem trước"
        syncError="Đồng bộ thất bại"
      />,
    );

    expect(screen.getByRole("button", { name: "Hôm nay" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang xem trước..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang đồng bộ..." })).toBeDisabled();
    expect(screen.getByText("Không thể tải xem trước")).toBeInTheDocument();
    expect(screen.getByText("Đồng bộ thất bại")).toBeInTheDocument();
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
