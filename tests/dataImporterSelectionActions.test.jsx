import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterSelectionActions from "@/components/dataImporter/DataImporterSelectionActions.jsx";

function renderActions(props = {}) {
  const handlers = {
    onSelectFiltered: vi.fn(),
    onMarkReviewed: vi.fn(),
    onUnmarkReviewed: vi.fn(),
    onDeleteSelected: vi.fn(),
    onHardDeleteSelected: vi.fn(),
    onApplyLicenseExclusion: vi.fn(),
    onExportSelected: vi.fn(),
    onClearSelection: vi.fn(),
    ...props,
  };

  render(
    <DataImporterSelectionActions
      selectedCount={3}
      filteredKeysLength={8}
      filteredSelected={false}
      shouldUseServerSearch={false}
      canReview
      canUnreview
      canEdit
      canDelete
      {...handlers}
    />,
  );

  return handlers;
}

afterEach(() => {
  cleanup();
});

describe("DataImporterSelectionActions", () => {
  it("hiển thị các thao tác chọn nhiều và gọi đúng callback", async () => {
    const user = userEvent.setup();
    const handlers = renderActions();

    expect(screen.getByText("Đã chọn 3 tờ khai")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Chọn tất cả kết quả lọc" }));
    await user.click(screen.getByRole("button", { name: "Đánh dấu đã rà soát" }));
    await user.click(screen.getByRole("button", { name: "Bỏ đánh dấu đã rà soát" }));
    await user.click(screen.getByRole("button", { name: "Đánh dấu xóa các tờ khai đã chọn" }));
    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn các tờ khai đã chọn" }));
    await user.click(screen.getByRole("button", { name: "Đối chiếu giấy phép" }));
    await user.click(screen.getByRole("button", { name: "Export Excel" }));
    await user.click(screen.getByRole("button", { name: "Bỏ chọn" }));

    expect(handlers.onSelectFiltered).toHaveBeenCalledTimes(1);
    expect(handlers.onMarkReviewed).toHaveBeenCalledTimes(1);
    expect(handlers.onUnmarkReviewed).toHaveBeenCalledTimes(1);
    expect(handlers.onDeleteSelected).toHaveBeenCalledTimes(1);
    expect(handlers.onHardDeleteSelected).toHaveBeenCalledTimes(1);
    expect(handlers.onApplyLicenseExclusion).toHaveBeenCalledTimes(1);
    expect(handlers.onExportSelected).toHaveBeenCalledTimes(1);
    expect(handlers.onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("khóa các thao tác không hợp lệ và ẩn nút bỏ chọn khi chưa có lựa chọn", () => {
    render(
      <DataImporterSelectionActions
        selectedCount={0}
        filteredKeysLength={0}
        filteredSelected={false}
        shouldUseServerSearch
        canReview={false}
        canUnreview={false}
        canEdit={false}
        canDelete={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Chọn tất cả kết quả lọc" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đánh dấu đã rà soát" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bỏ đánh dấu đã rà soát" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đối chiếu giấy phép" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Bỏ chọn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đánh dấu xóa các tờ khai đã chọn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xóa vĩnh viễn các tờ khai đã chọn" })).not.toBeInTheDocument();
  });
});
