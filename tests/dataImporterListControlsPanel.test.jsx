import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

let lastQueryFilterControlsProps = null;
let lastFilterPresetControlsProps = null;
let lastDuplicateWorkflowControlsProps = null;
let lastGridToolbarControlsProps = null;
let lastSelectionActionsProps = null;

vi.mock("@/components/dataImporter/DataImporterQueryFilterControls.jsx", () => ({
  default: function MockDataImporterQueryFilterControls(props) {
    lastQueryFilterControlsProps = props;
    return <div>mock-query-filter-controls</div>;
  },
}));

vi.mock("@/components/dataImporter/DataImporterFilterPresetControls.jsx", () => ({
  default: function MockDataImporterFilterPresetControls(props) {
    lastFilterPresetControlsProps = props;
    return <div>mock-filter-preset-controls</div>;
  },
}));

vi.mock("@/components/dataImporter/DataImporterDuplicateWorkflowControls.jsx", () => ({
  default: function MockDataImporterDuplicateWorkflowControls(props) {
    lastDuplicateWorkflowControlsProps = props;
    return <div>mock-duplicate-workflow-controls</div>;
  },
}));

vi.mock("@/components/dataImporter/DataImporterGridToolbarControls.jsx", () => ({
  default: function MockDataImporterGridToolbarControls(props) {
    lastGridToolbarControlsProps = props;
    return <div>mock-grid-toolbar-controls</div>;
  },
}));

vi.mock("@/components/dataImporter/DataImporterSelectionActions.jsx", () => ({
  default: function MockDataImporterSelectionActions(props) {
    lastSelectionActionsProps = props;
    return <div>mock-selection-actions</div>;
  },
}));

import DataImporterListControlsPanel from "@/components/dataImporter/DataImporterListControlsPanel.jsx";

afterEach(() => {
  cleanup();
  lastQueryFilterControlsProps = null;
  lastFilterPresetControlsProps = null;
  lastDuplicateWorkflowControlsProps = null;
  lastGridToolbarControlsProps = null;
  lastSelectionActionsProps = null;
});

function createProps(overrides = {}) {
  return {
    mode: "saved",
    total: 123,
    canEdit: true,
    canOverwriteData: true,
    autoAssignStaff: true,
    upsert11: false,
    overwrite: false,
    pageSize: 25,
    query: "",
    visibleColumnCount: 9,
    totalBaseColumns: 14,
    selectionEnabled: true,
    queryFilterControlsProps: { query: "A11" },
    filterPresetControlsProps: { selectedPresetId: "preset-1" },
    duplicateWorkflowControlsProps: { hasDuplicate11Rows: true },
    gridToolbarControlsProps: { total: 123 },
    selectionActionsProps: { selectedCount: 3 },
    onAutoAssignStaffChange: vi.fn(),
    onUpsert11Change: vi.fn(),
    onOverwriteToggle: vi.fn(),
    onOpenColumnConfig: vi.fn(),
    ...overrides,
  };
}

describe("DataImporterListControlsPanel", () => {
  it("renders the control shell, forwards child props, and wires primary callbacks", () => {
    const props = createProps();

    render(<DataImporterListControlsPanel {...props} />);

    expect(screen.getByRole("region", { name: "Điều khiển danh sách tờ khai" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Bộ lọc tờ khai import" })).toBeInTheDocument();
    expect(screen.getByText(/Dữ liệu đã lưu/i)).toBeInTheDocument();
    expect(screen.getByText(/123 dòng/i)).toBeInTheDocument();
    expect(screen.getByText("mock-query-filter-controls")).toBeInTheDocument();
    expect(screen.getByText("mock-filter-preset-controls")).toBeInTheDocument();
    expect(screen.getByText("mock-duplicate-workflow-controls")).toBeInTheDocument();
    expect(screen.getByText("mock-grid-toolbar-controls")).toBeInTheDocument();
    expect(screen.getByText("mock-selection-actions")).toBeInTheDocument();
    expect(screen.getByText(/Đang hiển thị 9\/14 cột dữ liệu\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/Hiển thị tối đa 25 dòng trên một trang\. Nhập từ khóa hoặc dùng bộ lọc để tìm thêm tờ khai\./i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Tự gán nhân viên theo MST nếu trống (ON)"));
    fireEvent.click(screen.getByLabelText("Upsert theo 11 số đầu của Số tờ khai"));
    fireEvent.click(screen.getByLabelText("Ghi đè toàn bộ dữ liệu hiện có"));
    fireEvent.click(screen.getByRole("button", { name: "Cấu hình cột hiển thị" }));

    expect(props.onAutoAssignStaffChange).toHaveBeenCalledWith(false);
    expect(props.onUpsert11Change).toHaveBeenCalledWith(true);
    expect(props.onOverwriteToggle).toHaveBeenCalledWith(true);
    expect(props.onOpenColumnConfig).toHaveBeenCalledTimes(1);
    expect(lastQueryFilterControlsProps).toEqual({ query: "A11" });
    expect(lastFilterPresetControlsProps).toEqual({ selectedPresetId: "preset-1" });
    expect(lastDuplicateWorkflowControlsProps).toEqual({ hasDuplicate11Rows: true });
    expect(lastGridToolbarControlsProps).toEqual({ total: 123 });
    expect(lastSelectionActionsProps).toEqual({ selectedCount: 3 });
  });

  it("hides edit-only affordances and saved hint outside the saved empty-query state", () => {
    render(
      <DataImporterListControlsPanel
        {...createProps({
          mode: "preview",
          canEdit: false,
          canOverwriteData: false,
          query: "TK-001",
          selectionEnabled: false,
        })}
      />,
    );

    expect(screen.getByText(/Xem trước import/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Tự gán nhân viên theo MST nếu trống (ON)")).toBeNull();
    expect(screen.queryByLabelText("Upsert theo 11 số đầu của Số tờ khai")).toBeNull();
    expect(screen.queryByLabelText("Ghi đè toàn bộ dữ liệu hiện có")).toBeNull();
    expect(screen.queryByText("mock-selection-actions")).toBeNull();
    expect(
      screen.queryByText(/Hiển thị tối đa 25 dòng trên một trang\. Nhập từ khóa hoặc dùng bộ lọc để tìm thêm tờ khai\./i),
    ).toBeNull();
  });

  it("uses sync-preview labeling and hides file-import toggles during ECUS review", () => {
    render(
      <DataImporterListControlsPanel
        {...createProps({
          mode: "preview",
          previewSource: "sync",
          canEdit: true,
          canOverwriteData: true,
          query: "",
        })}
      />,
    );

    expect(screen.getByText(/Xem trước đồng bộ/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Tự gán nhân viên theo MST nếu trống (ON)")).toBeNull();
    expect(screen.queryByLabelText("Upsert theo 11 số đầu của Số tờ khai")).toBeNull();
    expect(screen.queryByLabelText("Ghi đè toàn bộ dữ liệu hiện có")).toBeNull();
    expect(screen.getByText("mock-selection-actions")).toBeInTheDocument();
  });
});
