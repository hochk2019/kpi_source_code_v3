import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterGridToolbarControls from "@/components/dataImporter/DataImporterGridToolbarControls.jsx";

afterEach(() => {
  cleanup();
});

function renderToolbar(props = {}) {
  const handlers = {
    onChangeViewMode: vi.fn(),
    onChangeFreezeColumnsEnabled: vi.fn(),
    onChangeCardGridColumns: vi.fn(),
    onChangePageSizeSelect: vi.fn(),
    onChangePageSizeCustomInput: vi.fn(),
    onToggleShowDeletedRows: vi.fn(),
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    onSaveAll: vi.fn(),
    ...props,
  };

  render(
    <DataImporterGridToolbarControls
      shouldUseServerSearch
      serverSearchState={{
        loading: false,
        total: 321,
        error: "",
      }}
      total={200}
      safePage={2}
      maxPage={5}
      viewMode="table"
      freezeColumnsEnabled={false}
      appliedCardColumns={2}
      effectiveCardColumns={2}
      cardGridColumnOptions={[1, 2, 3]}
      pageSize={20}
      pageSizeMode="preset"
      pageSizeCustomInput=""
      pageSizeOptions={[10, 20, 50]}
      showDeletedRows={false}
      deletedRowCount={12}
      canEdit
      canSave
      {...handlers}
    />,
  );

  return handlers;
}

describe("DataImporterGridToolbarControls", () => {
  it("hiển thị table toolbar và gọi callback cho các thao tác chính", async () => {
    const user = userEvent.setup();
    const handlers = renderToolbar();

    expect(screen.getByText(/Đang lọc trên máy chủ/)).toBeInTheDocument();
    expect(screen.getByText(/321 dòng phù hợp/)).toBeInTheDocument();
    expect(screen.getByText("200 dòng — Trang 2/5")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu chỉnh sửa" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Thẻ" }));
    await user.click(screen.getByRole("switch"));
    await user.selectOptions(screen.getByRole("combobox"), "50");
    await user.click(screen.getByRole("button", { name: "Hiện bản ghi đã xóa (12)" }));
    await user.click(screen.getByRole("button", { name: "« Trước" }));
    await user.click(screen.getByRole("button", { name: "Sau »" }));
    await user.click(screen.getByRole("button", { name: "Lưu chỉnh sửa" }));

    expect(handlers.onChangeViewMode).toHaveBeenCalledWith("card");
    expect(handlers.onChangeFreezeColumnsEnabled).toHaveBeenCalledWith(true);
    expect(handlers.onChangePageSizeSelect).toHaveBeenCalledWith("50");
    expect(handlers.onToggleShowDeletedRows).toHaveBeenCalledTimes(1);
    expect(handlers.onPreviousPage).toHaveBeenCalledTimes(1);
    expect(handlers.onNextPage).toHaveBeenCalledTimes(1);
    expect(handlers.onSaveAll).toHaveBeenCalledTimes(1);
  });

  it("hiển thị card toolbar với trạng thái loading/error và input page size custom", async () => {
    const user = userEvent.setup();
    const handlers = renderToolbar({
      serverSearchState: {
        loading: true,
        total: 0,
        error: "Không thể tải dữ liệu",
      },
      viewMode: "card",
      pageSizeMode: "custom",
      pageSizeCustomInput: "37",
      showDeletedRows: true,
      canSave: false,
    });

    expect(screen.getByText(/đang tải/i)).toBeInTheDocument();
    expect(screen.getByText("Không thể tải dữ liệu")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Bố cục thẻ" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Số dòng mỗi trang tùy chọn" })).toHaveValue(37);
    expect(screen.getByRole("button", { name: "Ẩn bản ghi đã xóa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu chỉnh sửa" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Bảng" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Bố cục thẻ" }), "3");
    await user.type(screen.getByRole("spinbutton", { name: "Số dòng mỗi trang tùy chọn" }), "5");

    expect(handlers.onChangeViewMode).toHaveBeenCalledWith("table");
    expect(handlers.onChangeCardGridColumns).toHaveBeenCalledWith(3);
    expect(handlers.onChangePageSizeCustomInput).toHaveBeenCalled();
  });
});
