import { describe, expect, it, vi } from "vitest";

import createDataImporterResultsProps from "@/components/dataImporter/dataImporterResultsProps.js";

describe("dataImporterResultsProps", () => {
  it("builds shared, table, and card result props with the expected pass-through handlers", () => {
    const buildRowState = vi.fn();
    const onToggleSelect = vi.fn();
    const onSelectStaff = vi.fn();
    const onSelectTeam = vi.fn();
    const onSelectAgency = vi.fn();
    const onChangeLicenseCount = vi.fn();
    const onToggleHistory = vi.fn();
    const onSaveRowChanges = vi.fn();
    const onDeleteSingle = vi.fn();
    const onRestoreSingle = vi.fn();
    const onHardDeleteSingle = vi.fn();
    const getCoDisplay = vi.fn();
    const getKpiDisplay = vi.fn();
    const formatDisplayDate = vi.fn();
    const formatHistoryTimestamp = vi.fn();
    const getFrozenStyle = vi.fn();
    const getColumnStyle = vi.fn();
    const renderResizeHandle = vi.fn();
    const registerHeaderRef = vi.fn();

    const props = createDataImporterResultsProps({
      pageRows: [{ id: "row-1" }],
      hiddenColumns: new Set(["history"]),
      selectionEnabled: true,
      selectedKeys: ["row-1"],
      updatedKeySet: new Set(["row-1"]),
      coMismatchKeySet: new Set(["row-2"]),
      duplicate11KeeperSet: new Set(["row-3"]),
      duplicate11DuplicatesSet: new Set(["row-4"]),
      rosterTeams: ["OPS"],
      agencyOptions: ["AGENCY-A"],
      historyEnabled: true,
      updateEnabled: true,
      deleteEnabled: true,
      buildRowState,
      onToggleSelect,
      onSelectStaff,
      onSelectTeam,
      onSelectAgency,
      onChangeLicenseCount,
      onToggleHistory,
      onSaveRowChanges,
      onDeleteSingle,
      getCoDisplay,
      getKpiDisplay,
      formatDisplayDate,
      formatHistoryTimestamp,
      humanizeDiffKey: (value) => `LABEL:${value}`,
      declHistoryFieldLabels: { fieldA: "Field A" },
      StaffComboboxComponent: "staff-box",
      TeamComboboxComponent: "team-box",
      AgencyComboboxComponent: "agency-box",
      DeclarationStatusDisplayComponent: "status-display",
      totalColumns: 12,
      frozenOffsets: { select: 0 },
      frozenHeaderClass: "sticky-header",
      renderResizeHandle,
      registerHeaderRef,
      getFrozenStyle,
      getColumnStyle,
      columnLabels: { so_tk: "Số TK" },
      frozenCellClass: "sticky-cell",
      historyIndent: 24,
      onRestoreSingle,
      onHardDeleteSingle,
      cardGridStyle: { gridTemplateColumns: "repeat(3, 1fr)" },
      ButtonComponent: "button-component",
    });

    expect(props.sharedResultsProps).toMatchObject({
      pageRows: [{ id: "row-1" }],
      selectionEnabled: true,
      selectedKeys: ["row-1"],
      rosterTeams: ["OPS"],
      agencyOptions: ["AGENCY-A"],
      historyEnabled: true,
      updateEnabled: true,
      deleteEnabled: true,
      StaffComboboxComponent: "staff-box",
      TeamComboboxComponent: "team-box",
      AgencyComboboxComponent: "agency-box",
      DeclarationStatusDisplayComponent: "status-display",
    });
    expect(props.sharedResultsProps.buildRowState).toBe(buildRowState);
    expect(props.sharedResultsProps.onToggleSelect).toBe(onToggleSelect);
    expect(props.sharedResultsProps.onSelectStaff).toBe(onSelectStaff);
    expect(props.sharedResultsProps.onChangeLicenseCount).toBe(onChangeLicenseCount);
    expect(props.sharedResultsProps.getCoDisplay).toBe(getCoDisplay);
    expect(props.sharedResultsProps.getKpiDisplay).toBe(getKpiDisplay);

    expect(props.tableResultsProps).toMatchObject({
      totalColumns: 12,
      frozenOffsets: { select: 0 },
      frozenHeaderClass: "sticky-header",
      columnLabels: { so_tk: "Số TK" },
      frozenCellClass: "sticky-cell",
      historyIndent: 24,
    });
    expect(props.tableResultsProps.renderResizeHandle).toBe(renderResizeHandle);
    expect(props.tableResultsProps.registerHeaderRef).toBe(registerHeaderRef);
    expect(props.tableResultsProps.getFrozenStyle).toBe(getFrozenStyle);
    expect(props.tableResultsProps.getColumnStyle).toBe(getColumnStyle);
    expect(props.tableResultsProps.onRestoreSingle).toBe(onRestoreSingle);
    expect(props.tableResultsProps.onHardDeleteSingle).toBe(onHardDeleteSingle);
    expect(props.tableResultsProps.onToggleHistory).toBe(onToggleHistory);

    expect(props.cardResultsProps).toMatchObject({
      cardGridStyle: { gridTemplateColumns: "repeat(3, 1fr)" },
      ButtonComponent: "button-component",
    });
    expect(props.cardResultsProps.onDeleteSingle).toBe(onDeleteSingle);
    expect(props.cardResultsProps.onSaveRowChanges).toBe(onSaveRowChanges);
  });
});
