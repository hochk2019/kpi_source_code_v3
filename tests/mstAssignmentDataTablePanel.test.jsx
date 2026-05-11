import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MstAssignmentDataTablePanel from "@/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx";

function PageSizeControlStub({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(25)}>
      Page size: {value}
    </button>
  );
}

function CompanyNameCellStub({ value, onChange, isReadOnly }) {
  return (
    <input
      aria-label="company-cell"
      value={value}
      readOnly={isReadOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function AssigneeCellStub({ placeholder, onSelect }) {
  return (
    <button
      type="button"
      onClick={() =>
        onSelect({
          staffName: placeholder.includes("nhập") ? "Người nhập" : "Người xuất",
          teamName: "Đội A",
          isCustom: false,
        })
      }
    >
      {placeholder}
    </button>
  );
}

function PersonColumnHeaderStub({ columnKey }) {
  return <span>{columnKey}</span>;
}

function renderPanel(overrides = {}) {
  const defaultRow = {
    mst: "0312345678",
    company: "Công ty A",
    person_import: "",
    person_export: "",
    team: "Đội A",
    effective_from: "2024-01-01",
    effective_to: "",
    __originalKey: "0312345678||2024-01-01",
  };

  const props = {
    pageRows: [],
    filteredCount: 0,
    page: 1,
    totalPages: 1,
    pageSize: 10,
    recentlyImportedCount: 0,
    recentlyImportedKeys: new Set(),
    canEdit: true,
    isReadOnly: false,
    rosterTeams: [],
    historyIndex: new Map(),
    timelineGroupsByMST: new Map(),
    visibleColumnKeys: ["mst", "company", "person_import", "person_export", "status", "effective_from", "effective_to", "actions"],
    columnMenuOpen: true,
    setColumnMenuOpen: vi.fn(),
    isColumnVisible: (key) =>
      ["mst", "company", "person_import", "person_export", "status", "effective_from", "effective_to", "actions"].includes(
        key
      ),
    toggleColumnVisibility: vi.fn(),
    handleResetColumnWidths: vi.fn(),
    columnStyleMap: {
      mst: {},
      company: {},
      person_import: {},
      person_export: {},
      status: {},
      effective_from: {},
      effective_to: {},
      actions: {},
    },
    handleColumnResizeStart: vi.fn(),
    rowHasChanges: vi.fn(() => false),
    onRowChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    onMstChange: vi.fn(),
    onImportAssigneeSelect: vi.fn(),
    onExportAssigneeSelect: vi.fn(),
    onStartNewStage: vi.fn(),
    onCommitRow: vi.fn(),
    onRemoveRow: vi.fn(),
    onOpenTimelineGroup: vi.fn(),
    makeRowKey: vi.fn((row) => `${row.mst || ""}::${row.effective_from || ""}`),
    formatISODate: vi.fn((value) => value || ""),
    formatHistoryTime: vi.fn((value) => value || ""),
    buildStatusViewModel: vi.fn(() => ({
      statusValue: "assigned",
      statusDisplay: "Đã gán",
      isStatusAssigned: true,
      isStatusPending: false,
      isStatusWarning: false,
    })),
    historyFieldLabels: {
      person_import: "Phụ trách nhập",
      person_export: "Phụ trách xuất",
      effective_from: "Áp dụng từ ngày",
      effective_to: "Đến hết ngày",
    },
    PageSizeControlComponent: PageSizeControlStub,
    CompanyNameCellComponent: CompanyNameCellStub,
    AssigneeCellComponent: AssigneeCellStub,
    PersonColumnHeaderComponent: PersonColumnHeaderStub,
    children: <div>Dòng thời gian</div>,
    ...overrides,
  };

  return {
    ...props,
    row: defaultRow,
    ...render(<MstAssignmentDataTablePanel {...props} />),
  };
}

afterEach(() => {
  cleanup();
});

describe("MstAssignmentDataTablePanel", () => {
  it("renders empty state and column controls", () => {
    const toggleColumnVisibility = vi.fn();
    const handleResetColumnWidths = vi.fn();

    renderPanel({
      toggleColumnVisibility,
      handleResetColumnWidths,
      visibleColumnKeys: ["mst", "company", "actions"],
      isColumnVisible: (key) => ["mst", "company", "actions"].includes(key),
    });

    expect(screen.getByText(/Chưa có dữ liệu/i)).toBeInTheDocument();
    expect(screen.getByText(/Cột hiển thị \(3\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Công ty" }));
    expect(toggleColumnVisibility).toHaveBeenCalledWith("company");

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại chiều rộng" }));
    expect(handleResetColumnWidths).toHaveBeenCalledTimes(1);
  });

  it("wires row actions, badges, and pagination callbacks", () => {
    const row = {
      mst: "0312345678",
      company: "Công ty A",
      person_import: "",
      person_export: "",
      team: "Đội A",
      effective_from: "2024-01-01",
      effective_to: "",
      __originalKey: "0312345678||2024-01-01",
    };
    const makeRowKey = vi.fn((currentRow) => `${currentRow.mst}::${currentRow.effective_from}`);
    const onMstChange = vi.fn();
    const onImportAssigneeSelect = vi.fn();
    const onExportAssigneeSelect = vi.fn();
    const onStartNewStage = vi.fn();
    const onCommitRow = vi.fn();
    const onRemoveRow = vi.fn();
    const onPreviousPage = vi.fn();
    const onNextPage = vi.fn();
    const onPageSizeChange = vi.fn();

    renderPanel({
      pageRows: [row],
      filteredCount: 1,
      page: 2,
      totalPages: 3,
      pageSize: 10,
      recentlyImportedCount: 1,
      recentlyImportedKeys: new Set([makeRowKey(row)]),
      rowHasChanges: vi.fn(() => true),
      onMstChange,
      onImportAssigneeSelect,
      onExportAssigneeSelect,
      onStartNewStage,
      onCommitRow,
      onRemoveRow,
      onPreviousPage,
      onNextPage,
      onPageSizeChange,
      makeRowKey,
      timelineGroupsByMST: new Map([
        [
          row.mst,
          {
            mst: row.mst,
            company: row.company,
            stages: [row],
            conflictSummary: {
              hasConflict: true,
              activeStageCount: 2,
              suggestions: [
                "Giữ 1 dòng hiện hành và chốt ngày kết thúc cho các dòng còn lại.",
              ],
            },
          },
        ],
      ]),
    });

    expect(screen.getAllByText(/Mới import/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Đã chỉnh sửa/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Trùng gán/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /MST này đang có trùng gán hiện hành\. Mở timeline để rà soát chi tiết\./i
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Dòng thời gian/i)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("0312345678"), {
      target: { value: "03-123-456-78" },
    });
    expect(onMstChange).toHaveBeenCalledWith(row, "03-123-456-78");

    fireEvent.click(screen.getByRole("button", { name: "Chọn nhân viên nhập" }));
    expect(onImportAssigneeSelect).toHaveBeenCalledWith(
      row,
      expect.objectContaining({ staffName: "Người nhập", teamName: "Đội A" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Chọn nhân viên xuất" }));
    expect(onExportAssigneeSelect).toHaveBeenCalledWith(
      row,
      expect.objectContaining({ staffName: "Người xuất", teamName: "Đội A" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Giai đoạn mới" }));
    expect(onStartNewStage).toHaveBeenCalledWith(row);

    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
    expect(onCommitRow).toHaveBeenCalledWith(row);

    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
    expect(onRemoveRow).toHaveBeenCalledWith(row);

    fireEvent.click(screen.getByRole("button", { name: "Page size: 10" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(25);

    fireEvent.click(screen.getByRole("button", { name: "← Trước" }));
    expect(onPreviousPage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Sau →" }));
    expect(onNextPage).toHaveBeenCalledTimes(1);
  });

  it("shows inline resolution suggestions for grouped rows with duplicate active stages", () => {
    const groupedRow = {
      mst: "0312345678",
      company: "Công ty A",
      person_import: "Lan",
      person_export: "Hà",
      effective_from: "2024-03-01",
      effective_to: "",
      __group: true,
    };

    renderPanel({
      pageRows: [groupedRow],
      timelineGroupsByMST: new Map([
        [
          groupedRow.mst,
          {
            mst: groupedRow.mst,
            company: groupedRow.company,
            stages: [groupedRow],
            conflictSummary: {
              hasConflict: true,
              activeStageCount: 2,
              suggestions: [
                "Giữ 1 dòng hiện hành và chốt ngày kết thúc cho các dòng còn lại.",
                "Nếu đang bàn giao, hãy chuyển người phụ trách sang dòng mới nhất rồi khóa giai đoạn cũ.",
              ],
            },
          },
        ],
      ]),
    });

    expect(screen.getByText(/Gợi ý xử lý nhanh:/i)).toBeInTheDocument();
    expect(screen.getByText(/Giữ 1 dòng hiện hành và chốt ngày kết thúc cho các dòng còn lại\./i)).toBeInTheDocument();
    expect(screen.getByText(/Nếu đang bàn giao, hãy chuyển người phụ trách sang dòng mới nhất rồi khóa giai đoạn cũ\./i)).toBeInTheDocument();
  });
});
