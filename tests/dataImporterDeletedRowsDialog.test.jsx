import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterDeletedRowsDialog from "@/components/dataImporter/DataImporterDeletedRowsDialog.jsx";

afterEach(() => {
  cleanup();
});

describe("DataImporterDeletedRowsDialog", () => {
  it("hiển thị thống kê, danh sách đã xóa và gọi retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <DataImporterDeletedRowsDialog
        open
        onOpenChange={vi.fn()}
        rangeLabel="02/07/2025 - 02/07/2025"
        totalCount={2}
        softDeletedCount={1}
        hardDeletedCount={1}
        hardDeletedError="Tải lỗi"
        onRetry={onRetry}
        entries={[
          {
            key: "tk-1",
            soTk: "TK-CO-DELETED-SOFT",
            branch: "HN",
            mst: "0100000999",
            company: "Công ty đã xóa mềm",
            tone: "warning",
            typeLabel: "Đã xóa tạm thời",
            dateLabel: "02/07/2025",
            deletedAtLabel: "04/07/2025 08:30:00",
            deletedByLabel: "manager",
          },
          {
            key: "tk-2",
            soTk: "TK-HARD-RECENT",
            branch: "HP",
            mst: "0100000777",
            company: "Công ty xóa cứng gần đây",
            tone: "danger",
            typeLabel: "Đã xóa vĩnh viễn",
            dateLabel: "02/07/2025",
            deletedAtLabel: "06/07/2025 09:15:00",
            deletedByLabel: "admin",
          },
        ]}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Danh sách tờ khai đã xóa" })).toBeInTheDocument();
    expect(screen.getByText("Khoảng thời gian: 02/07/2025 - 02/07/2025")).toBeInTheDocument();
    expect(screen.getByText("Tổng số: 2")).toBeInTheDocument();
    expect(screen.getByText(/Xóa tạm thời: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Xóa vĩnh viễn: 1/)).toBeInTheDocument();
    expect(screen.getByTestId("deleted-list-table")).toBeInTheDocument();
    expect(screen.getByText("TK-CO-DELETED-SOFT")).toBeInTheDocument();
    expect(screen.getByText("TK-HARD-RECENT")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thử tải lại" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hiển thị trạng thái loading và empty khi không có dữ liệu", () => {
    const { rerender } = render(
      <DataImporterDeletedRowsDialog
        open
        onOpenChange={vi.fn()}
        hardDeletedLoading
      />,
    );

    expect(screen.getByText("Đang tải danh sách xóa vĩnh viễn...")).toBeInTheDocument();
    expect(screen.getByText("Đang tải dữ liệu tờ khai đã xóa...")).toBeInTheDocument();

    rerender(
      <DataImporterDeletedRowsDialog
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Không có tờ khai nào phù hợp với điều kiện lọc hiện tại.")).toBeInTheDocument();
  });
});
