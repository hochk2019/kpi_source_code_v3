import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterDuplicateDiffDialog from "@/components/dataImporter/DataImporterDuplicateDiffDialog.jsx";

afterEach(() => {
  cleanup();
});

function renderDialog(props = {}) {
  const handlers = {
    onOpenChange: vi.fn(),
    onChangeBase: vi.fn(),
    onChangeCompare: vi.fn(),
    onSwap: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };

  render(
    <DataImporterDuplicateDiffDialog
      open
      duplicateDiffGroup={{
        total: 2,
        items: [
          { key: "keep", label: "TK-001", sourceLabel: "Excel" },
          { key: "cmp", label: "TK-002", sourceLabel: "ECUS" },
        ],
      }}
      duplicateDiffGroupLabel="12345678901"
      duplicateDiffBaseLabel="TK-001"
      duplicateDiffCompareLabel="TK-002"
      duplicateDiffBaseItem={{ key: "keep" }}
      duplicateDiffCompareItem={{ key: "cmp" }}
      duplicateDiffChangedCount={2}
      duplicateDiffGroups={[
        {
          title: "Thông tin chung",
          rows: [
            { key: "company", label: "Doanh nghiệp", baseValue: "Công ty A", compareValue: "Công ty B", changed: true },
            { key: "staff", label: "Nhân viên", baseValue: "", compareValue: "An", changed: true },
          ],
        },
      ]}
      {...handlers}
    />,
  );

  return handlers;
}

describe("DataImporterDuplicateDiffDialog", () => {
  it("hiển thị diff dialog và gọi callback tương ứng", async () => {
    const user = userEvent.setup();
    const handlers = renderDialog();

    expect(screen.getByRole("dialog", { name: "So sánh bản ghi trùng" })).toBeInTheDocument();
    expect(screen.getByText(/trong nhóm 12345678901/)).toBeInTheDocument();
    expect(screen.getByText(/2 trường khác nhau/i)).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);

    await user.selectOptions(selects[0], "cmp");
    await user.selectOptions(selects[1], "cmp");
    await user.click(screen.getByRole("button", { name: "Đổi vị trí" }));
    await user.click(screen.getByRole("button", { name: "Đóng" }));

    expect(handlers.onChangeBase).toHaveBeenCalledWith("cmp");
    expect(handlers.onChangeCompare).toHaveBeenCalledWith("cmp");
    expect(handlers.onSwap).toHaveBeenCalledTimes(1);
    expect(handlers.onClose).toHaveBeenCalledTimes(1);

    const table = screen.getByRole("table");
    expect(within(table).getByText(/Doanh nghiệp/i)).toBeInTheDocument();
    expect(within(table).getByText(/Công ty A/i)).toBeInTheDocument();
    expect(within(table).getByText(/Công ty B/i)).toBeInTheDocument();
    expect(within(table).getByText(/\(trống\)/i)).toBeInTheDocument();
  });

  it("hiển thị trạng thái empty khi không có nhóm diff", () => {
    render(
      <DataImporterDuplicateDiffDialog
        open
        onOpenChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Không tìm thấy nhóm trùng để so sánh\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
