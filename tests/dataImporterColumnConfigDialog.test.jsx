import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterColumnConfigDialog from "@/components/dataImporter/DataImporterColumnConfigDialog.jsx";

afterEach(() => {
  cleanup();
});

function renderDialog(props = {}) {
  const handlers = {
    onOpenChange: vi.fn(),
    onToggleColumn: vi.fn(),
    onReset: vi.fn(),
    onApply: vi.fn(),
    ...props,
  };

  render(
    <DataImporterColumnConfigDialog
      open
      columnOptions={[
        { id: "so_tk", label: "Số tờ khai" },
        { id: "sensitive_note", label: "Ghi chú nhạy cảm" },
      ]}
      hiddenColumnIds={new Set(["sensitive_note"])}
      visibleCount={7}
      totalCount={8}
      sensitiveColumnIds={new Set(["sensitive_note"])}
      errorMessage="Không thể ẩn tất cả cột"
      {...handlers}
    />,
  );

  return handlers;
}

describe("DataImporterColumnConfigDialog", () => {
  it("hiển thị cấu hình cột và gọi callback cho thao tác cơ bản", async () => {
    const user = userEvent.setup();
    const handlers = renderDialog({ isAdminRole: true });

    expect(screen.getByRole("dialog", { name: "Cấu hình cột Import Data" })).toBeInTheDocument();
    expect(screen.getByText(/Đang giữ 7\/8 mục hiển thị \(bao gồm cột dữ liệu và thao tác\)\./i)).toBeInTheDocument();
    expect(screen.getByText(/Không thể ẩn tất cả cột/i)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();

    await user.click(checkboxes[0]);
    await user.click(screen.getByRole("button", { name: "Đặt lại mặc định" }));
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình" }));

    expect(handlers.onToggleColumn).toHaveBeenCalledWith("so_tk");
    expect(handlers.onReset).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    expect(handlers.onApply).toHaveBeenCalledTimes(1);
  });

  it("khóa cột nhạy cảm khi người dùng không phải admin", () => {
    renderDialog({ isAdminRole: false });

    const sensitiveCheckbox = screen.getAllByRole("checkbox")[1];
    expect(screen.getByText(/Chỉ admin có thể bật\/tắt\./i)).toBeInTheDocument();
    expect(sensitiveCheckbox).toBeDisabled();
  });
});
