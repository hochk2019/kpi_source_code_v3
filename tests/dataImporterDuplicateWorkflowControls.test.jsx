import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import DataImporterDuplicateWorkflowControls from "@/components/dataImporter/DataImporterDuplicateWorkflowControls.jsx";

afterEach(() => {
  cleanup();
});

function createProps(overrides = {}) {
  return {
    filterDuplicate11: false,
    hasDuplicate11Rows: true,
    canResolveDuplicates11: true,
    duplicate11GroupCount: 4,
    duplicate11PlannedRemovalCount: 7,
    duplicate11PlannedReviewGroups: 2,
    duplicate11TotalRows: 11,
    canEdit: true,
    mode: "saved",
    filteredKeyCount: 8,
    canAutoReconcile: true,
    onToggleDuplicateFilter: vi.fn(),
    onDeleteDuplicates11: vi.fn(),
    onAutoApplyLicenseExclusion: vi.fn(),
    ...overrides,
  };
}

describe("DataImporterDuplicateWorkflowControls", () => {
  it("renders duplicate workflow actions, status, and forwards interactions", () => {
    const props = createProps();

    render(<DataImporterDuplicateWorkflowControls {...props} />);

    expect(screen.getByRole("button", { name: "Lọc tờ khai trùng 11 số đầu" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Xử lý tờ khai trùng 11 số đầu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đối chiếu KPI tự động" })).toBeEnabled();
    expect(
      screen.getByText(
        "4 nhóm trùng • dự kiến xóa 7 bản • 2 nhóm sẽ được đánh dấu rà soát • tổng 11 dòng",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lọc tờ khai trùng 11 số đầu" }));
    fireEvent.click(screen.getByRole("button", { name: "Xử lý tờ khai trùng 11 số đầu" }));
    fireEvent.click(screen.getByRole("button", { name: "Đối chiếu KPI tự động" }));

    expect(props.onToggleDuplicateFilter).toHaveBeenCalledTimes(1);
    expect(props.onDeleteDuplicates11).toHaveBeenCalledTimes(1);
    expect(props.onAutoApplyLicenseExclusion).toHaveBeenCalledTimes(1);
  });

  it("hides duplicate summary and destructive action when duplicate rows are unavailable", () => {
    render(
      <DataImporterDuplicateWorkflowControls
        {...createProps({
          hasDuplicate11Rows: false,
          canResolveDuplicates11: false,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Lọc tờ khai trùng 11 số đầu" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Xử lý tờ khai trùng 11 số đầu" })).toBeNull();
    expect(screen.queryByText(/nhóm trùng/)).toBeNull();
  });

  it("disables auto reconcile when the current user or result set cannot run it", () => {
    render(
      <DataImporterDuplicateWorkflowControls
        {...createProps({
          canAutoReconcile: false,
          filteredKeyCount: 0,
        })}
      />,
    );

    const button = screen.getByRole("button", { name: "Đối chiếu KPI tự động" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "data-tooltip",
      "Chỉ Quản lý hoặc Quản trị viên mới được phép đối chiếu KPI tự động",
    );
  });
});
