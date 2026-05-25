import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterDuplicateReviewDialog from "@/components/dataImporter/DataImporterDuplicateReviewDialog.jsx";

afterEach(() => {
  cleanup();
});

const duplicateMergeFields = [
  { key: "staff", label: "Nhân viên" },
  { key: "kpi", label: "KPI" },
];

function renderDialog(props = {}) {
  const handlers = {
    onOpenChange: vi.fn(),
    onConfirmedChange: vi.fn(),
    onChangeKeeper: vi.fn(),
    onOpenDuplicateDiff: vi.fn(),
    onChangeMerge: vi.fn(),
    onChangeResolution: vi.fn(),
    onChangeNote: vi.fn(),
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...props,
  };

  render(
    <DataImporterDuplicateReviewDialog
      open
      duplicate11Details={[
        {
          prefix: "12345678901",
          rawPrefix: "12345678901",
          total: 2,
          keeperLabel: "TK-001",
          referenceTimestampLabel: "Cập nhật",
          referenceTimestamp: "2026-03-10 08:30",
          items: [
            {
              key: "keep",
              label: "TK-001",
              sourceLabel: "Excel",
              timestampDisplay: "2026-03-10 08:30",
              timestampLabel: "Mới nhất",
              staff: "An",
              team: "Team A",
              status: "Đã xử lý",
              kpi: 12,
              score: 90,
            },
            {
              key: "cmp",
              label: "TK-002",
              sourceLabel: "ECUS",
              timestampDisplay: "2026-03-09 17:20",
              timestampLabel: "Bản cũ",
              staff: "Bình",
              team: "Team B",
              status: "Chưa xử lý",
              kpi: 7,
              score: 75,
            },
          ],
        },
      ]}
      duplicate11Plan={{
        "12345678901": {
          keeperKey: "keep",
          merges: {
            staff: "cmp",
            kpi: "keep",
          },
          resolution: "delete",
          note: "",
        },
      }}
      duplicate11PlanHasActions
      duplicate11PlannedRemovalCount={1}
      duplicate11PlannedDeleteGroups={1}
      duplicate11PlannedReviewGroups={0}
      duplicateReviewConfirmed={false}
      duplicateMergeFields={duplicateMergeFields}
      {...handlers}
    />,
  );

  return handlers;
}

describe("DataImporterDuplicateReviewDialog", () => {
  it("hiển thị dialog và gọi callback cho thao tác rà soát chính", async () => {
    const user = userEvent.setup();
    const handlers = renderDialog();

    expect(screen.getByRole("dialog", { name: "Rà soát tờ khai trùng 11 số đầu" })).toBeInTheDocument();
    expect(screen.getByText(/Dự kiến xóa/)).toBeInTheDocument();
    expect(screen.getAllByText("TK-001")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Thực hiện xử lý" })).toBeDisabled();

    await user.click(screen.getAllByRole("radio", { name: /Giữ/i })[1]);
    await user.click(screen.getAllByRole("button", { name: "So sánh" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Nhân viên" }), "keep");
    await user.selectOptions(screen.getByRole("combobox", { name: "Hành động cho nhóm" }), "review");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Hủy" }));

    expect(handlers.onChangeKeeper).toHaveBeenCalledWith("12345678901", "cmp");
    expect(handlers.onOpenDuplicateDiff).toHaveBeenCalledWith("12345678901", "keep", "cmp");
    expect(handlers.onChangeMerge).toHaveBeenCalledWith("12345678901", "staff", "keep");
    expect(handlers.onChangeResolution).toHaveBeenCalledWith("12345678901", "review");
    expect(handlers.onConfirmedChange).toHaveBeenCalledWith(true);
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it("hiển thị trạng thái review và cho phép xác nhận khi parent đã approve", async () => {
    const user = userEvent.setup();
    const handlers = renderDialog({
      duplicate11Plan: {
        "12345678901": {
          keeperKey: "keep",
          merges: {
            staff: "cmp",
            kpi: "keep",
          },
          resolution: "review",
          note: "Cần đối chiếu thêm với phòng chứng từ",
        },
      },
      duplicate11PlannedRemovalCount: 0,
      duplicate11PlannedDeleteGroups: 0,
      duplicate11PlannedReviewGroups: 1,
      duplicateReviewConfirmed: true,
    });

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" && element.textContent?.includes("1 nhóm sẽ được đánh dấu cần rà soát thay vì xóa"),
      ),
    ).toBeInTheDocument();

    const noteField = screen.getByRole("textbox", { name: /Ghi chú/i });
    expect(noteField).toHaveValue("Cần đối chiếu thêm với phòng chứng từ");

    await user.type(noteField, " thêm");
    const confirmButton = screen.getByRole("button", { name: "Thực hiện xử lý" });
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(handlers.onChangeNote).toHaveBeenCalled();
    expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("hiển thị trạng thái empty khi không có nhóm trùng cần rà soát", () => {
    render(
      <DataImporterDuplicateReviewDialog
        open
        onOpenChange={vi.fn()}
        onConfirmedChange={vi.fn()}
        duplicate11Details={[]}
        duplicate11Plan={{}}
        duplicate11PlanHasActions={false}
        duplicate11PlannedRemovalCount={0}
        duplicate11PlannedDeleteGroups={0}
        duplicate11PlannedReviewGroups={0}
        duplicateReviewConfirmed={false}
        duplicateMergeFields={duplicateMergeFields}
        onChangeKeeper={vi.fn()}
        onOpenDuplicateDiff={vi.fn()}
        onChangeMerge={vi.fn()}
        onChangeResolution={vi.fn()}
        onChangeNote={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/Hãy chọn bản giữ lại hoặc chuyển nhóm sang trạng thái “Cần rà soát” trước khi xác nhận\./i)).toBeInTheDocument();
    expect(screen.getByText(/Không tìm thấy nhóm trùng để rà soát\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thực hiện xử lý" })).toBeDisabled();
  });
});
