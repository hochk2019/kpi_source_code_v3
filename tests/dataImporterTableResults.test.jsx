import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let lastHeaderProps = null;
let lastBodyProps = null;

vi.mock("@/components/dataImporter/DataImporterTableHeader.jsx", () => ({
  default: function MockDataImporterTableHeader(props) {
    lastHeaderProps = props;
    return (
      <thead>
        <tr>
          <th>{props.selectionEnabled ? "mock-header-selection" : "mock-header-basic"}</th>
        </tr>
      </thead>
    );
  },
}));

vi.mock("@/components/dataImporter/DataImporterTableBody.jsx", () => ({
  default: function MockDataImporterTableBody(props) {
    lastBodyProps = props;
    return (
      <tbody>
        <tr>
          <td>{`mock-body-${props.pageRows.length}`}</td>
        </tr>
      </tbody>
    );
  },
}));

import DataImporterTableResults from "@/components/dataImporter/DataImporterTableResults.jsx";

afterEach(() => {
  cleanup();
  lastHeaderProps = null;
  lastBodyProps = null;
});

describe("DataImporterTableResults", () => {
  it("render table wrapper, caption, and forward props to header/body", () => {
    const row = { so_tk: "TK-001" };
    const sharedProps = {
      hiddenColumns: new Set(["agency"]),
      selectionEnabled: true,
      historyEnabled: true,
      updateEnabled: true,
      deleteEnabled: true,
      frozenOffsets: { selection: 0 },
      frozenHeaderClass: "sticky-header",
      renderResizeHandle: vi.fn(),
      registerHeaderRef: vi.fn(),
      getFrozenStyle: vi.fn(() => undefined),
      getColumnStyle: vi.fn(() => undefined),
      columnLabels: { date: "Ngày đăng ký" },
      pageRows: [row],
      totalColumns: 16,
      selectedKeys: ["row-1"],
      updatedKeySet: new Set(["row-1"]),
      coMismatchKeySet: new Set(),
      duplicate11KeeperSet: new Set(),
      duplicate11DuplicatesSet: new Set(),
      rosterTeams: ["Team A"],
      agencyOptions: ["Đại lý A"],
      frozenCellClass: "sticky-cell",
      historyIndent: 12,
      buildRowState: vi.fn(),
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
      getCoDisplay: vi.fn(),
      getKpiDisplay: vi.fn(),
      formatDisplayDate: vi.fn(),
      formatHistoryTimestamp: vi.fn(),
      humanizeDiffKey: vi.fn(),
      declHistoryFieldLabels: { staff: "Nhân viên" },
      StaffComboboxComponent: () => null,
      TeamComboboxComponent: () => null,
      AgencyComboboxComponent: () => null,
      DeclarationStatusDisplayComponent: () => null,
    };

    render(<DataImporterTableResults {...sharedProps} />);

    expect(screen.getByRole("table", { name: "Danh sách tờ khai import" })).toBeInTheDocument();
    expect(screen.getByText(/Danh sách tờ khai import/i)).toBeInTheDocument();
    expect(screen.getByText("mock-header-selection")).toBeInTheDocument();
    expect(screen.getByText("mock-body-1")).toBeInTheDocument();
    expect(lastHeaderProps.selectionEnabled).toBe(true);
    expect(lastHeaderProps.hiddenColumns).toBe(sharedProps.hiddenColumns);
    expect(lastBodyProps.pageRows).toEqual([row]);
    expect(lastBodyProps.totalColumns).toBe(16);
    expect(lastBodyProps.frozenCellClass).toBe("sticky-cell");
  });

  it("keeps wrapper stable when optional controls are off", () => {
    render(
      <DataImporterTableResults
        hiddenColumns={new Set()}
        selectionEnabled={false}
        historyEnabled={false}
        updateEnabled={false}
        deleteEnabled={false}
        frozenOffsets={{}}
        frozenHeaderClass="sticky-header"
        renderResizeHandle={vi.fn()}
        registerHeaderRef={vi.fn()}
        getFrozenStyle={vi.fn(() => undefined)}
        getColumnStyle={vi.fn(() => undefined)}
        columnLabels={{}}
        pageRows={[]}
        totalColumns={3}
        selectedKeys={[]}
        updatedKeySet={new Set()}
        coMismatchKeySet={new Set()}
        duplicate11KeeperSet={new Set()}
        duplicate11DuplicatesSet={new Set()}
        rosterTeams={[]}
        agencyOptions={[]}
        frozenCellClass="sticky-cell"
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
        getCoDisplay={vi.fn()}
        getKpiDisplay={vi.fn()}
        formatDisplayDate={vi.fn()}
        formatHistoryTimestamp={vi.fn()}
        humanizeDiffKey={vi.fn()}
        declHistoryFieldLabels={{}}
        StaffComboboxComponent={() => null}
        TeamComboboxComponent={() => null}
        AgencyComboboxComponent={() => null}
        DeclarationStatusDisplayComponent={() => null}
      />,
    );

    expect(screen.getByRole("table", { name: "Danh sách tờ khai import" })).toBeInTheDocument();
    expect(screen.getByText("mock-header-basic")).toBeInTheDocument();
    expect(screen.getByText("mock-body-0")).toBeInTheDocument();
    expect(lastHeaderProps.selectionEnabled).toBe(false);
    expect(lastBodyProps.pageRows).toEqual([]);
  });
});
