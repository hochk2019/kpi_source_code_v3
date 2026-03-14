import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataImporterTableBody from "@/components/dataImporter/DataImporterTableBody.jsx";

afterEach(() => {
  cleanup();
});

function StubStaffCombobox({ onSelect }) {
  return (
    <button type="button" onClick={() => onSelect({ staffName: "Bình", teamName: "Team B" })}>
      Chọn nhân viên
    </button>
  );
}

function StubTeamCombobox({ onSelect }) {
  return (
    <button type="button" onClick={() => onSelect({ teamName: "Team C" })}>
      Chọn tổ đội
    </button>
  );
}

function StubAgencyCombobox({ onSelect }) {
  return (
    <button type="button" onClick={() => onSelect("Đại lý mới")}>
      Chọn đại lý
    </button>
  );
}

function StubDeclarationStatusDisplay({ row }) {
  return <span>{`Trạng thái: ${row.status || "unknown"}`}</span>;
}

function renderTableBody(props = {}) {
  const row = {
    so_tk: "TK-001",
    so_tk_full: "TK-001",
    so_tk_suffix: "01",
    date: "2025-08-01",
    raw_date: "2025-08-01",
    mst: "0101234567",
    cong_ty: "Công ty A",
    loai_hinh: "A11",
    muc_hang: 3,
    nhan_vien: "An",
    team: "Team A",
    agency: "Đại lý A",
    licenses: 1,
    reviewed: true,
    duplicate_review_pending: true,
    status: "existing",
  };

  const handlers = {
    buildRowState: vi.fn(() => ({
      rowKey: "row-1",
      rowReadOnly: false,
      rowReadOnlyReason: "",
      rowReviewLocked: false,
      rowDeleted: false,
      rowDeletedAt: "",
      rowDeletedBy: "",
      rowEditable: true,
      canSaveRow: true,
      rowSaving: false,
      rowError: "",
      historyExpanded: false,
      historyList: [],
      historyCount: 2,
      hasPendingDiff: true,
    })),
    onToggleSelect: vi.fn(),
    onSelectStaff: vi.fn(),
    onSelectTeam: vi.fn(),
    onSelectAgency: vi.fn(),
    onChangeLicenseCount: vi.fn(),
    onToggleHistory: vi.fn(),
    onSaveRowChanges: vi.fn(),
    onRestoreSingle: vi.fn(),
    onHardDeleteSingle: vi.fn(),
    onDeleteSingle: vi.fn(),
    getCoDisplay: vi.fn(() => "2"),
    getKpiDisplay: vi.fn(() => "8.5"),
    getFrozenStyle: vi.fn(() => undefined),
    getColumnStyle: vi.fn(() => undefined),
    formatDisplayDate: vi.fn(() => "01/08/2025"),
    formatHistoryTimestamp: vi.fn((value) => `ts:${value}`),
    humanizeDiffKey: vi.fn((value) => value),
    ...props,
  };

  render(
    <table>
      <DataImporterTableBody
        pageRows={[row]}
        totalColumns={16}
        hiddenColumns={new Set()}
        selectionEnabled
        selectedKeys={[]}
        updatedKeySet={new Set(["row-1"])}
        coMismatchKeySet={new Set(["row-1"])}
        duplicate11KeeperSet={new Set(["row-1"])}
        duplicate11DuplicatesSet={new Set(["row-1"])}
        rosterTeams={["Team A", "Team B"]}
        agencyOptions={["Đại lý A", "Đại lý B"]}
        historyEnabled
        updateEnabled
        deleteEnabled
        frozenOffsets={{}}
        frozenCellClass="sticky"
        historyIndent={24}
        declHistoryFieldLabels={{ staff: "Nhân viên" }}
        StaffComboboxComponent={StubStaffCombobox}
        TeamComboboxComponent={StubTeamCombobox}
        AgencyComboboxComponent={StubAgencyCombobox}
        DeclarationStatusDisplayComponent={StubDeclarationStatusDisplay}
        {...handlers}
      />
    </table>,
  );

  return { row, handlers };
}

describe("DataImporterTableBody", () => {
  it("hiển thị row editable và phát callback đúng cho các thao tác bảng", async () => {
    const user = userEvent.setup();
    const { row, handlers } = renderTableBody();

    expect(screen.getByText("TK-001")).toBeInTheDocument();
    expect(screen.getByText("01/08/2025")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cập nhật" })).toBeInTheDocument();
    expect(screen.getByText("CO lệch")).toBeInTheDocument();
    expect(screen.getByText("Giữ mới nhất")).toBeInTheDocument();
    expect(screen.getByText("Trùng 11 số")).toBeInTheDocument();
    expect(screen.getByText("Chưa lưu")).toBeInTheDocument();
    expect(screen.getByText("Trạng thái: existing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Chọn nhân viên" }));
    await user.click(screen.getByRole("button", { name: "Chọn tổ đội" }));
    await user.click(screen.getByRole("button", { name: "Chọn đại lý" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5" } });
    await user.click(screen.getByRole("button", { name: "Nhật ký (2)" }));
    await user.click(screen.getByRole("button", { name: "Cập nhật" }));
    await user.click(screen.getByRole("button", { name: "Đánh dấu xóa" }));
    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }));

    expect(handlers.onToggleSelect).toHaveBeenCalledWith(row);
    expect(handlers.onSelectStaff).toHaveBeenCalledWith("row-1", { staffName: "Bình", teamName: "Team B" });
    expect(handlers.onSelectTeam).toHaveBeenCalledWith("row-1", "Team C");
    expect(handlers.onSelectAgency).toHaveBeenCalledWith("row-1", "Đại lý mới");
    expect(handlers.onChangeLicenseCount).toHaveBeenCalledWith("row-1", "5");
    expect(handlers.onToggleHistory).toHaveBeenCalledWith("row-1");
    expect(handlers.onSaveRowChanges).toHaveBeenCalledWith("row-1");
    expect(handlers.onDeleteSingle).toHaveBeenCalledWith(row);
    expect(handlers.onHardDeleteSingle).toHaveBeenCalledWith(row);
  });

  it("hiển thị history/read-only row và empty state đúng", () => {
    const buildRowState = vi.fn(() => ({
      rowKey: "row-2",
      rowReadOnly: true,
      rowReadOnlyReason: "Khóa rà soát",
      rowReviewLocked: true,
      rowDeleted: true,
      rowDeletedAt: "2025-08-02T03:00:00.000Z",
      rowDeletedBy: "tester",
      rowEditable: false,
      canSaveRow: false,
      rowSaving: false,
      rowError: "Lỗi đồng bộ",
      historyExpanded: true,
      historyList: [
        {
          id: "h1",
          ts: "2025-08-02T03:00:00.000Z",
          actor: "tester",
          changes: [{ field: "staff", before: "An", after: "Bình" }],
        },
      ],
      historyCount: 1,
      hasPendingDiff: false,
    }));

    render(
      <table>
        <DataImporterTableBody
          pageRows={[
            {
              so_tk: "TK-002",
              date: "2025-08-02",
              mst: "0102222222",
              cong_ty: "Công ty B",
              nhan_vien: "An",
              team: "Team A",
              agency: "Đại lý A",
              licenses: 2,
              status: "existing",
            },
          ]}
          totalColumns={16}
          hiddenColumns={new Set()}
          selectionEnabled={false}
          selectedKeys={[]}
          updatedKeySet={new Set()}
          coMismatchKeySet={new Set()}
          duplicate11KeeperSet={new Set()}
          duplicate11DuplicatesSet={new Set()}
          rosterTeams={[]}
          agencyOptions={[]}
          historyEnabled
          updateEnabled
          deleteEnabled
          frozenOffsets={{}}
          frozenCellClass="sticky"
          historyIndent={24}
          buildRowState={buildRowState}
          onToggleSelect={vi.fn()}
          onSelectStaff={vi.fn()}
          onSelectTeam={vi.fn()}
          onSelectAgency={vi.fn()}
          onChangeLicenseCount={vi.fn()}
          onToggleHistory={vi.fn()}
          onSaveRowChanges={vi.fn()}
          onRestoreSingle={vi.fn()}
          onHardDeleteSingle={vi.fn()}
          onDeleteSingle={vi.fn()}
          getCoDisplay={() => "—"}
          getKpiDisplay={() => "-"}
          getFrozenStyle={() => undefined}
          getColumnStyle={() => undefined}
          formatDisplayDate={() => "02/08/2025"}
          formatHistoryTimestamp={() => "02/08/2025 10:00"}
          humanizeDiffKey={(value) => value}
          declHistoryFieldLabels={{ staff: "Nhân viên" }}
          StaffComboboxComponent={StubStaffCombobox}
          TeamComboboxComponent={StubTeamCombobox}
          AgencyComboboxComponent={StubAgencyCombobox}
          DeclarationStatusDisplayComponent={StubDeclarationStatusDisplay}
        />
      </table>,
    );

    expect(screen.getByText("Khóa rà soát")).toBeInTheDocument();
    expect(screen.getByText("Không thể cập nhật")).toBeInTheDocument();
    expect(screen.getByText(/Đã xóa bởi tester lúc 02\/08\/2025 10:00/)).toBeInTheDocument();
    expect(screen.getAllByText("Nhân viên")).toHaveLength(1);
    expect(screen.getAllByText("An")).toHaveLength(2);
    expect(screen.getByText("Bởi: tester")).toBeInTheDocument();
    expect(screen.getByText("Bình")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Khôi phục" })).toBeInTheDocument();

    cleanup();

    render(
      <table>
        <DataImporterTableBody
          pageRows={[]}
          totalColumns={5}
          hiddenColumns={new Set()}
          selectionEnabled={false}
          selectedKeys={[]}
          updatedKeySet={new Set()}
          coMismatchKeySet={new Set()}
          duplicate11KeeperSet={new Set()}
          duplicate11DuplicatesSet={new Set()}
          rosterTeams={[]}
          agencyOptions={[]}
          historyEnabled={false}
          updateEnabled={false}
          deleteEnabled={false}
          frozenOffsets={{}}
          frozenCellClass="sticky"
          historyIndent={0}
          buildRowState={vi.fn()}
          onToggleSelect={vi.fn()}
          onSelectStaff={vi.fn()}
          onSelectTeam={vi.fn()}
          onSelectAgency={vi.fn()}
          onChangeLicenseCount={vi.fn()}
          onToggleHistory={vi.fn()}
          onSaveRowChanges={vi.fn()}
          onRestoreSingle={vi.fn()}
          onHardDeleteSingle={vi.fn()}
          onDeleteSingle={vi.fn()}
          getCoDisplay={() => "—"}
          getKpiDisplay={() => "-"}
          getFrozenStyle={() => undefined}
          getColumnStyle={() => undefined}
          formatDisplayDate={() => ""}
          formatHistoryTimestamp={() => ""}
          humanizeDiffKey={(value) => value}
          declHistoryFieldLabels={{}}
          StaffComboboxComponent={StubStaffCombobox}
          TeamComboboxComponent={StubTeamCombobox}
          AgencyComboboxComponent={StubAgencyCombobox}
          DeclarationStatusDisplayComponent={StubDeclarationStatusDisplay}
        />
      </table>,
    );

    expect(screen.getByText("Không có dữ liệu")).toBeInTheDocument();
  });
});
